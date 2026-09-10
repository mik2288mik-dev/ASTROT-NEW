import fs from 'fs';
import path from 'path';
import { createAppSessionToken, createGuestIdentity, isGuestUserId, requireAppUser, verifyAppSessionToken } from '../lib/auth/appAuth';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const req = (headers: Record<string, string> = {}) => ({ headers, query: {}, body: {} } as any);
const originalDatabaseUrl = process.env.DATABASE_URL;

describe('app auth providers and API security', () => {
  beforeAll(() => {
    process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';
    delete process.env.DATABASE_URL;
  });
  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('creates and verifies a stable signed web guest session without trusting client userId', async () => {
    const identity = createGuestIdentity();
    expect(isGuestUserId(identity.userId)).toBe(true);
    const token = createAppSessionToken({ ...identity, provider: 'web_guest' });
    expect(verifyAppSessionToken(token)).toMatchObject({ userId: identity.userId, provider: 'web_guest', sessionId: identity.sessionId });
    await expect(requireAppUser(req({ cookie: `lumia_app_session=${token}` }), { expectedUserId: '999', allowGuest: true }))
      .rejects.toMatchObject({ status: 403, code: 'USER_ID_MISMATCH' });
  });

  it('denies private/pro endpoints to guests while allowing guest-owned free endpoints', async () => {
    const token = createAppSessionToken({ userId: '-42', sessionId: 'guest-session', provider: 'web_guest' });
    const request = req({ cookie: `lumia_app_session=${token}` });
    await expect(requireAppUser(request, { expectedUserId: '-42', allowGuest: true })).resolves.toMatchObject({ provider: 'web_guest', isGuest: true });
    await expect(requireAppUser(request, { expectedUserId: '-42' })).rejects.toMatchObject({ status: 403, code: 'REGISTERED_ACCOUNT_REQUIRED' });
  });

  it('uses revocable app sessions and prepares a native bearer provider', async () => {
    const native = createAppSessionToken({ userId: '123', sessionId: 'native-session', provider: 'native' });
    await expect(requireAppUser(req({ authorization: `Bearer ${native}` }), { expectedUserId: '123' })).resolves.toMatchObject({ provider: 'native', isGuest: false });
    expect(read('lib/auth/appAuth.ts')).toContain('const explicitSessionSupplied = !!authorization || !!cookieToken');
    expect(read('lib/auth/appAuth.ts')).toContain('const payload = verifyAppSessionToken(bearer || cookieToken)');
    expect(read('lib/auth/appAuth.ts')).toContain(
      "} else if (options.allowTelegramProof !== false && header(req, 'x-telegram-init-data')) {"
    );
    expect(read('services/sessionService.ts')).toContain('getTelegramInitDataHeaders');
  });

  it('keeps daily sign content public while protecting Premium sign periods with app identity', () => {
    for (const file of ['pages/api/content/horoscope/sign-daily.ts', 'pages/api/content/synastry/sign-compatibility.ts']) {
      expect(read(file)).not.toContain('requireAppUser');
    }
    for (const file of ['pages/api/content/horoscope/sign-weekly.ts', 'pages/api/content/horoscope/sign-monthly.ts']) {
      const source = read(file);
      expect(source).toContain('requireAppUser(req, { allowGuest: true })');
      expect(source).toContain('getPremiumEntitlementState(userId)');
      expect(source).toContain("code: 'PREMIUM_REQUIRED'");
      expect(source).toContain('buildSignHoroscopeLockKey');
      expect(source).not.toContain("'Cache-Control', 'public");
    }
    expect(read('lib/horoscope/signGenerationLock.ts')).toContain(
      "period === 'day' ? 'free' : 'premium'",
    );
    expect(read('pages/api/content/forecast/personal.ts')).toContain('ensureValidContext');
    expect(read('pages/api/content/synastry/extended.ts')).toContain('requireAppUser');
    expect(read('lib/natalReading/apiHelper.ts')).toContain('requireAppUser');
  });

  it('/api/users/me uses session identity and chart routes enforce ownership', () => {
    const me = read('pages/api/users/me.ts');
    expect(me).toContain('requireAppUser');
    expect(me).not.toContain('req.query.userId');
    expect(me).not.toContain('req.body?.userId');
    for (const file of ['pages/api/charts/index.ts', 'pages/api/charts/[id].ts', 'pages/api/charts/chart/[chartId].ts', 'pages/api/charts/set-primary.ts']) expect(read(file)).toContain('requireAppUser');
    const chartById = read('pages/api/charts/chart/[chartId].ts');
    expect(chartById).toContain('String(chart.user_id) !== userId');
    expect(chartById).toContain("return res.status(404).json({ error: 'Chart not found' });");
    expect(read('pages/api/charts/index.ts')).not.toContain('expectedUserId: userId');
    expect(read('lib/natalReading/apiHelper.ts')).toContain('String(chart.user_id) === String(userId)');
    expect(read('lib/dailyAstroSignalResolver.ts')).not.toContain('chartDataFallback || primaryChart?.chart_data');
    for (const file of [
      'pages/api/content/natal/anchor.ts',
      'pages/api/content/natal/full.ts',
      'pages/api/content/natal/living.ts',
      'pages/api/content/natal/planet-insight.ts',
    ]) {
      expect(read(file)).toContain('String(chart.user_id) !== userId');
    }
  });

  it('requires an explicit strong app-session secret in production without BOT_TOKEN fallback', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const originalNodeEnv = mutableEnv.NODE_ENV;
    const originalAppSecret = mutableEnv.APP_SESSION_SECRET;
    const originalBotToken = mutableEnv.BOT_TOKEN;
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.APP_SESSION_SECRET;
    mutableEnv.BOT_TOKEN = 'telegram-bot-token-that-is-not-a-session-key';
    try {
      expect(() => createAppSessionToken({
        userId: '123',
        sessionId: 'production-session',
        provider: 'native',
      })).toThrow('APP_SESSION_SECRET must contain at least 32 bytes');
      mutableEnv.APP_SESSION_SECRET = 'replace-with-a-long-random-secret';
      expect(() => createAppSessionToken({
        userId: '123',
        sessionId: 'placeholder-session',
        provider: 'native',
      })).toThrow('APP_SESSION_SECRET must contain at least 32 bytes');
    } finally {
      if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = originalNodeEnv;
      if (originalAppSecret === undefined) delete mutableEnv.APP_SESSION_SECRET;
      else mutableEnv.APP_SESSION_SECRET = originalAppSecret;
      if (originalBotToken === undefined) delete mutableEnv.BOT_TOKEN;
      else mutableEnv.BOT_TOKEN = originalBotToken;
    }
  });

  it('rejects a production session key reused for another auth HMAC domain', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const previous = {
      nodeEnv: mutableEnv.NODE_ENV,
      app: mutableEnv.APP_SESSION_SECRET,
      email: mutableEnv.EMAIL_OTP_HASH_SECRET,
      rate: mutableEnv.AUTH_RATE_LIMIT_SECRET,
    };
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.APP_SESSION_SECRET = 'reused-production-auth-secret-at-least-32-bytes';
    mutableEnv.EMAIL_OTP_HASH_SECRET = mutableEnv.APP_SESSION_SECRET;
    mutableEnv.AUTH_RATE_LIMIT_SECRET = 'independent-rate-limit-secret-at-least-32-bytes';
    try {
      expect(() => createAppSessionToken({
        userId: '123',
        sessionId: 'reused-session-key',
        provider: 'native',
      })).toThrow('APP_SESSION_SECRET must be independent from auth HMAC secrets');
    } finally {
      for (const [key, value] of Object.entries({
        NODE_ENV: previous.nodeEnv,
        APP_SESSION_SECRET: previous.app,
        EMAIL_OTP_HASH_SECRET: previous.email,
        AUTH_RATE_LIMIT_SECRET: previous.rate,
      })) {
        if (value === undefined) delete mutableEnv[key];
        else mutableEnv[key] = value;
      }
    }
  });

  it('never grants trial or trusts client Premium for a web guest', () => {
    const profileRoute = read('pages/api/users/[id].ts');
    expect(profileRoute).toContain("if(!saved)return res.status(401).json({error:'APP_SESSION_REVOKED'");
    expect(profileRoute).not.toContain('NEW_USER_TRIAL_DAYS');
    expect(profileRoute).not.toContain('trial_started_at=');
    expect(profileRoute).not.toContain('premium_until=');
    expect(profileRoute).toContain('db.users.updateExisting(userId,dbUser)');
    expect(read('lib/db.ts')).toContain('WHERE id = $1 AND is_blocked = FALSE');
    expect(read('lib/contentArchitecture.ts')).toContain('user.is_guest !== false');
    expect(read('pages/api/content/natal/human-section.ts')).not.toContain('entitlement.isPremium || profile?.isPremium');
    expect(read('pages/api/content/forecast/personal.ts')).not.toContain('if (profile?.isPremium)');
    const legacyPremium = read('pages/api/subscriptions/premium.ts');
    expect(legacyPremium).toContain('PREMIUM_ACTIVATION_ROUTE_RETIRED');
    expect(legacyPremium).not.toContain("baseDate.getTime() + 7 * 24 * 60 * 60 * 1000");
  });

  it('repairs primary charts on reads and reports an incomplete birth profile explicitly', () => {
    const route = read('pages/api/charts/[id].ts');
    expect(route).toContain('repairCanonicalChartForUser');
    expect(route).toContain("code:'BIRTH_PROFILE_INCOMPLETE'");
    expect(route).toContain('Заполни дату и место рождения в профиле');
    expect(route).toContain("code:'EPHEMERIS_UNAVAILABLE'");
  });

  it('sends Telegram auth headers and web guest cookies for natal chart requests', () => {
    const chartService = read('services/chartService.ts');
    expect(chartService).toContain('...getTelegramInitDataHeaders()');
    // All three chart call sites must carry auth: the shared write path (calculate / force-recalculate)
    // AND the two reads (getChartFromDB / getPrimaryChartId). The reads previously omitted the
    // header, so /api/charts/:id returned 401 for Telegram users with no cookie session — which
    // made getOrCalculateChart throw before calculating and blocked new users from adding a chart.
    expect(chartService.match(/credentials:\s*'include'/g)).toHaveLength(3);
    expect(chartService.match(/\.\.\.getTelegramInitDataHeaders\(\)/g)).toHaveLength(3);
    // The storage-layer chart read must authenticate too, so a 401 is never mistaken for a 404.
    expect(read('services/storageService.ts')).toContain(
      "{ method: 'GET', credentials: 'include', headers: { ...getTelegramInitDataHeaders() } }"
    );
  });

  it('does not silently create a native guest and keeps web guest compatibility explicit', () => {
    expect(read('services/storageService.ts')).toContain('ensureWebGuestSession');
    expect(read('App.tsx')).toContain('storedProfile = await startGuestAccount()');
    expect(read('App.tsx')).toContain("sessionMode === 'guest' || (!isNativeAppRuntime() && sessionMode === 'automatic')");
    expect(read('App.tsx')).not.toContain('onContinueGuest=');
    expect(read('App.tsx')).not.toContain('Открой Lumia через Telegram Mini App и попробуй ещё раз');
  });

  it('creates web guests with the light theme and without Premium or trial', () => {
    const auth = read('lib/auth/appAuth.ts');
    expect(auth).toContain("name: 'Гость', language: 'ru', theme: 'light', is_setup: false");
    expect(auth).toContain('is_premium: false, premium_until: null, trial_started_at: null');
  });
});
