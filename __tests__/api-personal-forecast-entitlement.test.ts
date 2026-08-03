const mockEnsureValidContext = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockGetCachedPersonalForecast = jest.fn();
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
  });

  it.each(['week', 'month'])(
    'returns a personalized redacted %s preview to Free without exposing full text',
    async (period) => {
      const forecast = {
        ...personalForecastFixture(),
        period,
      };
      mockEnsurePersonalForecast.mockResolvedValue({
        status: 'ready',
        value: forecast,
        fromCache: false,
      });
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

      expect(status).toHaveBeenCalledWith(200);
      expect(mockGetCachedPersonalForecast).toHaveBeenCalledTimes(1);
      expect(mockEnsurePersonalForecast).toHaveBeenCalledTimes(1);
      const payload = json.mock.calls[0][0];
      expect(payload).toMatchObject({
        accessTier: 'free',
        periodLocked: true,
        source: 'generated',
      });
      expect(payload.forecast.overview.text).toBe('');
      expect(payload.forecast.overview.lockedPreview.teaser).toBeTruthy();
      expect(payload.forecast.overview.lockedPreview.lead).toBeTruthy();
      expect(payload.forecast.overview.lockedPreview.blurred).toBeTruthy();
      expect(payload.forecast.sections.every(
        (section: { text: string }) => section.text === '',
      )).toBe(true);
    },
  );

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
});
