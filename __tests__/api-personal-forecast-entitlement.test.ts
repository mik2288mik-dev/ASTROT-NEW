const mockRequireAppUser = jest.fn();
const mockGetUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockGetCachedPersonalForecast = jest.fn();
const mockGetCompatibleStalePersonalForecast = jest.fn();
const mockEnsurePersonalForecast = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));
jest.mock('../lib/db', () => ({
  db: {
    users: {
      get: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: (...args: unknown[]) =>
    mockGetPremiumEntitlementState(...args),
}));
jest.mock('../lib/personalForecastCache', () => ({
  getCachedPersonalForecast: (...args: unknown[]) =>
    mockGetCachedPersonalForecast(...args),
  getCompatibleStalePersonalForecast: (...args: unknown[]) =>
    mockGetCompatibleStalePersonalForecast(...args),
  ensurePersonalForecast: (...args: unknown[]) =>
    mockEnsurePersonalForecast(...args),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/content/forecast/personal';
import { aiPersonalHoroscopeFixture } from './ai-personal-horoscope-fixture';

function responseMock(): {
  res: NextApiResponse;
  status: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
} {
  const json = jest.fn();
  const end = jest.fn();
  const status = jest.fn();
  const res = { status, json, end } as unknown as NextApiResponse;
  status.mockImplementation(() => res);
  return { res, status, json, end };
}

describe('personal horoscope API entitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({
      userId: '1001',
      provider: 'email',
      isGuest: false,
    });
    mockGetUser.mockResolvedValue({
      id: '1001',
      name: 'Mira',
      birth_date: '1990-01-01',
      birth_time: '12:00:00',
      birth_place: 'Москва',
      gender: 'female',
      is_setup: true,
      language: 'ru',
      theme: 'light',
      is_premium: false,
      premium_until: null,
      is_admin: false,
      login_streak: 0,
      chart_slots: 1,
    });
    mockGetPremiumEntitlementState.mockResolvedValue({
      isPremium: false,
      entitlement: null,
    });
    mockGetCachedPersonalForecast.mockResolvedValue(null);
    mockGetCompatibleStalePersonalForecast.mockResolvedValue(null);
  });

  it.each(['week', 'month'] as const)(
    'stops a Free %s cache miss before generation',
    async (period) => {
      const { res, status, json } = responseMock();
      const req = {
        method: 'POST',
        query: {},
        body: {
          userId: 'forged-user',
          chartId: 999,
          period,
        },
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(mockRequireAppUser).toHaveBeenCalledWith(req, { allowGuest: true });
      expect(mockGetUser).toHaveBeenCalledWith('1001', { hydratePrimaryChart: false });
      expect(status).toHaveBeenCalledWith(403);
      expect(mockGetCachedPersonalForecast).toHaveBeenCalledTimes(1);
      expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
      expect(json.mock.calls[0][0]).toMatchObject({
        code: 'PERSONAL_HOROSCOPE_PREMIUM_REQUIRED',
      });
    },
  );

  it('serves an existing cached week to Free as a locked period', async () => {
    mockGetCachedPersonalForecast.mockResolvedValueOnce({
      horoscope: aiPersonalHoroscopeFixture('week'),
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET',
      query: { period: 'week', periodKey: '2026-W30' },
      body: {},
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'PERSONAL_HOROSCOPE_PERIOD_KEY_INVALID',
    });
  });

  it.each(['day', 'week', 'month'] as const)(
    'reopens a current cached Premium %s without a new AI generation',
    async (period) => {
      const packageForPeriod = aiPersonalHoroscopeFixture(period);
      mockGetPremiumEntitlementState.mockResolvedValueOnce({
        isPremium: true,
        state: 'paid',
        entitlement: { status: 'paid' },
      });
      mockGetCachedPersonalForecast.mockResolvedValueOnce({
        horoscope: packageForPeriod,
      });
      const { res, status } = responseMock();
      const req = {
        method: 'GET',
        query: { period },
        body: {},
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
      if (status.mock.calls.some(([code]) => code === 200)) {
        expect(status).toHaveBeenCalledWith(200);
      }
    },
  );

  it('serves a compatible stale day immediately and refreshes it lazily', async () => {
    const horoscope = aiPersonalHoroscopeFixture('day');
    mockGetCompatibleStalePersonalForecast.mockResolvedValueOnce({ horoscope });
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready', value: horoscope, fromCache: false,
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET', query: { period: 'day' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({ source: 'stale' });
    expect(mockEnsurePersonalForecast).toHaveBeenCalledTimes(1);
  });

  it('generates on POST when the initial cache read is temporarily unavailable', async () => {
    const horoscope = aiPersonalHoroscopeFixture('day');
    mockGetCachedPersonalForecast.mockRejectedValueOnce(new Error('cache read offline'));
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready',
      value: horoscope,
      fromCache: false,
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: 'forged-user',
        chartId: 999,
        period: 'day',
      },
      headers: {},
    } as unknown as NextApiRequest;

    try {
      await handler(req, res);
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(200);
    expect(mockEnsurePersonalForecast).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0][0]).toMatchObject({
      source: 'generated',
      horoscope: { reading: { opening: expect.any(String) } },
    });
    expect(JSON.stringify(mockEnsurePersonalForecast.mock.calls[0][0])).not.toContain('chartId');
    expect(JSON.stringify(mockEnsurePersonalForecast.mock.calls[0][0])).not.toContain('chartData');
  });

  it('returns a safe diagnostic code when Luna fails the basic response checks', async () => {
    mockGetPremiumEntitlementState.mockResolvedValueOnce({
      isPremium: true,
      entitlement: null,
    });
    mockEnsurePersonalForecast.mockRejectedValueOnce(new Error(
      'PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED:empty_cliche',
    ));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: { chartId: 999, period: 'month' },
      headers: {},
    } as unknown as NextApiRequest;

    try {
      await handler(req, res);
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0]).toEqual({
      error: 'Personal horoscope unavailable',
      code: 'PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED',
    });
  });
});
