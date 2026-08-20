const mockEnsureValidContext = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockGetCachedPersonalForecast = jest.fn();
const mockGetCompatibleStalePersonalForecast = jest.fn();
const mockEnsurePersonalForecast = jest.fn();

jest.mock('../lib/natalReading/apiHelper', () => ({
  ensureValidContext: (...args: unknown[]) => mockEnsureValidContext(...args),
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
import {
  formatPersonalForecastDateLabel,
  getPersonalForecastPeriodKey,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import handler from '../pages/api/content/forecast/personal';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

const profile = {
  id: '1001',
  name: 'Mira',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Москва',
  birthTimezone: 'Europe/Moscow',
  language: 'ru' as const,
  isPremium: false,
  isSetup: true,
  theme: 'light' as const,
};

const readyContext = {
  userId: '1001',
  ctx: {
    user: { id: '1001' },
    profile,
    chartId: 7,
    chartData: chartFixture,
  },
};

function currentForecast(period: PersonalForecastPeriod): PersonalForecastPackage {
  const periodKey = getPersonalForecastPeriodKey(
    period,
    new Date(),
    'Europe/Moscow',
  );
  const window = resolvePersonalForecastWindow(period, periodKey, 'Europe/Moscow');
  const fixture = personalForecastFixture();
  return {
    ...fixture,
    period,
    periodKey,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(window, 'ru'),
    timezone: window.timezone,
    sections: period === 'day' ? fixture.sections : [],
    meta: {
      ...fixture.meta,
      freeSelection: period === 'day'
        ? fixture.meta.freeSelection
        : {
            strongestSectionId: null,
            rotatedSectionId: null,
            sectionIds: [],
          },
    },
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

describe('personal forecast API entitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureValidContext.mockResolvedValue(readyContext);
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
        body: { chartId: 999, period },
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(mockEnsureValidContext).toHaveBeenCalledWith(req, res, {
        allowGuest: true,
        requireSelfChart: true,
      });
      expect(status).toHaveBeenCalledWith(403);
      expect(mockGetCachedPersonalForecast).toHaveBeenCalledWith(expect.objectContaining({
        ctx: readyContext.ctx,
        period,
      }));
      expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
      expect(json.mock.calls[0][0]).toMatchObject({
        code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
      });
    },
  );

  it('serves an existing cached week to Free as a locked period', async () => {
    mockGetCachedPersonalForecast.mockResolvedValueOnce({
      forecast: currentForecast('week'),
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
      lockedSectionIds: ['overview'],
      source: 'cache',
      forecast: {
        period: 'week',
        overview: { text: '' },
      },
    });
  });

  it.each(['day', 'week', 'month'] as const)(
    'reopens cached Premium %s without a new Luna generation',
    async (period) => {
      mockGetPremiumEntitlementState.mockResolvedValueOnce({
        isPremium: true,
        state: 'paid',
        entitlement: { status: 'paid' },
      });
      mockGetCachedPersonalForecast.mockResolvedValueOnce({
        forecast: currentForecast(period),
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
        lockedSectionIds: [],
        source: 'cache',
        forecast: { period },
      });
    },
  );

  it('returns 204 on GET when the current period is not cached', async () => {
    const { res, status, end } = responseMock();
    const req = {
      method: 'GET', query: { period: 'day' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(end).toHaveBeenCalledTimes(1);
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
  });

  it('regenerate skips caches and forwards both regeneration controls', async () => {
    const forecast = currentForecast('day');
    const regenerationAfter = '2026-08-20T08:30:00.000Z';
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready',
      value: forecast,
      fromCache: false,
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: { period: 'day', regenerate: true, regenerationAfter },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(mockGetCachedPersonalForecast).not.toHaveBeenCalled();
    expect(mockGetCompatibleStalePersonalForecast).not.toHaveBeenCalled();
    expect(mockEnsurePersonalForecast).toHaveBeenCalledWith(
      expect.objectContaining({ ctx: readyContext.ctx, period: 'day' }),
      { forceRegenerate: true, minimumGeneratedAt: regenerationAfter },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({
      source: 'generated',
      forecast: { period: 'day' },
    });
  });

  it('generates on POST when the initial cache read is temporarily unavailable', async () => {
    const forecast = currentForecast('day');
    mockGetCachedPersonalForecast.mockRejectedValueOnce(new Error('cache read offline'));
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready',
      value: forecast,
      fromCache: false,
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST', query: {}, body: { chartId: 999, period: 'day' }, headers: {},
    } as unknown as NextApiRequest;

    try {
      await handler(req, res);
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(200);
    expect(mockEnsurePersonalForecast).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: expect.objectContaining({ chartId: 7, chartData: chartFixture }),
        period: 'day',
      }),
      { forceRegenerate: false, minimumGeneratedAt: null },
    );
    expect(json.mock.calls[0][0]).toMatchObject({
      source: 'generated',
      forecast: { overview: { text: expect.any(String) } },
    });
  });

  it('returns a stable diagnostic code and unavailable package for an incomplete response', async () => {
    mockGetPremiumEntitlementState.mockResolvedValueOnce({
      isPremium: true,
      entitlement: null,
    });
    mockEnsurePersonalForecast.mockRejectedValueOnce(new Error(
      'PERSONAL_FORECAST_WRITER_REQUEST_FAILED:OPENAI_RESPONSE_INCOMPLETE',
    ));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST', query: {}, body: { chartId: 999, period: 'month' }, headers: {},
    } as unknown as NextApiRequest;

    try {
      await handler(req, res);
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0]).toMatchObject({
      error: 'Personal forecast unavailable',
      code: 'PERSONAL_FORECAST_WRITER_INCOMPLETE',
      forecast: {
        period: 'month',
        meta: {
          status: 'unavailable',
          diagnosticCode: 'PERSONAL_FORECAST_WRITER_INCOMPLETE',
        },
      },
    });
  });
});
