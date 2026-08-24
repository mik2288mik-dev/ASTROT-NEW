import type { NextApiRequest, NextApiResponse } from 'next';
import createInvoiceHandler from '../pages/api/telegram/create-invoice';

jest.mock('../lib/adminAuth', () => ({
  AdminAuthError: class AdminAuthError extends Error {},
  handleAdminError: jest.fn(),
}));
jest.mock('../lib/auth/appAuth', () => ({
  requireTelegramPaymentUser: jest.fn(async () => ({ userId: '100' })),
}));
jest.mock('../lib/premiumPlanSettings', () => ({
  getManagedPremiumPlan: jest.fn(),
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

describe('Telegram payment runtime mode', () => {
  const names = [
    'BOT_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_ENABLED',
    'WEBHOOK_BASE_URL',
    'WEBHOOK_SECRET_TOKEN',
  ] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const previousFetch = global.fetch;

  beforeEach(() => {
    for (const name of names) delete mutableEnv[name];
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = previousFetch;
  });

  afterAll(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete mutableEnv[name];
      else mutableEnv[name] = value;
    }
  });

  it('never creates a real invoice when BOT_TOKEN is outbound-only', async () => {
    mutableEnv.BOT_TOKEN = '123456:abcdefghijklmnopqrstuvwxyz_12345';
    const { response, result } = responseRecorder();

    await createInvoiceHandler({
      method: 'POST',
      headers: {},
      body: { userId: '100', type: 'premium_month' },
      query: {},
    } as unknown as NextApiRequest, response);

    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      error: 'Telegram payments unavailable',
      code: 'TELEGRAM_PAYMENTS_UNAVAILABLE',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
