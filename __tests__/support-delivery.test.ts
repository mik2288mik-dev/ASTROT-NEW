import fs from 'fs';

const mockSendTelegramTextMessage = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../lib/telegramBot', () => ({
  sendTelegramTextMessage: (...args: unknown[]) => mockSendTelegramTextMessage(...args),
}));
jest.mock('../lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  buildSupportSubject,
  deliverSupportTicket,
  deliverSupportTicketChannel,
  parseSupportMetadata,
  parseSupportTicketPayload,
  sendSupportEmailReply,
  serializeSupportMetadata,
  SupportPayloadError,
} from '../lib/supportDelivery';

describe('support ticket validation and delivery', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const envNames = [
    'RESEND_API_KEY',
    'SUPPORT_EMAIL_TO',
    'NEXT_PUBLIC_SUPPORT_EMAIL',
    'SUPPORT_EMAIL_FROM',
    'AUTH_EMAIL_FROM',
    'SUPPORT_TELEGRAM_CHAT_ID',
    'OWNER_ID',
    'SUPPORT_ADMIN_URL',
  ] as const;

  beforeEach(() => {
    for (const name of envNames) delete process.env[name];
    global.fetch = jest.fn();
    mockSendTelegramTextMessage.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('accepts only the documented category, email and diagnostics contract', () => {
    const payload = parseSupportTicketPayload({
      category: 'problem',
      message: '  После нажатия экран перестаёт отвечать.  ',
      replyEmail: ' Person@Example.Test ',
      diagnostics: {
        appVersion: '1.0.1',
        versionCode: 4,
        platform: 'android',
        lastScreen: 'settings.feedback',
        distributionChannel: 'rustore',
      },
    });

    expect(payload).toEqual({
      category: 'problem',
      message: 'После нажатия экран перестаёт отвечать.',
      replyEmail: 'person@example.test',
      diagnostics: {
        appVersion: '1.0.1',
        versionCode: '4',
        platform: 'android',
        lastScreen: 'settings.feedback',
        distributionChannel: 'rustore',
      },
    });
    expect(parseSupportMetadata(serializeSupportMetadata(payload))).toEqual({
      category: payload.category,
      replyEmail: payload.replyEmail,
      diagnostics: payload.diagnostics,
    });
  });

  it.each([
    ['problem', 'NEBO: Ошибка'],
    ['idea', 'NEBO: Пожелание'],
    ['payment', 'NEBO: Оплата'],
    ['question', 'NEBO: Вопрос'],
    ['other', 'NEBO: Другое'],
  ] as const)('accepts category %s with a server-built subject', (category, subject) => {
    const payload = parseSupportTicketPayload({ category, message: 'Достаточно длинное сообщение.' });
    expect(payload.category).toBe(category);
    expect(buildSupportSubject(category)).toBe(subject);
  });

  it.each([
    [{ category: 'bug', message: 'Достаточно длинное сообщение' }, 'SUPPORT_CATEGORY_INVALID'],
    [{ category: 'idea', message: 'коротко' }, 'SUPPORT_MESSAGE_INVALID'],
    [{ category: 'other', message: 'Достаточно длинное сообщение', subject: 'client subject' }, 'SUPPORT_BODY_INVALID'],
    [{ category: 'question', message: 'Достаточно длинное сообщение', replyEmail: 'bad\r\n@example.test' }, 'SUPPORT_REPLY_EMAIL_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { log: 'secret' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { deviceModel: 'RMX5051' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { osVersion: '15' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { appVersion: 'person@example.test' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { versionCode: 0 } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { versionCode: '1 secret' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { platform: 'Android' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { lastScreen: 'profile.person@example.test' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
    [{ category: 'problem', message: 'Достаточно длинное сообщение', diagnostics: { distributionChannel: 'private-channel' } }, 'SUPPORT_DIAGNOSTICS_INVALID'],
  ])('rejects malformed or non-allowlisted input %#', (body, code) => {
    expect(() => parseSupportTicketPayload(body)).toThrow(SupportPayloadError);
    try {
      parseSupportTicketPayload(body);
    } catch (error) {
      expect((error as SupportPayloadError).code).toBe(code);
    }
  });

  it('emails the full ticket while Telegram receives metadata only', async () => {
    process.env.RESEND_API_KEY = 're_server_secret_123';
    process.env.SUPPORT_EMAIL_TO = 'owner@example.test';
    process.env.SUPPORT_EMAIL_FROM = 'NEBO <support@example.test>';
    process.env.SUPPORT_TELEGRAM_CHAT_ID = '777';
    process.env.SUPPORT_ADMIN_URL = 'https://admin.example.test/support';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockSendTelegramTextMessage.mockResolvedValue({ ok: true, messageId: 55 });

    const sensitiveMessage = [
      'Кнопка зависла.',
      'Email person@example.test.',
      'Дата рождения 18.08.1990.',
      'account id 12345.',
      '[ERROR] private log line.',
    ].join(' ');
    const results = await deliverSupportTicket({
      ticketId: 42,
      category: 'problem',
      message: sensitiveMessage,
      replyEmail: 'person@example.test',
      diagnostics: { appVersion: '1.0.1', versionCode: '4', distributionChannel: 'rustore' },
    });

    expect(results).toEqual([
      { channel: 'email', result: 'sent' },
      { channel: 'telegram', result: 'sent' },
    ]);
    const resendRequest = (global.fetch as jest.Mock).mock.calls[0][1];
    const resendBody = JSON.parse(resendRequest.body);
    expect(resendRequest.headers['Idempotency-Key']).toBe('support-ticket-42-email-v1');
    expect(resendBody.text).toContain(sensitiveMessage);
    expect(resendBody.text).toContain('Email для ответа: person@example.test');
    expect(resendBody.reply_to).toBe('person@example.test');

    expect(mockSendTelegramTextMessage).toHaveBeenCalledWith(
      '777',
      'Новое обращение NEBO #42\nКатегория: Ошибка\nВерсия: 1.0.1 (4)\nКанал: rustore',
      { replyMarkup: { inline_keyboard: [[{ text: 'Открыть админку', url: 'https://admin.example.test/support' }]] } },
    );
    const telegramPayload = JSON.stringify(mockSendTelegramTextMessage.mock.calls);
    expect(telegramPayload).not.toContain(sensitiveMessage);
    expect(telegramPayload).not.toContain('person@example.test');
    expect(telegramPayload).not.toContain('18.08.1990');
    expect(telegramPayload).not.toContain('12345');
    expect(telegramPayload).not.toContain('private log');

    const logs = JSON.stringify([...mockLoggerInfo.mock.calls, ...mockLoggerWarn.mock.calls]);
    expect(logs).toContain('ticketId');
    expect(logs).toContain('channel');
    expect(logs).toContain('result');
    expect(logs).not.toContain(sensitiveMessage);
    expect(logs).not.toContain('person@example.test');
    expect(logs).not.toContain('re_server_secret_123');
  });

  it('delivers exactly the requested outbox channel', async () => {
    process.env.RESEND_API_KEY = 're_server_secret_123';
    process.env.SUPPORT_EMAIL_TO = 'owner@example.test';
    process.env.SUPPORT_EMAIL_FROM = 'NEBO <support@example.test>';
    process.env.SUPPORT_TELEGRAM_CHAT_ID = '777';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockSendTelegramTextMessage.mockResolvedValue({ ok: true, messageId: 56 });
    const input = {
      ticketId: 45,
      category: 'question' as const,
      message: 'Подскажите, как работает эта функция?',
      replyEmail: null,
      diagnostics: null,
    };

    await expect(deliverSupportTicketChannel(input, 'email')).resolves.toEqual({
      channel: 'email', result: 'sent',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockSendTelegramTextMessage).not.toHaveBeenCalled();

    (global.fetch as jest.Mock).mockClear();
    await expect(deliverSupportTicketChannel(input, 'telegram')).resolves.toEqual({
      channel: 'telegram', result: 'sent',
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSendTelegramTextMessage).toHaveBeenCalledTimes(1);
  });

  it('sends admin email replies with message-level idempotency and metadata-only logs', async () => {
    process.env.RESEND_API_KEY = 're_server_secret_123';
    process.env.SUPPORT_EMAIL_FROM = 'NEBO <support@example.test>';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const sensitiveReply = 'Ответ по обращению для person@example.test.';

    await expect(sendSupportEmailReply({
      ticketId: 46,
      messageId: 701,
      to: 'person@example.test',
      message: sensitiveReply,
    })).resolves.toEqual({ channel: 'email', result: 'sent' });

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(request.headers['Idempotency-Key']).toBe('support-ticket-46-reply-701-email-v1');
    expect(body).toEqual(expect.objectContaining({
      to: ['person@example.test'],
      text: sensitiveReply,
      subject: 'Ответ поддержки NEBO #46',
    }));
    const logs = JSON.stringify([...mockLoggerInfo.mock.calls, ...mockLoggerWarn.mock.calls]);
    expect(logs).not.toContain('person@example.test');
    expect(logs).not.toContain(sensitiveReply);
  });

  it('uses documented fallbacks, omits an invalid admin URL and contains provider failures', async () => {
    process.env.RESEND_API_KEY = 're_server_secret_123';
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'owner@example.test';
    process.env.AUTH_EMAIL_FROM = 'NEBO <support@example.test>';
    process.env.OWNER_ID = '777';
    process.env.SUPPORT_ADMIN_URL = 'http://not-secure.example.test';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('provider response with secret body'));
    mockSendTelegramTextMessage.mockResolvedValue({ ok: false, error: 'blocked' });

    await expect(deliverSupportTicket({
      ticketId: 43,
      category: 'other',
      message: 'Достаточно длинное обращение.',
      replyEmail: null,
      diagnostics: null,
    })).resolves.toEqual([
      { channel: 'email', result: 'failed' },
      { channel: 'telegram', result: 'failed' },
    ]);
    expect(mockSendTelegramTextMessage).toHaveBeenCalledWith(
      '777',
      'Новое обращение NEBO #43\nКатегория: Другое\nВерсия: не указана\nКанал: не указан',
      undefined,
    );
  });

  it('reports unconfigured channels without attempting external requests', async () => {
    await expect(deliverSupportTicket({
      ticketId: 44,
      category: 'idea',
      message: 'Пожалуйста, добавьте новую возможность.',
      replyEmail: null,
      diagnostics: null,
    })).resolves.toEqual([
      { channel: 'email', result: 'unconfigured' },
      { channel: 'telegram', result: 'unconfigured' },
    ]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSendTelegramTextMessage).not.toHaveBeenCalled();
  });

  it('documents support delivery without exposing Telegram routing as public build variables', () => {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    for (const name of ['SUPPORT_EMAIL_TO', 'SUPPORT_EMAIL_FROM', 'SUPPORT_TELEGRAM_CHAT_ID', 'SUPPORT_ADMIN_URL']) {
      expect(envExample).toContain(`${name}=`);
    }
    expect(envExample).not.toContain('NEXT_PUBLIC_SUPPORT_TELEGRAM_CHAT_ID');
    expect(envExample).not.toContain('NEXT_PUBLIC_SUPPORT_ADMIN_URL');
  });
});
