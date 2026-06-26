import fs from 'fs';
import path from 'path';
import { createAppSessionToken, createGuestIdentity, isGuestUserId, requireAppUser, verifyAppSessionToken } from '../lib/auth/appAuth';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const req = (headers: Record<string, string> = {}) => ({ headers, query: {}, body: {} } as any);

describe('app auth providers and API security', () => {
  beforeAll(() => { process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough'; });

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

  it('keeps Telegram priority and prepares a native bearer provider', async () => {
    const native = createAppSessionToken({ userId: '123', sessionId: 'native-session', provider: 'native' });
    await expect(requireAppUser(req({ authorization: `Bearer ${native}` }), { expectedUserId: '123' })).resolves.toMatchObject({ provider: 'native', isGuest: false });
    expect(read('lib/auth/appAuth.ts')).toContain("if (header(req, 'x-telegram-init-data'))");
    expect(read('services/sessionService.ts')).toContain('getTelegramInitDataHeaders');
  });

  it('keeps shared sign products public and protects private products with server identity', () => {
    for (const file of ['pages/api/content/horoscope/sign-daily.ts', 'pages/api/content/horoscope/sign-weekly.ts', 'pages/api/content/synastry/sign-compatibility.ts']) {
      expect(read(file)).not.toContain('requireAppUser');
    }
    for (const file of ['pages/api/content/today/home.ts', 'pages/api/content/synastry/extended.ts']) expect(read(file)).toContain('requireAppUser');
    expect(read('lib/natalReading/apiHelper.ts')).toContain('requireAppUser');
  });

  it('/api/users/me uses session identity and chart routes enforce ownership', () => {
    const me = read('pages/api/users/me.ts');
    expect(me).toContain('requireAppUser');
    expect(me).not.toContain('req.query.userId');
    expect(me).not.toContain('req.body?.userId');
    for (const file of ['pages/api/charts/index.ts', 'pages/api/charts/[id].ts', 'pages/api/charts/chart/[chartId].ts', 'pages/api/charts/set-primary.ts']) expect(read(file)).toContain('requireAppUser');
    expect(read('pages/api/charts/chart/[chartId].ts')).toContain('Chart does not belong to user');
    expect(read('lib/natalReading/apiHelper.ts')).toContain('String(chart.user_id) === String(userId)');
    expect(read('lib/todayPulseResolver.ts')).not.toContain('chartDataFallback || primaryChart?.chart_data');
  });

  it('never grants trial or trusts client Premium for a web guest', () => {
    expect(read('pages/api/users/[id].ts')).toContain('!existingUser && !appUser.isGuest');
    expect(read('lib/contentArchitecture.ts')).toContain('if (isGuestUserId(userId)) return { isPremium: false');
    expect(read('pages/api/content/natal/human-section.ts')).not.toContain('entitlement.isPremium || profile?.isPremium');
    expect(read('pages/api/content/natal/human-daily.ts')).not.toContain('if (profile?.isPremium)');
  });

  it('does not auto-repair or calculate a chart during primary chart reads', () => {
    const route = read('pages/api/charts/[id].ts');
    expect(route).not.toContain('repairCanonicalChartForUser');
    expect(route).not.toContain('const repaired = await');
    expect(route).toContain("return res.status(404).json({ error: 'Chart not found' });");
  });

  it('sends Telegram auth headers and web guest cookies for natal chart requests', () => {
    const chartService = read('services/chartService.ts');
    expect(chartService).toContain('...getTelegramInitDataHeaders()');
    // All four chart requests must carry auth: the two writes (calculate / force-recalculate)
    // AND the two reads (getChartFromDB / getPrimaryChartId). The reads previously omitted the
    // header, so /api/charts/:id returned 401 for Telegram users with no cookie session — which
    // made getOrCalculateChart throw before calculating and blocked new users from adding a chart.
    expect(chartService.match(/credentials: 'include'/g)).toHaveLength(4);
    expect(chartService.match(/\.\.\.getTelegramInitDataHeaders\(\)/g)).toHaveLength(4);
    // The storage-layer chart read must authenticate too, so a 401 is never mistaken for a 404.
    expect(read('services/storageService.ts')).toContain(
      "{ method: 'GET', credentials: 'include', headers: { ...getTelegramInitDataHeaders() } }"
    );
  });

  it('boots the dashboard through guest session when Telegram is unavailable', () => {
    expect(read('services/storageService.ts')).toContain('ensureWebGuestSession');
    expect(read('App.tsx')).toContain('bootstrapping signed web guest session');
    expect(read('App.tsx')).not.toContain('Открой Lumia через Telegram Mini App и попробуй ещё раз');
  });

  it('creates web guests with the light theme and without Premium or trial', () => {
    const auth = read('lib/auth/appAuth.ts');
    expect(auth).toContain("name: 'Гость', language: 'ru', theme: 'light', is_setup: false");
    expect(auth).toContain('is_premium: false, premium_until: null, trial_started_at: null');
  });
});
