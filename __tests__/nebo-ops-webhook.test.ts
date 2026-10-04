import type { NextApiRequest, NextApiResponse } from 'next';
import {
  acknowledgeAndRun,
  forwardNeboOpsRequest,
  isRepeatedTelegramUpdate,
  neboOpsWebhookBase,
} from '../lib/neboOpsWebhook';

const env = (values: Record<string, string>) => ({ NODE_ENV: 'test', ...values }) as NodeJS.ProcessEnv;

function response() {
  const res = {
    status: jest.fn(), json: jest.fn(), send: jest.fn(), end: jest.fn(), setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as NextApiResponse & typeof res;
}

describe('owner bot webhook routing', () => {
  it('registers webhooks on the relay host when this server talks to Telegram through it', () => {
    expect(neboOpsWebhookBase(env({
      NEBO_TELEGRAM_RELAY_URL: 'https://astrot-production.up.railway.app/api/internal/telegram',
      NEBO_OPS_PUBLIC_URL: 'https://api.tvoi-goroskop.ru',
    }))).toBe('https://astrot-production.up.railway.app');
    // The relay host itself keeps its public URL.
    expect(neboOpsWebhookBase(env({
      OPENAI_RELAY_DIRECT: '1', NEBO_TELEGRAM_RELAY_URL: 'https://relay.example.test/x',
      NEBO_OPS_PUBLIC_URL: 'https://api.tvoi-goroskop.ru',
    }))).toBe('https://api.tvoi-goroskop.ru');
    expect(neboOpsWebhookBase(env({ NEBO_OPS_WEBHOOK_BASE: 'https://hook.example.test/', NEBO_OPS_PUBLIC_URL: 'https://a.test' })))
      .toBe('https://hook.example.test');
    expect(neboOpsWebhookBase(env({ NEBO_OPS_PUBLIC_URL: 'http://insecure.test' }))).toBeNull();
  });

  it('handles each Telegram update once', () => {
    expect(isRepeatedTelegramUpdate('ops', 101)).toBe(false);
    expect(isRepeatedTelegramUpdate('ops', 101)).toBe(true);
    expect(isRepeatedTelegramUpdate('support', 101)).toBe(false);
    expect(isRepeatedTelegramUpdate('ops', undefined)).toBe(false);
  });

  it('acknowledges Telegram before slow work finishes', async () => {
    const res = response();
    let finished = false;
    acknowledgeAndRun(res, async () => { await Promise.resolve(); finished = true; }, 'test');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(finished).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(true);
  });
});

describe('forwarding owner updates from the relay host', () => {
  const originalEnv = process.env;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    process.env = { ...originalEnv, NEBO_OPS_WEBHOOK_FORWARD_URL: 'https://api.tvoi-goroskop.ru', NEBO_OPS_TELEGRAM_ENABLED: '0' };
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 } as Response);
  });
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });

  it('passes the update with its secret header to the owner server only', async () => {
    const req = {
      method: 'POST', url: '/api/telegram/owner-channel-webhook?channel=support',
      headers: { 'x-telegram-bot-api-secret-token': 'secret-value', host: 'evil.test' },
      body: { update_id: 5, message: { text: '/menu' } },
    } as unknown as NextApiRequest;
    const res = response();
    await expect(forwardNeboOpsRequest(req, res)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tvoi-goroskop.ru/api/telegram/owner-channel-webhook?channel=support');
    expect(init?.headers).toEqual({ 'x-telegram-bot-api-secret-token': 'secret-value', 'content-type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({ update_id: 5, message: { text: '/menu' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('asks Telegram to retry when the owner server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const res = response();
    await forwardNeboOpsRequest({ method: 'POST', url: '/api/telegram/ops-webhook', headers: {}, body: {} } as unknown as NextApiRequest, res);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('does nothing on a server without a forward target', async () => {
    delete process.env.NEBO_OPS_WEBHOOK_FORWARD_URL;
    await expect(forwardNeboOpsRequest({ method: 'POST', url: '/api/telegram/ops-webhook', headers: {}, body: {} } as unknown as NextApiRequest, response()))
      .resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
