import fs from 'fs';
import path from 'path';
import { getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey } from '../lib/date-utils';
import { getContentPolicy } from '../lib/contentMatrix';
import { ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');

function responseMock() {
  const result: { statusCode: number; body: any; headers: Record<string, string> } = {
    statusCode: 200,
    body: null,
    headers: {},
  };
  const response = {
    status(code: number) { result.statusCode = code; return response; },
    json(body: any) { result.body = body; return response; },
    setHeader(name: string, value: string) { result.headers[name] = value; },
  };
  return { response: response as any, result };
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('../lib/db');
  jest.dontMock('../lib/auth/appAuth');
  jest.dontMock('../lib/contentArchitecture');
  jest.dontMock('../lib/contentGenerationLock');
  jest.dontMock('../lib/horoscope/signGeneration');
  jest.dontMock('../lib/horoscope/signPrewarm');
  jest.dontMock('../lib/horoscope/signCache');
});

describe('sign horoscope API access and cache contract', () => {
  it.each([
    ['daily', 'day', getMoscowTodayKey(), 'SIGN_HOROSCOPE_NOT_READY'],
    ['weekly', 'week', getMoscowIsoWeekKey(), 'SIGN_WEEKLY_NOT_READY'],
    ['monthly', 'month', getMoscowMonthKey(), 'SIGN_MONTHLY_NOT_READY'],
  ])('all 12 signs support repeated GET/POST %s reads without generation, including an empty cache', async (route, period, periodKey, code) => {
    const reading = {
      schemaVersion: 'sign-horoscope-reading-v5', sign: 'Aries', period, periodKey,
      headline: 'Choose the useful answer', text: 'Ask plainly and agree on the meeting time.',
    };
    const query = jest.fn().mockResolvedValue({ rows: [{ payload: reading }] });
    const generate = jest.fn();
    const requireAppUser = jest.fn().mockResolvedValue({ userId: '42' });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    jest.doMock('../lib/horoscope/signGeneration', () => ({ generateSignHoroscopeBatch: generate }));
    jest.doMock('../lib/auth/appAuth', () => ({ requireAppUser }));
    jest.doMock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: true }) }));
    const handler = require(`../pages/api/content/horoscope/sign-${route}`).default;
    const source = { sign: 'Aries', date: periodKey, periodKey, language: 'ru' };
    for (const sign of ZODIAC_KEYS) {
      const signReading = { ...reading, sign };
      query.mockResolvedValue({ rows: [{ payload: signReading }] });
      for (const method of ['GET', 'POST', 'POST', 'GET']) {
        const result = responseMock();
        await handler({ method, query: { ...source, sign }, body: { ...source, sign } } as any, result.response);
        expect(result.result).toMatchObject({ statusCode: 200, body: { reading: signReading, source: 'cache', stale: false } });
      }
    }
    if (route === 'daily') expect(requireAppUser).not.toHaveBeenCalled();
    query.mockResolvedValue({ rows: [] });
    const missing = responseMock();
    await handler({ method: 'POST', body: source } as any, missing.response);
    expect(missing.result).toMatchObject({ statusCode: 404, body: { code } });
    expect(generate).not.toHaveBeenCalled();
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });

  it('keeps each shared cache on its natural generation cadence', () => {
    expect(getContentPolicy('sign_daily_horoscope').generationPolicy).toBe('once_per_day');
    expect(getContentPolicy('sign_weekly_horoscope').generationPolicy).toBe('once_per_week');
    expect(getContentPolicy('sign_monthly_horoscope').generationPolicy).toBe('once_per_month');
  });

  it('keeps Today free and cache-only GET returns a controlled not-ready response', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } },
      getPool: () => ({ query }),
    }));
    const handler = require('../pages/api/content/horoscope/sign-daily').default;
    const result = responseMock();
    await handler({
      method: 'GET',
      query: { sign: 'Aries', date: getMoscowTodayKey(), language: 'en' },
    } as any, result.response);
    expect(result.result).toMatchObject({
      statusCode: 404,
      body: { code: 'SIGN_HOROSCOPE_NOT_READY' },
    });
  });

  it('rejects a foreign daily date before starting shared generation', async () => {
    const withContentGenerationLock = jest.fn();
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn(), set: jest.fn() } },
      getPool: jest.fn(),
    }));
    jest.doMock('../lib/contentGenerationLock', () => ({
      generationInProgressPayload: jest.fn(),
      withContentGenerationLock,
    }));
    const handler = require('../pages/api/content/horoscope/sign-daily').default;
    const result = responseMock();
    await handler({
      method: 'POST',
      body: { sign: 'Aries', date: '1900-01-01', language: 'en' },
    } as any, result.response);
    expect(result.result).toMatchObject({
      statusCode: 400,
      body: { code: 'PERIOD_NOT_CURRENT' },
    });
    expect(withContentGenerationLock).not.toHaveBeenCalled();
  });

  it.each([
    ['../pages/api/content/horoscope/sign-weekly', getMoscowIsoWeekKey()],
    ['../pages/api/content/horoscope/sign-monthly', getMoscowMonthKey()],
  ])('keeps Week/Month behind the existing Premium entitlement', async (modulePath, periodKey) => {
    const query = jest.fn();
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn(), set: jest.fn() } },
      getPool: () => ({ query }),
    }));
    jest.doMock('../lib/auth/appAuth', () => ({
      requireAppUser: jest.fn().mockResolvedValue({
        userId: '-42',
        sessionId: 'guest-session',
        provider: 'web_guest',
        isGuest: true,
      }),
    }));
    jest.doMock('../lib/contentArchitecture', () => ({
      getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: false }),
    }));
    const handler = require(modulePath).default;
    const result = responseMock();
    await handler({
      method: 'POST',
      body: { sign: 'Leo', periodKey, language: 'ru' },
    } as any, result.response);
    expect(result.result).toMatchObject({
      statusCode: 403,
      body: { code: 'PREMIUM_REQUIRED', premiumRequired: true },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['../pages/api/content/horoscope/sign-weekly', getMoscowIsoWeekKey()],
    ['../pages/api/content/horoscope/sign-monthly', getMoscowMonthKey()],
  ])('allows Premium cache reads but rejects a foreign period key', async (modulePath, currentPeriod) => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn(), set: jest.fn() } },
      getPool: () => ({ query }),
    }));
    jest.doMock('../lib/auth/appAuth', () => ({
      requireAppUser: jest.fn().mockResolvedValue({ userId: '42', isGuest: false }),
    }));
    jest.doMock('../lib/contentArchitecture', () => ({
      getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: true }),
    }));
    const handler = require(modulePath).default;

    const foreign = responseMock();
    await handler({
      method: 'GET',
      query: { sign: 'Leo', periodKey: '1900', language: 'ru' },
    } as any, foreign.response);
    expect(foreign.result).toMatchObject({ statusCode: 400, body: { code: 'PERIOD_NOT_CURRENT' } });

    const current = responseMock();
    await handler({
      method: 'GET',
      query: { sign: 'Leo', periodKey: currentPeriod, language: 'ru' },
    } as any, current.response);
    expect(current.result.statusCode).toBe(404);
    expect(query).toHaveBeenCalled();
  });

  it('stores Week/Month as shared Premium rows and refreshes an expired identity', () => {
    const source = fs.readFileSync(path.join(ROOT, 'lib/horoscope/signCache.ts'), 'utf8');
    expect(source).toContain("period === 'day' ? 'free' : 'pro'");
    expect(source).toContain('ON CONFLICT (');
    expect(source).toContain('DO UPDATE SET');
    expect(source).not.toContain('user_id =');
    expect(source).not.toContain('chart_id =');
  });

  it('keeps stable period locks in the monthly job and removes generation from ordinary cron and APIs', () => {
    const prewarm = fs.readFileSync(path.join(ROOT, 'lib/horoscope/signPrewarm.ts'), 'utf8');
    expect(prewarm).toContain('buildSignHoroscopeLockKey');
    const lock = fs.readFileSync(path.join(ROOT, 'lib/horoscope/signGenerationLock.ts'), 'utf8');
    expect(lock).not.toContain('sign: ZodiacKey');
    expect(lock).not.toContain('signHoroscopePromptVersion');
    const cron = fs.readFileSync(path.join(ROOT, 'pages/api/cron/tick.ts'), 'utf8');
    expect(cron).not.toContain('signPrewarm');
    for (const period of ['Daily', 'Weekly', 'Monthly']) {
      const reader = fs.readFileSync(path.join(ROOT, `lib/horoscope/sign${period}.ts`), 'utf8');
      expect(reader).not.toContain('getOrGenerate');
      expect(reader).not.toContain('signOrchestrator');
    }
    const orchestrator = fs.readFileSync(path.join(ROOT, 'lib/horoscope/signOrchestrator.ts'), 'utf8');
    expect(orchestrator).not.toContain('getOrGenerateSignHoroscope');
    for (const period of ['daily', 'weekly', 'monthly']) {
      const api = fs.readFileSync(path.join(ROOT, `pages/api/content/horoscope/sign-${period}.ts`), 'utf8');
      expect(api).not.toContain('getOrGenerate');
      expect(api).not.toContain('withContentGenerationLock');
    }
  });

  it('refreshes sign period keys after midnight and when the app becomes visible', () => {
    const reader = fs.readFileSync(path.join(ROOT, 'views/v2/HoroscopeReaderClassic.tsx'), 'utf8');
    expect(reader).toContain('window.setInterval(refreshPeriodKeys, 60_000)');
    expect(reader).toContain("document.addEventListener('visibilitychange'");
    expect(reader).toContain('setToday(getMoscowTodayKey())');
  });

  it('keeps Telegram authentication on Premium cache reads and removes client generation/polling', () => {
    const service = fs.readFileSync(path.join(ROOT, 'services/astrologyService.ts'), 'utf8');
    for (const marker of ['getCachedWeeklySignHoroscope', 'getCachedMonthlySignHoroscope']) {
      const start = service.indexOf(`export const ${marker}`);
      const end = service.indexOf('\nexport const ', start + 20);
      const implementation = service.slice(start, end > start ? end : undefined);
      expect(implementation).toContain("credentials: 'include'");
      expect(implementation).toContain('headers: getTelegramInitDataHeaders()');
    }
    expect(service).not.toContain('waitForCurrentSignHoroscope');
    expect(service).not.toContain('SIGN_HOROSCOPE_POLL_TIMEOUT_MS');
    expect(service).toContain("payload.code || payload.error");
  });
});

describe('dedicated monthly sign job', () => {
  const previousSecret = process.env.CRON_SECRET;
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  function setup() {
    process.env.CRON_SECRET = 'monthly-test-secret';
    const prewarmSignMonth = jest.fn().mockResolvedValue({ failed: 0, generated: 36 });
    const getCachedSignHoroscopes = jest.fn().mockResolvedValue({});
    jest.doMock('../lib/horoscope/signPrewarm', () => ({
      prewarmSignMonth,
      buildSignMonthPrewarmTargets: () => [{ period: 'day', periodKey: '2026-09-30' }],
    }));
    jest.doMock('../lib/horoscope/signCache', () => ({ getCachedSignHoroscopes }));
    const handler = require('../pages/api/cron/sign-month').default;
    return { handler, prewarmSignMonth, getCachedSignHoroscopes };
  }

  it('rejects unauthorized generation and invalid month keys', async () => {
    const { handler, prewarmSignMonth } = setup();
    const unauthorized = responseMock();
    await handler({ method: 'POST', headers: {}, body: {} }, unauthorized.response);
    expect(unauthorized.result.statusCode).toBe(401);
    const invalid = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer monthly-test-secret' }, body: { month: '1900-01' } }, invalid.response);
    expect(invalid.result.statusCode).toBe(400);
    expect(prewarmSignMonth).not.toHaveBeenCalled();
  });

  it('lets monitoring read month readiness without starting the provider', async () => {
    const { handler, prewarmSignMonth, getCachedSignHoroscopes } = setup();
    const result = responseMock();
    await handler({ method: 'GET', headers: { authorization: 'Bearer monthly-test-secret' }, query: {} }, result.response);
    expect(result.result).toMatchObject({ statusCode: 200, body: { totalTargets: 1, completeTargets: 0, complete: false } });
    expect(getCachedSignHoroscopes).toHaveBeenCalled();
    expect(prewarmSignMonth).not.toHaveBeenCalled();
  });

  it('starts one full month job and deduplicates another POST while it is running', async () => {
    const { handler, prewarmSignMonth } = setup();
    let finish!: (value: unknown) => void;
    prewarmSignMonth.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const request = { method: 'POST', headers: { authorization: 'Bearer monthly-test-secret' }, body: { month: getMoscowMonthKey() } };
    const first = responseMock();
    const second = responseMock();
    await handler(request, first.response);
    await handler(request, second.response);
    expect(first.result.statusCode).toBe(202);
    expect(second.result.statusCode).toBe(202);
    expect(prewarmSignMonth).toHaveBeenCalledTimes(1);
    expect(prewarmSignMonth).toHaveBeenCalledWith({ targetMonthKey: getMoscowMonthKey() });
    finish({ failed: 0 });
    await Promise.resolve();
  });
});
