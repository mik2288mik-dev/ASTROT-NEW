import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getTelegramBotToken,
  isTelegramWebhookEnabled,
} from '../lib/telegramWebhookMode';
import webhookHandler from '../pages/api/telegram/webhook';

jest.mock('../lib/telegramBot', () => ({
  answerTelegramCallbackQuery: jest.fn(),
}));
jest.mock('../lib/starsPaymentService', () => ({
  processTelegramSuccessfulPayment: jest.fn(),
}));
jest.mock('../services/notificationRetentionService', () => ({
  handleNotificationCallback: jest.fn(),
}));

const mutableEnv = process.env as Record<string, string | undefined>;

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

describe('Telegram webhook runtime mode', () => {
  const names = [
    'BOT_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_ENABLED',
    'WEBHOOK_BASE_URL',
    'WEBHOOK_SECRET_TOKEN',
  ] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    for (const name of names) delete mutableEnv[name];
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  afterAll(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete mutableEnv[name];
      else mutableEnv[name] = value;
    }
  });

  it('keeps BOT_TOKEN outbound-only until webhook mode is explicit', async () => {
    mutableEnv.BOT_TOKEN = '123456:abcdefghijklmnopqrstuvwxyz_12345';
    expect(isTelegramWebhookEnabled()).toBe(false);

    const { response, result } = responseRecorder();
    await webhookHandler({ method: 'POST', headers: {}, body: {} } as unknown as NextApiRequest, response);

    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: 'TELEGRAM_WEBHOOK_DISABLED' });
  });

  it('uses the legacy token alias without leaving webhook authentication open', async () => {
    mutableEnv.TELEGRAM_BOT_TOKEN = '123456:abcdefghijklmnopqrstuvwxyz_12345';
    mutableEnv.TELEGRAM_WEBHOOK_ENABLED = '1';
    expect(getTelegramBotToken()).toBe(mutableEnv.TELEGRAM_BOT_TOKEN);

    const { response, result } = responseRecorder();
    await webhookHandler({ method: 'POST', headers: {}, body: {} } as unknown as NextApiRequest, response);

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'Forbidden' });
  });

  it('accepts an authenticated webhook only in enabled mode', async () => {
    const secret = 'w'.repeat(32);
    mutableEnv.TELEGRAM_BOT_TOKEN = '123456:abcdefghijklmnopqrstuvwxyz_12345';
    mutableEnv.WEBHOOK_BASE_URL = 'https://api.example.ru';
    mutableEnv.WEBHOOK_SECRET_TOKEN = secret;

    const { response, result } = responseRecorder();
    await webhookHandler({
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': secret },
      body: {},
    } as unknown as NextApiRequest, response);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });
});
