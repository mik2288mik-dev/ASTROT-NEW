const mockGetPool = jest.fn();
const mockDeliverSupportTicketChannel = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: () => mockGetPool(),
}));
jest.mock('../lib/supportDelivery', () => {
  const actual = jest.requireActual('../lib/supportDelivery');
  return {
    ...actual,
    deliverSupportTicketChannel: (...args: unknown[]) => mockDeliverSupportTicketChannel(...args),
  };
});
jest.mock('../lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  enqueueSupportDeliveryOutbox,
  processSupportDeliveryOutbox,
} from '../lib/supportOutbox';

type DueRow = {
  id: number;
  ticket_id: number;
  channel: 'email' | 'telegram';
  attempts: number;
};

function makePool(options: {
  rows?: DueRow[];
  staleRecovered?: number;
  body?: string;
  tags?: string;
  failClaim?: boolean;
}) {
  const rows = options.rows || [];
  const clientQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    const normalized = sql.trim();
    if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (normalized.startsWith('UPDATE support_delivery_outbox') && normalized.includes("SET status = CASE")) {
      return { rows: [], rowCount: options.staleRecovered || 0 };
    }
    if (normalized.startsWith('SELECT id, ticket_id, channel, attempts')) {
      if (options.failClaim) throw new Error('claim failed');
      const due = rows.filter((row) => (params?.[2] == null || row.ticket_id === params[2])
        && (params?.[3] == null || row.channel === params[3]));
      return { rows: due, rowCount: due.length };
    }
    if (normalized.includes("SET status = 'processing'")) {
      const id = Number(params?.[0]);
      const row = rows.find((candidate) => candidate.id === id);
      return {
        rows: row ? [{ ...row, attempts: row.attempts + 1 }] : [],
        rowCount: row ? 1 : 0,
      };
    }
    throw new Error(`Unexpected client query: ${normalized}`);
  });
  const release = jest.fn();
  const poolQuery = jest.fn(async (sql: string, _params?: unknown[]) => {
    const normalized = sql.trim();
    if (normalized.startsWith('SELECT t.tags,') && normalized.includes('FROM support_tickets t')
      && normalized.includes('first_message.body')) {
      return {
        rows: [{
          user_id: '9000000003445',
          created_at: '2026-09-05T17:30:00.000Z',
          tags: options.tags || JSON.stringify({
            category: 'problem',
            replyEmail: 'person@example.test',
            diagnostics: {
              appVersion: '1.0.1',
              versionCode: '4',
              platform: 'android',
              lastScreen: 'settings.feedback',
              distributionChannel: 'rustore',
            },
          }),
          body: options.body || 'Кнопка зависла после оплаты, account 12345.',
        }],
        rowCount: 1,
      };
    }
    if (normalized.startsWith('UPDATE support_delivery_outbox')) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected pool query: ${normalized}`);
  });
  const pool = {
    connect: jest.fn(async () => ({ query: clientQuery, release })),
    query: poolQuery,
  };
  return { pool, clientQuery, poolQuery, release };
}

describe('support delivery outbox', () => {
  beforeEach(() => {
    mockGetPool.mockReset();
    mockDeliverSupportTicketChannel.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
  });

  it('enqueues both channels without copying ticket text or PII', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 2 });
    await enqueueSupportDeliveryOutbox({ query } as never, 42);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("VALUES ('email'), ('telegram')");
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (ticket_id, channel) DO NOTHING');
    expect(query.mock.calls[0][1]).toEqual([42]);
    expect(JSON.stringify(query.mock.calls)).not.toContain('person@example.test');
    expect(JSON.stringify(query.mock.calls)).not.toContain('Кнопка зависла');
  });

  it('claims with SKIP LOCKED, loads canonical content, sends one channel and marks sent', async () => {
    const state = makePool({
      rows: [{ id: 9, ticket_id: 42, channel: 'email', attempts: 0 }],
      staleRecovered: 1,
    });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'email', result: 'sent' });

    await expect(processSupportDeliveryOutbox(20, 42)).resolves.toEqual({
      claimed: 1,
      sent: 1,
      retried: 0,
      dead: 0,
      staleRecovered: 1,
    });

    const claimSql = state.clientQuery.mock.calls.find(([sql]) => String(sql).includes('FOR UPDATE SKIP LOCKED'))?.[0];
    expect(claimSql).toContain("status IN ('pending', 'failed')");
    expect(claimSql).toContain('$3::BIGINT');
    const claimParams = state.clientQuery.mock.calls.find(([sql]) => String(sql).includes('FOR UPDATE SKIP LOCKED'))?.[1];
    expect(claimParams).toEqual([10, 20, 42, null]);
    const canonicalQuery = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes('FROM support_tickets t'));
    expect(canonicalQuery?.[0]).toContain("t.created_at AT TIME ZONE 'UTC' AS created_at");
    expect(canonicalQuery?.[0]).toContain('t.user_id');
    expect(canonicalQuery?.[0]).toContain("m.author_type = 'user'");
    expect(canonicalQuery?.[0]).toContain('m.internal = FALSE');
    expect(canonicalQuery?.[1]).toEqual([42]);
    expect(mockDeliverSupportTicketChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 42,
        message: 'Кнопка зависла после оплаты, account 12345.',
        replyEmail: 'person@example.test',
        userId: '9000000003445',
        createdAt: '2026-09-05T17:30:00.000Z',
      }),
      'email',
    );
    const sentUpdate = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'sent'"));
    expect(sentUpdate?.[1]).toEqual([9]);

    const logs = JSON.stringify([...mockLoggerInfo.mock.calls, ...mockLoggerWarn.mock.calls]);
    expect(logs).toContain('ticketId');
    expect(logs).not.toContain('person@example.test');
    expect(logs).not.toContain('account 12345');
  });

  it('persists a bounded exponential retry after an email provider failure', async () => {
    const state = makePool({ rows: [{ id: 10, ticket_id: 43, channel: 'email', attempts: 0 }] });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'email', result: 'failed' });

    await expect(processSupportDeliveryOutbox(1)).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retried: 1,
      dead: 0,
      staleRecovered: 0,
    });
    const retry = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'failed'"));
    expect(retry?.[1]).toEqual([10, 30, 'SUPPORT_PROVIDER_FAILED']);
    expect(mockDeliverSupportTicketChannel).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 43 }), 'email');
  });

  it.each([0, 9])('finishes suppressed owner Telegram without delivery retries at prior attempt %i', async (attempts) => {
    const state = makePool({ rows: [{ id: 12, ticket_id: 45, channel: 'telegram', attempts }] });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'telegram', result: 'suppressed' });

    await expect(processSupportDeliveryOutbox(1)).resolves.toEqual({
      claimed: 1, sent: 0, retried: 0, dead: 1, staleRecovered: 0,
    });
    const terminalUpdate = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'dead'"));
    expect(terminalUpdate?.[0]).toContain("last_error_code = 'OWNER_SCOPE_FILTERED'");
    expect(terminalUpdate?.[0]).toContain('attempts = $2');
    expect(terminalUpdate?.[1]).toEqual([12, attempts + 1]);
    expect(state.poolQuery.mock.calls.some(([sql]) => String(sql).includes("SET status = 'failed'"))).toBe(false);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { id: 12, ticketId: 45, channel: 'telegram', status: 'suppressed', attempt: attempts + 1 },
    }));
  });

  it('limits a channel-specific run to that channel', async () => {
    const state = makePool({ rows: [
      { id: 13, ticket_id: 46, channel: 'email', attempts: 0 },
      { id: 14, ticket_id: 46, channel: 'telegram', attempts: 0 },
    ] });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'email', result: 'sent' });

    await expect(processSupportDeliveryOutbox(20, 46, 'email')).resolves.toEqual({
      claimed: 1, sent: 1, retried: 0, dead: 0, staleRecovered: 0,
    });
    const claim = state.clientQuery.mock.calls.find(([sql]) => String(sql).includes('FOR UPDATE SKIP LOCKED'));
    expect(claim?.[0]).toContain('($4::TEXT IS NULL OR channel = $4::TEXT)');
    expect(claim?.[1]).toEqual([10, 20, 46, 'email']);
    expect(mockDeliverSupportTicketChannel).toHaveBeenCalledTimes(1);
    expect(mockDeliverSupportTicketChannel).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 46 }), 'email');
  });

  it('retains canonical-data failures as retryable errors without attempting delivery', async () => {
    const state = makePool({
      rows: [{ id: 15, ticket_id: 47, channel: 'email', attempts: 0 }], tags: '{}',
    });
    mockGetPool.mockReturnValue(state.pool);

    await expect(processSupportDeliveryOutbox(1)).resolves.toEqual({
      claimed: 1, sent: 0, retried: 1, dead: 0, staleRecovered: 0,
    });
    expect(mockDeliverSupportTicketChannel).not.toHaveBeenCalled();
    const retry = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'failed'"));
    expect(retry?.[1]).toEqual([15, 30, 'SUPPORT_CANONICAL_OR_DELIVERY_FAILED']);
  });

  it('dead-letters the tenth failed attempt', async () => {
    const state = makePool({ rows: [{ id: 11, ticket_id: 44, channel: 'email', attempts: 9 }] });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'email', result: 'unconfigured' });

    await expect(processSupportDeliveryOutbox(1)).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retried: 0,
      dead: 1,
      staleRecovered: 0,
    });
    const dead = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'dead'"));
    expect(dead?.[1]).toEqual([11, 'SUPPORT_CHANNEL_UNCONFIGURED']);
  });

  it('recovers processing leases older than ten minutes even when nothing else is due', async () => {
    const state = makePool({ rows: [], staleRecovered: 2 });
    mockGetPool.mockReturnValue(state.pool);

    await expect(processSupportDeliveryOutbox(20)).resolves.toEqual({
      claimed: 0,
      sent: 0,
      retried: 0,
      dead: 0,
      staleRecovered: 2,
    });
    const recovery = state.clientQuery.mock.calls.find(([sql]) => String(sql).includes('PROCESSING_LEASE_EXPIRED'))?.[0];
    expect(recovery).toContain("INTERVAL '10 minutes'");
  });

  it('rolls back and releases a failed claim transaction', async () => {
    const state = makePool({ failClaim: true });
    mockGetPool.mockReturnValue(state.pool);

    await expect(processSupportDeliveryOutbox(20)).rejects.toThrow('claim failed');
    expect(state.clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(state.release).toHaveBeenCalledTimes(1);
  });
});
