import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs
  .readFileSync(path.join(ROOT, file), 'utf8')
  .replace(/\r\n/g, '\n');

describe('explicit authentication flow contracts', () => {
  it('keeps logout and deletion on an explicit AuthGate across reloads', () => {
    const app = read('App.tsx');
    const logoutStart = app.indexOf('const handleLogout = useCallback(async () => {');
    const serverLogout = app.indexOf('await logoutCurrentAccount()', logoutStart);
    const resetAfterLogout = app.indexOf("await resetLocalAccountState(\n            'signed_out'", serverLogout);
    const resetStart = app.indexOf('const resetLocalAccountState = useCallback(async (');
    const clearLocalData = app.indexOf('await clearAppSessionAndLocalData()', resetStart);
    const persistMode = app.indexOf('setAuthSessionMode(nextMode)', clearLocalData);

    expect(logoutStart).toBeGreaterThan(-1);
    expect(serverLogout).toBeGreaterThan(logoutStart);
    expect(resetAfterLogout).toBeGreaterThan(serverLogout);
    expect(clearLocalData).toBeGreaterThan(resetStart);
    expect(persistMode).toBeGreaterThan(clearLocalData);
    expect(app).toContain('requiresExplicitAuthentication(authSessionMode)');
    expect(app).toContain("deleted={authSessionMode === 'deleted'}");
    expect(app).not.toContain('setStartupRetryNonce((value) => value + 1);\n    }, [resetLocalAccountState]);');
  });

  it('clears account-scoped forecast and natal caches before showing the gate', () => {
    const app = read('App.tsx');
    const resetStart = app.indexOf('const resetLocalAccountState = useCallback(async (');
    const resetEnd = app.indexOf('const handleDeleteAccount', resetStart);
    const resetBody = app.slice(resetStart, resetEnd);

    expect(resetBody).toContain('clearLocalNatalChart(profile)');
    expect(resetBody).toContain('clearLocalHumanBaseReport(profile)');
    expect(resetBody).toContain('clearHumanReadingSessionCache(String(profile.id))');
    expect(resetBody).toContain('clearPersonalForecastSessionCache()');
    expect(resetBody).toContain('setProfile(null)');
  });

  it('uses the canonical profile id for onboarding instead of Telegram launch metadata', () => {
    const app = read('App.tsx');

    expect(app).toContain('const canonicalUserId = String(storedProfile.id)');
    expect(app).toContain('const safeUserId = String(currentProfileId)');
    expect(app).not.toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(read('services/storageService.ts')).toContain("const url = '/api/users/me'");
  });

  it('uses the Android-first RuStore account gate without making Telegram or guest mandatory', () => {
    const gate = read('views/AuthGate.tsx');
    const app = read('App.tsx');

    expect(gate).not.toContain('Продолжить с Google');
    expect(gate).toContain('Продолжить с Яндексом');
    expect(gate).toContain('Продолжить с VK ID');
    expect(gate).toContain('registerEmailPassword');
    expect(gate).toContain('loginWithEmailPassword');
    expect(gate).toContain('requestPasswordReset');
    expect(gate).toContain('IDENTITY_ALREADY_LINKED');
    expect(gate).not.toContain('Войти через Telegram');
    expect(gate).not.toContain('Продолжить как гость');
    expect(app).toContain("!isNativeAppRuntime() && sessionMode === 'automatic'");
  });

  it('suppresses Telegram launch proof for normal signed-out and guest requests', () => {
    const apiClient = read('services/apiClient.ts');
    const sessionService = read('services/sessionService.ts');

    expect(apiClient).toContain('requiresExplicitAuthentication');
    expect(apiClient).not.toContain('getActiveTelegramInitData');
    expect(apiClient).toContain('never as a global fallback');
    expect(sessionService).toContain('getActiveTelegramInitData');
    expect(sessionService).toContain('getRawTelegramInitData');
    expect(sessionService).not.toContain('typeof window === \'undefined\' || getTelegramInitData()');
  });

  it('treats a blocked account as a terminal signed-out state', () => {
    const app = read('App.tsx');
    const storage = read('services/storageService.ts');
    const apiClient = read('services/apiClient.ts');

    expect(storage).toContain('isProfileBlockedError');
    expect(storage).toContain("error.code === 'ACCOUNT_BLOCKED'");
    expect(apiClient).toContain("'ACCOUNT_BLOCKED'");
    expect(app).toContain('if (isProfileBlockedError(error))');
    expect(app).toContain('await clearAppSessionAndLocalData()');
    expect(app).toContain('Этот аккаунт заблокирован.');
  });

  it('refreshes the canonical profile after linking Telegram to a guest', () => {
    const settings = read('views/Settings.tsx');
    const authService = read('services/accountAuthService.ts');

    expect(settings).toContain('.then(async (fresh) => {');
    expect(settings).toContain('onUpdate(fresh)');
    expect(authService).toContain("setAuthSessionMode('telegram')");
    expect(authService).toContain("'/api/auth/telegram/link'");
  });
});

describe('explicit Telegram login client', () => {
  const originalWindow = (global as any).window;

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.dontMock('../services/apiClient');
    jest.dontMock('../services/nativeSessionStore');
    if (originalWindow === undefined) delete (global as any).window;
    else (global as any).window = originalWindow;
  });

  function installTelegramWindow() {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        localStorage,
        Telegram: { WebApp: { initData: ' signed-login-proof ' } },
      },
    });
  }

  it('uses raw Telegram proof explicitly and changes mode only after server success', async () => {
    jest.resetModules();
    installTelegramWindow();
    const intent = await import('../services/authSessionIntent');
    intent.setAuthSessionMode('signed_out');

    const apiFetch = jest.fn(async () => new Response(JSON.stringify({
      profile: { id: '-42', name: 'Mik', isGuest: false },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    jest.doMock('../services/apiClient', () => ({
      apiFetch,
      apiUrl: (value: string) => value,
      isNativeAppRuntime: () => false,
    }));
    jest.doMock('../services/nativeSessionStore', () => ({
      nativeSessionStore: { setToken: jest.fn() },
    }));

    const { loginWithTelegram } = await import('../services/accountAuthService');
    await expect(loginWithTelegram()).resolves.toMatchObject({ id: '-42' });

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/telegram/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ initData: 'signed-login-proof', native: false }),
    }));
    expect(intent.getAuthSessionMode()).toBe('telegram');
  });

  it('does not clear signed-out intent when Telegram login is rejected', async () => {
    jest.resetModules();
    installTelegramWindow();
    const intent = await import('../services/authSessionIntent');
    intent.setAuthSessionMode('signed_out');

    jest.doMock('../services/apiClient', () => ({
      apiFetch: jest.fn(async () => new Response(JSON.stringify({
        code: 'TELEGRAM_AUTH_FAILED',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })),
      apiUrl: (value: string) => value,
      isNativeAppRuntime: () => false,
    }));
    jest.doMock('../services/nativeSessionStore', () => ({
      nativeSessionStore: { setToken: jest.fn() },
    }));

    const { loginWithTelegram } = await import('../services/accountAuthService');
    await expect(loginWithTelegram()).rejects.toMatchObject({
      code: 'TELEGRAM_AUTH_FAILED',
      status: 401,
    });
    expect(intent.getAuthSessionMode()).toBe('signed_out');
  });
});
