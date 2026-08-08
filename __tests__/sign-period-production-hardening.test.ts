import fs from 'fs';
import path from 'path';
import { getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey } from '../lib/date-utils';
import { getContentPolicy } from '../lib/contentMatrix';

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
});

describe('sign horoscope API access and cache contract', () => {
  it('keeps each shared cache on its natural generation cadence', () => {
    expect(getContentPolicy('sign_daily_horoscope').generationPolicy).toBe('once_per_day');
    expect(getContentPolicy('sign_weekly_horoscope').generationPolicy).toBe('once_per_week');
    expect(getContentPolicy('sign_monthly_horoscope').generationPolicy).toBe('once_per_month');
  });

  it('keeps Today free and cache-only GET returns a controlled not-ready response', async () => {
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } },
      getPool: jest.fn(),
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
    expect(source).toContain("VALUES ($1, $2, $3, $4, 'pro'");
    expect(source).toContain('ON CONFLICT (');
    expect(source).toContain('DO UPDATE SET');
    expect(source).not.toContain('user_id =');
    expect(source).not.toContain('chart_id =');
  });

  it('uses one batch lock builder in cron prewarm and every sign API', () => {
    for (const file of [
      'lib/horoscope/signPrewarm.ts',
      'pages/api/content/horoscope/sign-daily.ts',
      'pages/api/content/horoscope/sign-weekly.ts',
      'pages/api/content/horoscope/sign-monthly.ts',
    ]) {
      expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toContain('buildSignHoroscopeBatchLockKey');
    }
  });

  it('releases a failed cron slot so partial prewarm can retry', () => {
    const cron = fs.readFileSync(path.join(ROOT, 'pages/api/cron/tick.ts'), 'utf8');
    const prewarm = fs.readFileSync(path.join(ROOT, 'lib/horoscope/signPrewarm.ts'), 'utf8');
    expect(cron).toContain('lastRun.delete(job)');
    expect(prewarm).toContain('SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE');
    expect(prewarm).toContain("result.status.startsWith('failed:')");
  });

  it('refreshes sign period keys after midnight and when the app becomes visible', () => {
    const reader = fs.readFileSync(path.join(ROOT, 'views/v2/HoroscopeReader.tsx'), 'utf8');
    expect(reader).toContain('window.setInterval(refreshPeriodKeys, 60_000)');
    expect(reader).toContain("document.addEventListener('visibilitychange'");
    expect(reader).toContain('setToday(getMoscowTodayKey())');
  });

  it('keeps Telegram authentication on Premium cache polling after a 202', () => {
    const service = fs.readFileSync(path.join(ROOT, 'services/astrologyService.ts'), 'utf8');
    for (const marker of ['getCachedWeeklySignHoroscope', 'getCachedMonthlySignHoroscope']) {
      const start = service.indexOf(`export const ${marker}`);
      const end = service.indexOf('\nexport const ', start + 20);
      const implementation = service.slice(start, end > start ? end : undefined);
      expect(implementation).toContain("credentials: 'include'");
      expect(implementation).toContain('headers: getTelegramInitDataHeaders()');
    }
    expect(service).toContain('SIGN_BATCH_REQUEST_TIMEOUT_MS = 95_000');
    expect(service).toContain('SIGN_BATCH_POLL_TIMEOUT_MS = 90_000');
    expect(service).toContain("payload.code || payload.error");
  });
});
