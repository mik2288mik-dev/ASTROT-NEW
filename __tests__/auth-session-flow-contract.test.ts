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
    const deleteStart = app.indexOf('const handleDeleteAccount = useCallback(async () => {');
    const serverDelete = app.indexOf('await deleteCurrentAccount()', deleteStart);
    const resetAfterDelete = app.indexOf("await resetLocalAccountState(\n            'deleted'", serverDelete);
    const resetStart = app.indexOf('const resetLocalAccountState = useCallback(async (');
    const clearLocalData = app.indexOf('clearAppSessionAndLocalData()', resetStart);
    const persistMode = app.indexOf('setAuthSessionMode(nextMode)', clearLocalData);

    expect(logoutStart).toBeGreaterThan(-1);
    expect(serverLogout).toBeGreaterThan(logoutStart);
    expect(resetAfterLogout).toBeGreaterThan(serverLogout);
    expect(deleteStart).toBeGreaterThan(-1);
    expect(serverDelete).toBeGreaterThan(deleteStart);
    expect(resetAfterDelete).toBeGreaterThan(serverDelete);
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
    expect(resetBody).toContain('clearAppSessionAndLocalData()');
    expect(resetBody).toContain('clearNativeProviderCredentialState()');
    expect(resetBody).toContain('await Promise.allSettled([');
    expect(resetBody).toContain('setProfile(null)');
  });

  it('uses the canonical profile id for onboarding instead of Telegram launch metadata', () => {
    const app = read('App.tsx');

    expect(app).toContain('const canonicalUserId = String(storedProfile.id)');
    expect(app).toContain('const safeUserId = String(currentProfileId)');
    expect(app).not.toContain('hasTelegramUserId ? tgId : currentProfileId');
    expect(read('services/storageService.ts')).toContain("const url = '/api/users/me'");
  });

  it('routes a fresh account directly to birth data without persisting a fake guest name', () => {
    const app = read('App.tsx');
    const onboarding = read('views/Onboarding.tsx');
    const incompleteStart = app.indexOf('if (!updatedProfile.isSetup) {');
    const incompleteEnd = app.indexOf('const localEntry =', incompleteStart);
    const incompleteProfileBranch = app.slice(incompleteStart, incompleteEnd);
    const displayNameStart = app.indexOf('function getTelegramDisplayName');
    const displayNameEnd = app.indexOf('function normalizeStartupProfile', displayNameStart);
    const displayNameResolver = app.slice(displayNameStart, displayNameEnd);

    expect(incompleteStart).toBeGreaterThan(-1);
    expect(incompleteProfileBranch).toMatch(
      /showStartupDashboard\(['"]onboarding['"]\)|setView\(['"]onboarding['"]\)/,
    );
    expect(incompleteProfileBranch).not.toContain("showStartupDashboard('dashboard')");
    expect(app).toContain('initialStep="birth"');
    expect(onboarding).toMatch(/initialStep[^\n]*(?:stories|birth)/);
    expect(onboarding).not.toContain("useState<'stories'|'birth'>");
    expect(displayNameResolver).not.toMatch(/['"](?:guest|\u0413\u043e\u0441\u0442\u044c)['"]/i);
    const persistence = read('lib/natalChartPersistence.ts');
    expect(persistence).toContain('db.users.updateExisting(args.userId');
    expect(persistence).toContain('db.users.get(args.userId, { hydratePrimaryChart: false })');
    expect(persistence).toContain('const existing = syncSelfBirthTime');
    expect(persistence).toContain("if (!existing) throw new Error('ACCOUNT_NO_LONGER_EXISTS')");
    expect(persistence).not.toContain('db.users.set(args.userId');
    expect(read('pages/api/users/[id].ts')).toContain(
      'if(data.isSetup!==undefined)dbUser.is_setup=data.isSetup===true;',
    );
  });

  it('uses channel-filtered Android providers and contextual Telegram login without guest fallback', () => {
    const gate = read('views/AuthGate.tsx');
    const app = read('App.tsx');

    expect(gate).toContain('Продолжить с Яндексом');
    expect(gate).toContain('Продолжить с VK ID');
    expect(gate).toContain('registerEmailPassword');
    expect(gate).toContain('loginWithEmailPassword');
    expect(gate).toContain('requestPasswordReset');
    expect(gate).toContain('IDENTITY_ALREADY_LINKED');
    expect(gate).toContain('PROVIDERS.filter');
    expect(gate).toContain('hasTelegramMiniAppContext()');
    expect(gate).toContain('loginWithTelegram');
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
    expect(app).toContain('clearAppSessionAndLocalData()');
    expect(app).toContain('await Promise.allSettled([');
    expect(app).toContain('Этот аккаунт заблокирован.');
    expect(apiClient).toContain('export const APP_SESSION_INVALIDATED_EVENT');
    expect(apiClient).toContain('window.dispatchEvent(new CustomEvent(APP_SESSION_INVALIDATED_EVENT');
    expect(app).toContain('window.addEventListener(APP_SESSION_INVALIDATED_EVENT');
    expect(app).toContain('window.removeEventListener(APP_SESSION_INVALIDATED_EVENT');
    expect(app).toContain("detail?.code === 'ACCOUNT_BLOCKED'");
    const invalidationStart = app.indexOf('const handleInvalidatedSession = (event: Event) => {');
    const invalidationEnd = app.indexOf('window.addEventListener(APP_SESSION_INVALIDATED_EVENT', invalidationStart);
    const invalidationHandler = app.slice(invalidationStart, invalidationEnd);
    expect(invalidationStart).toBeGreaterThan(-1);
    expect(invalidationHandler).toContain("detail?.code === 'ACCOUNT_BLOCKED'");
    expect(invalidationHandler).toContain("resetLocalAccountState(\n                'signed_out'");
  });

  it('protects legacy Telegram data routes with the canonical account session', () => {
    for (const route of [
      'pages/api/content/natal/anchor.ts',
      'pages/api/content/natal/full.ts',
      'pages/api/content/natal/living.ts',
      'pages/api/content/natal/planet-insight.ts',
      'pages/api/premium/entitlement/check.ts',
      'pages/api/subscriptions/premium.ts',
      'pages/api/users/referral/claim.ts',
    ]) {
      const source = read(route);
      expect(source).toContain('requireAppUser');
      expect(source).not.toContain('requireTelegramUserId');
    }
    for (const route of [
      'pages/api/users/notification-settings.ts',
      'pages/api/notifications/attribution.ts',
    ]) {
      const source = read(route);
      expect(source).toContain('requireAppUser');
      expect(source).toContain('allowGuest: false');
      expect(source).not.toContain('requireTelegramUserId');
    }
  });

  it('scopes notification attribution updates to the authenticated account', () => {
    const retention = read('services/notificationRetentionService.ts');
    const notificationEngine = read('services/notificationEngine.ts');

    expect(retention.match(/WHERE id = \$1 AND user_id = \$3/g)).toHaveLength(2);
    expect(notificationEngine).toContain('WHERE id = $1 AND user_id = $3');
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
