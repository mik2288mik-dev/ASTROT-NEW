jest.mock('../lib/date-utils', () => ({
  getMoscowTodayKey: () => '2026-10-03',
  getMoscowIsoWeekKey: () => '2026-W40',
  getMoscowMonthKey: () => '2026-10',
}));
jest.mock('../lib/horoscope/signDaily', () => ({
  normalizeZodiacKey: () => 'Aries',
  getSignDailyHoroscopeSnapshot: jest.fn(),
}));
jest.mock('../lib/horoscope/signWeekly', () => ({ getSignWeeklyHoroscopeSnapshot: jest.fn() }));
jest.mock('../lib/horoscope/signMonthly', () => ({ getSignMonthlyHoroscopeSnapshot: jest.fn() }));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: jest.fn(async () => ({ userId: 'wire-user', provider: 'native', sessionId: 'installed-five', isGuest: false })) }));
jest.mock('../lib/db', () => ({ db: {}, getPool: () => ({ query: (...args: unknown[]) => readerQuery(...args) }) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: jest.fn() }));
jest.mock('../lib/requestTelemetry', () => ({ withRequestTelemetry: (_: string, handler: unknown) => handler }));

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSignDailyHoroscopeSnapshot } from '../lib/horoscope/signDaily';
import { getSignWeeklyHoroscopeSnapshot } from '../lib/horoscope/signWeekly';
import { getSignMonthlyHoroscopeSnapshot } from '../lib/horoscope/signMonthly';
import { getPremiumEntitlementState } from '../lib/contentArchitecture';
import daily from '../pages/api/content/horoscope/sign-daily';
import weekly from '../pages/api/content/horoscope/sign-weekly';
import monthly from '../pages/api/content/horoscope/sign-monthly';

const androidUa = 'Dalvik/2.1.0 (Linux; U; Android 13; M2101K9AG Build/test)';
const readerQuery = jest.fn();
const cases = [
  { handler: daily, snapshot: getSignDailyHoroscopeSnapshot, period: 'day', periodKey: '2026-10-03' },
  { handler: weekly, snapshot: getSignWeeklyHoroscopeSnapshot, period: 'week', periodKey: '2026-W40' },
  { handler: monthly, snapshot: getSignMonthlyHoroscopeSnapshot, period: 'month', periodKey: '2026-10' },
] as const;

describe.each(cases)('$period horoscope APK wire format', ({ handler, snapshot, period, periodKey }) => {
  const reading = { schemaVersion: 'sign-horoscope-reading-v5', sign: 'Aries', period, periodKey,
    headline: 'Свежий заголовок', text: 'Свежий текст текущего периода.' };

  beforeEach(() => {
    jest.clearAllMocks();
    readerQuery.mockResolvedValue({ rows: [] });
    (snapshot as jest.Mock).mockResolvedValue({ reading, stale: false });
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: true });
  });

  async function request(method: 'GET' | 'POST', schemaVersion?: unknown, userAgent = androidUa, installedSession = false) {
    const source = { sign: 'Aries', date: periodKey, periodKey,
      ...(schemaVersion === undefined ? {} : { schemaVersion }) };
    const result = { status: 200, body: null as any };
    const res = {
      status(code: number) { result.status = code; return res; },
      json(body: unknown) { result.body = body; return res; },
      setHeader: jest.fn(),
    } as unknown as NextApiResponse;
    await handler({ method, headers: { 'user-agent': userAgent, ...(installedSession ? { authorization: 'Bearer installed-five' } : {}) }, query: method === 'GET' ? source : {},
      body: method === 'POST' ? source : {} } as unknown as NextApiRequest, res);
    return result;
  }

  it.each(['GET', 'POST'] as const)('preserves fresh v4 data for the unmodified 1.0.4 %s request', async (method) => {
    const result = await request(method);
    expect(result.status).toBe(200);
    expect(result.body.reading).toEqual({ ...reading, schemaVersion: 'sign-horoscope-reading-v4' });
    expect(reading.schemaVersion).toBe('sign-horoscope-reading-v5');
  });

  it.each(['GET', 'POST'] as const)('delivers v5 to the explicitly negotiated Android %s request', async (method) => {
    const result = await request(method, 'sign-horoscope-reading-v5');
    expect(result.status).toBe(200);
    expect(result.body.reading).toBe(reading);
  });

  it.each(['GET', 'POST'] as const)('delivers v5 to the already installed 1.0.5 %s request without new query fields', async (method) => {
    readerQuery.mockResolvedValue({ rows: [{ payload: { appVersion: '1.0.5', versionCode: 8 } }] });
    const result = await request(method, undefined, androidUa, true);
    expect(result.status).toBe(200);
    expect(result.body.reading).toBe(reading);
    expect(readerQuery.mock.calls[0][1][2]).toBe('installed-five');
  });

  it('preserves v5 for ordinary browser requests', async () => {
    expect((await request('GET', undefined, 'Mozilla/5.0')).body.reading).toBe(reading);
  });

  it('rejects ambiguous formats before reading cached content', async () => {
    expect((await request('GET', ['sign-horoscope-reading-v4', 'sign-horoscope-reading-v5'])).status).toBe(400);
    expect(snapshot).not.toHaveBeenCalled();
  });

  if (period !== 'day') it('keeps Premium access checks for both formats', async () => {
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: false });
    expect((await request('GET')).status).toBe(403);
    expect((await request('GET', 'sign-horoscope-reading-v5')).status).toBe(403);
    expect(snapshot).not.toHaveBeenCalled();
  });
});
