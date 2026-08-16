const mockRequireAppUser = jest.fn();
const mockGetUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockGetCachedPersonalForecast = jest.fn();
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
  ensurePersonalForecast: (...args: unknown[]) =>
    mockEnsurePersonalForecast(...args),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  getAiPersonalHoroscopePeriodKey,
  resolveAiPersonalHoroscopeWindow,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
} from '../lib/aiPersonalHoroscope';
import handler from '../pages/api/content/forecast/personal';
import { aiPersonalHoroscopeFixture } from './ai-personal-horoscope-fixture';

function currentHoroscope(period: AiPersonalHoroscopePeriod): AiPersonalHoroscopePackage {
  const periodKey = getAiPersonalHoroscopePeriodKey(
    period,
    new Date(),
    'Europe/Moscow',
  );
  const window = resolveAiPersonalHoroscopeWindow(
    period,
    periodKey,
    'Europe/Moscow',
  );
  return {
    ...aiPersonalHoroscopeFixture(period),
    periodKey,
    currentDate: getAiPersonalHoroscopeCurrentDate(window),
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: formatAiPersonalHoroscopeDateLabel(window, 'ru'),
  };
}

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
      horoscope: currentHoroscope('week'),
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET', query: { period: 'week' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0]).toMatchObject({
      accessTier: 'free',
      periodLocked: true,
      lockedAdviceIndexes: [0, 1, 2],
      source: 'cache',
      horoscope: {
        reading: { opening: '', forecast: '', advice: [] },
      },
    });
  });

  it.each(['day', 'week', 'month'] as const)(
    'reopens cached Premium %s without a new AI generation',
    async (period) => {
      mockGetPremiumEntitlementState.mockResolvedValueOnce({
        isPremium: true,
        state: 'paid',
        entitlement: { status: 'paid' },
      });
      mockGetCachedPersonalForecast.mockResolvedValueOnce({
        horoscope: currentHoroscope(period),
      });
      const { res, status, json } = responseMock();
      const req = {
        method: 'GET', query: { period }, body: {}, headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
      expect(json.mock.calls[0][0]).toMatchObject({
        accessTier: 'premium',
        periodLocked: false,
        lockedAdviceIndexes: [],
        source: 'cache',
        horoscope: { period },
      });
    },
  );

  it('returns 204 on GET when the current date snapshot is not cached', async () => {
    const { res, status, end } = responseMock();
    const req = {
      method: 'GET', query: { period: 'day' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(end).toHaveBeenCalledTimes(1);
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
  });

  it('regenerate skips the server cache and forces one fresh Luna write', async () => {
    const horoscope = currentHoroscope('day');
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready',
      value: horoscope,
      fromCache: false,
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: { period: 'day', regenerate: true },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(mockGetCachedPersonalForecast).not.toHaveBeenCalled();
    expect(mockEnsurePersonalForecast).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'day' }),
      { forceRegenerate: true },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({
      source: 'generated',
      horoscope: { period: 'day' },
    });
  });

  it('generates on POST when the initial cache read is temporarily unavailable', async () => {
    const horoscope = currentHoroscope('day');
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
    expect(mockEnsurePersonalForecast).toHaveBeenCalledWith(
      expect.any(Object),
      { forceRegenerate: false },
    );
    expect(json.mock.calls[0][0]).toMatchObject({
      source: 'generated',
      horoscope: { reading: { opening: expect.any(String) } },
    });
    expect(JSON.stringify(mockEnsurePersonalForecast.mock.calls[0][0])).not.toContain('chartId');
    expect(JSON.stringify(mockEnsurePersonalForecast.mock.calls[0][0])).not.toContain('chartData');
  });

  it('returns a stable diagnostic code when the structured response is incomplete', async () => {
    mockGetPremiumEntitlementState.mockResolvedValueOnce({
      isPremium: true,
      entitlement: null,
    });
    mockEnsurePersonalForecast.mockRejectedValueOnce(new Error(
      'PERSONAL_HOROSCOPE_WRITER_VALIDATION_FAILED:response_shape_invalid',
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
