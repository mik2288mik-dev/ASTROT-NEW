import type { NextApiRequest, NextApiResponse } from 'next';

const mockRequireAppUser = jest.fn();
const mockConsumeAuthRateLimit = jest.fn();
const mockEnqueueSupportDeliveryOutbox = jest.fn();
const mockProcessSupportDeliveryOutbox = jest.fn();
const mockGetPool = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));
jest.mock('../lib/auth/authRateLimit', () => ({
  consumeAuthRateLimit: (...args: unknown[]) => mockConsumeAuthRateLimit(...args),
}));
jest.mock('../lib/db', () => ({
  getPool: () => mockGetPool(),
}));
jest.mock('../lib/supportOutbox', () => {
  return {
    enqueueSupportDeliveryOutbox: (...args: unknown[]) => mockEnqueueSupportDeliveryOutbox(...args),
    processSupportDeliveryOutbox: (...args: unknown[]) => mockProcessSupportDeliveryOutbox(...args),
  };
});

import { AdminAuthError } from '../lib/adminAuth';
import handler, { config } from '../pages/api/support/ticket';

type RecordedResponse = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

function responseRecorder() {
  const result: RecordedResponse = { status: 200, body: undefined, headers: {} };
  const response = {
    setHeader(name: string, value: string) {
      result.headers[name] = value;
      return response;
    },
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as NextApiResponse;
  return { response, result };
}

function request(body: unknown, method = 'POST') {
  return {
    method,
    body,
    headers: {},
    query: {},
  } as unknown as NextApiRequest;
}

describe('support ticket API', () => {
  let calls: string[];
  let client: { query: jest.Mock; release: jest.Mock };

  beforeEach(() => {
    calls = [];
    mockRequireAppUser.mockReset().mockResolvedValue({ userId: '101', isGuest: true, provider: 'native' });
    mockConsumeAuthRateLimit.mockReset().mockResolvedValue(undefined);
    mockEnqueueSupportDeliveryOutbox.mockReset().mockImplementation(async () => {
      calls.push('ENQUEUE');
    });
    mockProcessSupportDeliveryOutbox.mockReset().mockImplementation(async () => {
      calls.push('DELIVERY');
      return { claimed: 2, sent: 2, retried: 0, dead: 0, staleRecovered: 0 };
    });
    client = {
      query: jest.fn(async (sql: string) => {
        const normalized = sql.trim();
        calls.push(normalized);
        if (normalized.includes('INSERT INTO support_tickets')) return { rows: [{ id: 72 }] };
        return { rows: [] };
      }),
      release: jest.fn(() => calls.push('RELEASE')),
    };
    mockGetPool.mockReset().mockReturnValue({ connect: jest.fn().mockResolvedValue(client) });
  });

  it('declares a bounded request body and saves the ticket atomically before delivery', async () => {
    const { response, result } = responseRecorder();
    await handler(request({
      category: 'problem',
      message: 'После оплаты экран перестал отвечать.',
      replyEmail: 'person@example.test',
      diagnostics: { appVersion: '1.0.1', versionCode: 4, distributionChannel: 'rustore' },
    }), response);

    expect(config.api.bodyParser.sizeLimit).toBe('16kb');
    expect(result).toEqual({
      status: 201,
      body: { ok: true, ticketId: 72 },
      headers: { 'Cache-Control': 'no-store' },
    });
    expect(mockRequireAppUser).toHaveBeenCalledWith(expect.anything(), { allowGuest: true });
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledWith({
      scope: 'support_ticket_user',
      key: '101',
      maxAttempts: 5,
      windowMs: 600_000,
    });

    const ticketInsert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO support_tickets'));
    expect(ticketInsert?.[1]?.[0]).toBe('101');
    expect(ticketInsert?.[1]?.[1]).toBe('NEBO: Ошибка');
    expect(JSON.parse(ticketInsert?.[1]?.[2])).toEqual({
      category: 'problem',
      replyEmail: 'person@example.test',
      diagnostics: { appVersion: '1.0.1', versionCode: '4', distributionChannel: 'rustore' },
    });
    const messageInsert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO support_messages'));
    expect(messageInsert?.[1]).toEqual([72, '101', 'После оплаты экран перестал отвечать.']);
    const messageInsertIndex = calls.findIndex((call) => call.includes('INSERT INTO support_messages'));
    expect(calls.indexOf('ENQUEUE')).toBeGreaterThan(messageInsertIndex);
    expect(calls.indexOf('COMMIT')).toBeGreaterThan(calls.indexOf('ENQUEUE'));
    expect(calls.indexOf('COMMIT')).toBeGreaterThan(calls.indexOf('BEGIN'));
    expect(calls.indexOf('DELIVERY')).toBeGreaterThan(calls.indexOf('COMMIT'));
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSupportDeliveryOutbox).toHaveBeenCalledWith(client, 72);
    expect(mockProcessSupportDeliveryOutbox).toHaveBeenCalledWith(2, 72);
  });

  it('rejects unknown fields before authentication or writes', async () => {
    const { response, result } = responseRecorder();
    await handler(request({
      category: 'idea',
      message: 'Пожалуйста, добавьте эту возможность.',
      accountId: 'someone-else',
    }), response);

    expect(result.status).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({ error: 'SUPPORT_BODY_INVALID' }));
    expect(mockRequireAppUser).not.toHaveBeenCalled();
    expect(mockGetPool).not.toHaveBeenCalled();
  });

  it('rate-limits by the canonical authenticated guest or account id', async () => {
    mockRequireAppUser.mockResolvedValue({ userId: 'canonical-guest-7', isGuest: true, provider: 'native' });
    mockConsumeAuthRateLimit.mockRejectedValue(new AdminAuthError(429, 'AUTH_RATE_LIMITED', 'Try again later'));
    const { response, result } = responseRecorder();
    await handler(request({ category: 'question', message: 'Подскажите, как это работает?' }), response);

    expect(result.status).toBe(429);
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: 'canonical-guest-7' }));
    expect(mockGetPool).not.toHaveBeenCalled();
  });

  it('rolls back both inserts and never delivers an incomplete ticket', async () => {
    client.query.mockImplementation(async (sql: string) => {
      const normalized = sql.trim();
      calls.push(normalized);
      if (normalized.includes('INSERT INTO support_tickets')) return { rows: [{ id: 73 }] };
      if (normalized.includes('INSERT INTO support_messages')) throw new Error('database write failed');
      return { rows: [] };
    });
    const { response, result } = responseRecorder();
    await handler(request({ category: 'other', message: 'Достаточно длинное сообщение.' }), response);

    expect(result.status).toBe(500);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(mockEnqueueSupportDeliveryOutbox).not.toHaveBeenCalled();
    expect(mockProcessSupportDeliveryOutbox).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the ticket when durable delivery rows cannot be enqueued', async () => {
    mockEnqueueSupportDeliveryOutbox.mockRejectedValue(new Error('outbox unavailable'));
    const { response, result } = responseRecorder();
    await handler(request({ category: 'payment', message: 'Не проходит восстановление покупки.' }), response);

    expect(result.status).toBe(500);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(mockProcessSupportDeliveryOutbox).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed ticket when all external delivery unexpectedly rejects', async () => {
    mockProcessSupportDeliveryOutbox.mockRejectedValue(new Error('provider failed'));
    const { response, result } = responseRecorder();
    await handler(request({ category: 'idea', message: 'Пожалуйста, добавьте новую возможность.' }), response);

    expect(result.status).toBe(201);
    expect(result.body).toEqual({ ok: true, ticketId: 72 });
    expect(calls).toContain('COMMIT');
  });

  it('allows only POST', async () => {
    const { response, result } = responseRecorder();
    await handler(request(undefined, 'GET'), response);
    expect(result).toEqual({ status: 405, body: { error: 'METHOD_NOT_ALLOWED' }, headers: {} });
  });
});
