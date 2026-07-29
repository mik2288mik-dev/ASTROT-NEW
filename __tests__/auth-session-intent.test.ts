type MemoryStorage = Storage & {
  snapshot: () => Record<string, string>;
};

function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
    snapshot: () => Object.fromEntries(values),
  };
}

function installWindow(options?: {
  initData?: string;
  storedMode?: string;
}): MemoryStorage {
  const storage = createMemoryStorage(
    options?.storedMode
      ? { lumia_auth_session_mode_v1: options.storedMode }
      : {}
  );

  Object.defineProperty(global, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
      Telegram: {
        WebApp: {
          initData: options?.initData ?? ' signed-telegram-init-data ',
        },
      },
    },
  });

  return storage;
}

describe('auth session intent', () => {
  afterEach(() => {
    delete (global as any).window;
    jest.resetModules();
  });

  it('uses Telegram launch data by default without changing persisted state', async () => {
    const storage = installWindow();
    const intent = await import('../services/authSessionIntent');

    expect(intent.getAuthSessionMode()).toBe('automatic');
    expect(intent.getActiveTelegramInitData()).toBe('signed-telegram-init-data');
    expect(intent.getRawTelegramInitData()).toBe('signed-telegram-init-data');
    expect(intent.hasTelegramMiniAppContext()).toBe(true);
    expect(storage.snapshot()).toEqual({});
  });

  it('persists guest mode and suppresses Telegram auth on ordinary requests', async () => {
    const storage = installWindow();
    const intent = await import('../services/authSessionIntent');

    intent.setAuthSessionMode('guest');

    expect(storage.getItem(intent.AUTH_SESSION_MODE_STORAGE_KEY)).toBe('guest');
    expect(intent.getAuthSessionMode()).toBe('guest');
    expect(intent.getActiveTelegramInitData()).toBeNull();
    expect(intent.getRawTelegramInitData()).toBe('signed-telegram-init-data');
    expect(intent.requiresExplicitAuthentication()).toBe(false);
  });

  it('keeps an explicitly restored account on its app session without Telegram fallback', async () => {
    installWindow();
    const intent = await import('../services/authSessionIntent');
    intent.setAuthSessionMode('account');

    expect(intent.getAuthSessionMode()).toBe('account');
    expect(intent.getActiveTelegramInitData()).toBeNull();
    expect(intent.shouldUseTelegramSession()).toBe(false);
    expect(intent.requiresExplicitAuthentication()).toBe(false);
  });

  it.each(['signed_out', 'deleted'] as const)(
    'keeps %s mode across a reload and blocks automatic Telegram re-entry',
    async (mode) => {
      installWindow({ storedMode: mode });
      const firstLoad = await import('../services/authSessionIntent');

      expect(firstLoad.getAuthSessionMode()).toBe(mode);
      expect(firstLoad.getActiveTelegramInitData()).toBeNull();
      expect(firstLoad.requiresExplicitAuthentication()).toBe(true);

      jest.resetModules();
      const afterReload = await import('../services/authSessionIntent');
      expect(afterReload.getAuthSessionMode()).toBe(mode);
      expect(afterReload.getActiveTelegramInitData()).toBeNull();
    }
  );

  it('allows explicit Telegram login to read raw proof before switching modes', async () => {
    installWindow({ storedMode: 'signed_out' });
    const intent = await import('../services/authSessionIntent');

    expect(intent.getActiveTelegramInitData()).toBeNull();
    expect(intent.getRawTelegramInitData()).toBe('signed-telegram-init-data');

    intent.setAuthSessionMode('telegram');

    expect(intent.getActiveTelegramInitData()).toBe('signed-telegram-init-data');
    expect(intent.requiresExplicitAuthentication()).toBe(false);
  });

  it('falls back safely for an invalid stored value and without a browser', async () => {
    installWindow({ storedMode: 'unexpected-mode' });
    const browserIntent = await import('../services/authSessionIntent');

    expect(browserIntent.getAuthSessionMode()).toBe('automatic');

    delete (global as any).window;
    jest.resetModules();
    const serverIntent = await import('../services/authSessionIntent');

    expect(serverIntent.getAuthSessionMode()).toBe('automatic');
    expect(serverIntent.getRawTelegramInitData()).toBeNull();
    expect(serverIntent.getActiveTelegramInitData()).toBeNull();
  });

  it('can restore the first-launch automatic mode', async () => {
    const storage = installWindow({ storedMode: 'guest' });
    const intent = await import('../services/authSessionIntent');

    intent.resetAuthSessionMode();

    expect(storage.getItem(intent.AUTH_SESSION_MODE_STORAGE_KEY)).toBeNull();
    expect(intent.getAuthSessionMode()).toBe('automatic');
  });

  it('keeps the current opening signed out when WebView storage is unavailable', async () => {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('storage unavailable');
        },
        Telegram: { WebApp: { initData: 'signed-telegram-init-data' } },
      },
    });
    const intent = await import('../services/authSessionIntent');

    intent.setAuthSessionMode('signed_out');

    expect(intent.getAuthSessionMode()).toBe('signed_out');
    expect(intent.getActiveTelegramInitData()).toBeNull();
  });
});
