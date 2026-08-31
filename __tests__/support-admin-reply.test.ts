import type { NextApiRequest, NextApiResponse } from 'next';

const mockRequireAdminPermission = jest.fn();
const mockRecordAdminAction = jest.fn();
const mockPoolQuery = jest.fn();
const mockSendSupportTelegramReply = jest.fn();
const mockSendSupportEmailReply = jest.fn();

jest.mock('../lib/admin/rbac', () => ({
  requireAdminPermission: (...args: unknown[]) => mockRequireAdminPermission(...args),
}));
jest.mock('../lib/admin/audit', () => ({
  recordAdminAction: (...args: unknown[]) => mockRecordAdminAction(...args),
}));
jest.mock('../lib/db', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockPoolQuery(...args) }),
}));
jest.mock('../lib/supportDelivery', () => {
  const actual = jest.requireActual('../lib/supportDelivery');
  return {
    ...actual,
    sendSupportTelegramReply: (...args: unknown[]) => mockSendSupportTelegramReply(...args),
    sendSupportEmailReply: (...args: unknown[]) => mockSendSupportEmailReply(...args),
  };
});

import handler from '../pages/api/admin/v2/support/[id]';

function responseRecorder() {
  const result = { status: 200, body: undefined as unknown };
  const response = {
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
    query: { id: '81' },
  } as unknown as NextApiRequest;
}

describe('admin support replies', () => {
  beforeEach(() => {
    mockRequireAdminPermission.mockReset().mockResolvedValue({ userId: '1', permissions: ['support.act'] });
    mockRecordAdminAction.mockReset().mockResolvedValue(undefined);
    mockSendSupportTelegramReply.mockReset().mockResolvedValue({ channel: 'telegram', result: 'sent' });
    mockSendSupportEmailReply.mockReset().mockResolvedValue({ channel: 'email', result: 'sent' });
    mockPoolQuery.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, status')) {
        return {
          rows: [{
            user_id: '901',
            status: 'open',
            tags: JSON.stringify({ category: 'question', replyEmail: 'person@example.test' }),
          }],
        };
      }
      if (sql.includes('FROM account_identities')) return { rows: [{ provider_subject: '777' }] };
      if (sql.includes('INSERT INTO support_messages')) return { rows: [{ id: 501 }] };
      return { rows: [] };
    });
  });

  it('delivers to the validated reply email and linked Telegram provider subject', async () => {
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'Мы получили обращение.', internal: false }), response);

    expect(result).toEqual({
      status: 200,
      body: { ok: true, deliveries: { email: 'sent', telegram: 'sent' } },
    });
    const identityQuery = mockPoolQuery.mock.calls.find(([sql]) => String(sql).includes('FROM account_identities'));
    expect(identityQuery?.[1]).toEqual(['901']);
    expect(mockSendSupportEmailReply).toHaveBeenCalledWith({
      ticketId: 81,
      messageId: 501,
      to: 'person@example.test',
      message: 'Мы получили обращение.',
    });
    expect(mockSendSupportTelegramReply).toHaveBeenCalledWith({
      ticketId: 81,
      chatId: '777',
      message: 'Мы получили обращение.',
    });
    expect(mockSendSupportTelegramReply).not.toHaveBeenCalledWith(expect.objectContaining({ chatId: '901' }));
  });

  it('uses email alone when the account has no linked Telegram identity', async () => {
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, status')) {
        return { rows: [{ user_id: '901', status: 'open', tags: JSON.stringify({ category: 'question', replyEmail: 'person@example.test' }) }] };
      }
      if (sql.includes('FROM account_identities')) return { rows: [] };
      if (sql.includes('INSERT INTO support_messages')) return { rows: [{ id: 502 }] };
      return { rows: [] };
    });
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'Ответ сохранён.', internal: false }), response);

    expect(result.status).toBe(200);
    expect(mockSendSupportTelegramReply).not.toHaveBeenCalled();
    expect(mockSendSupportEmailReply).toHaveBeenCalledTimes(1);
  });

  it('keeps internal notes inside the admin system', async () => {
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'Внутренняя заметка.', internal: true }), response);

    expect(result.status).toBe(200);
    expect(mockPoolQuery.mock.calls.some(([sql]) => String(sql).includes('FROM account_identities'))).toBe(false);
    expect(mockSendSupportTelegramReply).not.toHaveBeenCalled();
    expect(mockSendSupportEmailReply).not.toHaveBeenCalled();
    expect(mockPoolQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE support_tickets SET status'))).toBe(false);
  });

  it('rejects a public reply when neither validated channel is available', async () => {
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id, status')) {
        return { rows: [{ user_id: '901', status: 'open', tags: JSON.stringify({ category: 'question' }) }] };
      }
      if (sql.includes('FROM account_identities')) return { rows: [] };
      return { rows: [] };
    });
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'Ответ пользователю.', internal: false }), response);

    expect(result.status).toBe(409);
    expect(result.body).toEqual(expect.objectContaining({ error: 'SUPPORT_REPLY_DESTINATION_MISSING' }));
    expect(mockPoolQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO support_messages'))).toBe(false);
  });

  it('does not set pending or return ok when every configured channel fails', async () => {
    mockSendSupportEmailReply.mockResolvedValue({ channel: 'email', result: 'failed' });
    mockSendSupportTelegramReply.mockResolvedValue({ channel: 'telegram', result: 'failed' });
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'Ответ пользователю.', internal: false }), response);

    expect(result.status).toBe(502);
    expect(result.body).toEqual(expect.objectContaining({ error: 'SUPPORT_REPLY_DELIVERY_FAILED' }));
    expect(mockPoolQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE support_tickets SET status'))).toBe(false);
  });

  it('rejects oversized public replies before persistence or delivery', async () => {
    const { response, result } = responseRecorder();
    await handler(request({ action: 'reply', body: 'x'.repeat(4_001), internal: false }), response);

    expect(result.status).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({ error: 'BAD_BODY' }));
    expect(mockPoolQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO support_messages'))).toBe(false);
    expect(mockSendSupportEmailReply).not.toHaveBeenCalled();
    expect(mockSendSupportTelegramReply).not.toHaveBeenCalled();
  });

  it('returns persisted support metadata to the protected admin detail', async () => {
    mockRequireAdminPermission.mockResolvedValue({ userId: '1', permissions: ['support.view'] });
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT t.*')) {
        return {
          rows: [{
            id: 81,
            user_id: 901,
            user_name: 'Пользователь',
            subject: 'NEBO: Вопрос',
            status: 'open',
            priority: 'normal',
            tags: JSON.stringify({
              category: 'question',
              replyEmail: 'person@example.test',
              diagnostics: { appVersion: '1.0.1' },
            }),
          }],
        };
      }
      if (sql.includes('FROM support_messages')) return { rows: [] };
      return { rows: [] };
    });
    const { response, result } = responseRecorder();
    await handler(request(undefined, 'GET'), response);

    expect(result.status).toBe(200);
    expect(result.body).toEqual(expect.objectContaining({
      ticket: expect.objectContaining({
        category: 'question',
        replyEmail: 'person@example.test',
        diagnostics: { appVersion: '1.0.1' },
      }),
    }));
  });
});
