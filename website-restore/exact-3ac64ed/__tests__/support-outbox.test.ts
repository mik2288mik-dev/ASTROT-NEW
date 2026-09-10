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
      return { rows, rowCount: rows.length };
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
    if (normalized.startsWith('SELECT t.tags, first_message.body')) {
      return {
        rows: [{
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
    expect(claimParams).toEqual([10, 20, 42]);
    expect(mockDeliverSupportTicketChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 42,
        message: 'Кнопка зависла после оплаты, account 12345.',
        replyEmail: 'person@example.test',
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

  it('persists a bounded exponential retry after a provider failure', async () => {
    const state = makePool({ rows: [{ id: 10, ticket_id: 43, channel: 'telegram', attempts: 0 }] });
    mockGetPool.mockReturnValue(state.pool);
    mockDeliverSupportTicketChannel.mockResolvedValue({ channel: 'telegram', result: 'failed' });

    await expect(processSupportDeliveryOutbox(1)).resolves.toEqual({
      claimed: 1,
      sent: 0,
      retried: 1,
      dead: 0,
      staleRecovered: 0,
    });
    const retry = state.poolQuery.mock.calls.find(([sql]) => String(sql).includes("SET status = 'failed'"));
    expect(retry?.[1]).toEqual([10, 30, 'SUPPORT_PROVIDER_FAILED']);
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
