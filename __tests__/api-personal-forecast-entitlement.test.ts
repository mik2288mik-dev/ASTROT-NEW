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
import handler from '../pages/api/content/forecast/personal';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

function responseMock(): {
  res: NextApiResponse;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn();
  const res = { status, json } as unknown as NextApiResponse;
  status.mockImplementation(() => res);
  return { res, status, json };
}

describe('personal forecast API entitlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureValidContext.mockResolvedValue({
      userId: '1001',
      ctx: {
        user: { id: '1001' },
        profile: {
          id: '1001',
          name: 'Mira',
          language: 'ru',
          birthTimezone: 'Europe/Moscow',
        },
        chartId: 7,
        chartData: chartFixture,
      },
    });
    mockGetPremiumEntitlementState.mockResolvedValue({
      isPremium: false,
      entitlement: null,
    });
    mockGetCachedPersonalForecast.mockResolvedValue(null);
    mockGetCompatibleStalePersonalForecast.mockResolvedValue(null);
  });

  it.each(['week', 'month'])(
    'stops a Free %s cache miss before generation',
    async (period) => {
      const { res, status, json } = responseMock();
      const req = {
        method: 'POST',
        query: {},
        body: {
          userId: '1001',
          chartId: 7,
          period,
        },
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(mockGetCachedPersonalForecast).toHaveBeenCalledTimes(1);
      expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
      const payload = json.mock.calls[0][0];
      expect(payload).toMatchObject({
        code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
      });
    },
  );

  it('still serves an existing cached week to Free as a locked preview', async () => {
    mockGetCachedPersonalForecast.mockResolvedValueOnce({
      forecast: { ...personalForecastFixture(), period: 'week' },
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET', query: { period: 'week' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0]).toMatchObject({
      accessTier: 'free', periodLocked: true, source: 'cache',
    });
  });

  it('serves a compatible stale day immediately and refreshes it lazily', async () => {
    mockGetCompatibleStalePersonalForecast.mockResolvedValueOnce({
      forecast: personalForecastFixture(),
    });
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready', value: personalForecastFixture(), fromCache: false,
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

  it('does not refresh a compatible stale premium period for Free', async () => {
    mockGetCompatibleStalePersonalForecast.mockResolvedValueOnce({
      forecast: { ...personalForecastFixture(), period: 'week' },
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET', query: { period: 'week' }, body: {}, headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({ source: 'stale', periodLocked: true });
    expect(mockEnsurePersonalForecast).not.toHaveBeenCalled();
  });

  it('generates on POST when the initial cache read is temporarily unavailable', async () => {
    const forecast = personalForecastFixture();
    mockGetCachedPersonalForecast.mockRejectedValueOnce(new Error('cache read offline'));
    mockEnsurePersonalForecast.mockResolvedValueOnce({
      status: 'ready',
      value: forecast,
      fromCache: false,
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: '1001',
        chartId: 7,
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
    expect(json.mock.calls[0][0]).toMatchObject({ source: 'generated' });
  });

  it('returns a safe diagnostic code when the structured writer rejects a monthly response', async () => {
    mockGetPremiumEntitlementState.mockResolvedValueOnce({
      isPremium: true,
      entitlement: null,
    });
    mockEnsurePersonalForecast.mockRejectedValueOnce(new Error(
      'PERSONAL_FORECAST_GENERATION_INVALID:contains chronological time segment',
    ));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: { chartId: 7, period: 'month' },
      headers: {},
    } as unknown as NextApiRequest;

    try {
      await handler(req, res);
    } finally {
      consoleError.mockRestore();
    }

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED',
      forecast: {
        meta: { diagnosticCode: 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED' },
      },
    });
  });
});
