import { ensureNeboOpsBotSetup, ensureNeboOwnerChannelBotSetup } from '../lib/neboOpsSettings';

const originalEnv = process.env;

function telegramResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

describe('owner channel bot setup diagnostics', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEBO_OPS_WEBHOOK_SECRET: 'a'.repeat(32),
      NEBO_OPS_PUBLIC_URL: 'https://api.example.test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('logs only the failed Telegram operation and status', async () => {
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(telegramResponse(401))
      .mockResolvedValueOnce(telegramResponse(200));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await ensureNeboOwnerChannelBotSetup(
      'payments',
      '123456:abcdefghijklmnopqrstuvwxyz_TEST',
    );

    expect(warn).toHaveBeenCalledWith(
      '[nebo-ops] payments bot setup failed: setWebhook_HTTP_401',
    );
  });

  it('reports a primary bot setup failure without logging its token', async () => {
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(telegramResponse(200))
      .mockResolvedValueOnce(telegramResponse(401));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await ensureNeboOpsBotSetup('123456:abcdefghijklmnopqrstuvwxyz_TEST');

    expect(warn).toHaveBeenCalledWith(
      '[nebo-ops] primary bot setup failed: setMyCommands_HTTP_401',
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('abcdefghijklmnopqrstuvwxyz_TEST'));
  });
});
