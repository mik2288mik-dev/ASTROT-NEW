describe('waitForTelegramInitData', () => {
  const fakeWindow = (webApp: { initData: string }) => ({
    Telegram: { WebApp: webApp },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as any).window;
  });

  it('returns initData immediately when available', async () => {
    (global as any).window = fakeWindow({ initData: 'query_id=1&user=%7B%7D&hash=abc' });

    const { waitForTelegramInitData } = await import('../services/sessionService');
    await expect(waitForTelegramInitData({ maxAttempts: 3, delayMs: 100 })).resolves.toBe(
      'query_id=1&user=%7B%7D&hash=abc'
    );
  });

  it('polls until initData appears', async () => {
    const webApp = { initData: '' };
    (global as any).window = fakeWindow(webApp);

    const { waitForTelegramInitData } = await import('../services/sessionService');
    const promise = waitForTelegramInitData({ maxAttempts: 5, delayMs: 100 });

    await jest.advanceTimersByTimeAsync(250);
    webApp.initData = 'signed-data';
    await jest.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe('signed-data');
  });

  it('returns null after timeout when initData never appears', async () => {
    (global as any).window = fakeWindow({ initData: '' });

    const { waitForTelegramInitData } = await import('../services/sessionService');
    const promise = waitForTelegramInitData({ maxAttempts: 3, delayMs: 100 });

    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeNull();
  });
});
