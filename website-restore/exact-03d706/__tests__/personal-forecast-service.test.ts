jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));

import { apiFetch } from '../services/apiClient';
import { loadPersonalForecast } from '../services/personalForecastService';
import { personalForecastFixture } from './personal-forecast-fixture';
import { PERSONAL_FORECAST_CONTRACT_VERSION } from '../lib/personalForecastContract';
import { LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION, projectPersonalForecastForWire } from '../lib/personalForecastWireCompatibility';

const mockedFetch = apiFetch as jest.Mock;

describe('personal forecast cache miss generation', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([404, 204])('turns GET %i cache miss into POST generation and polling to a ready package', async (status) => {
    const forecast = personalForecastFixture();
    const payload = {
      forecast,
      accessTier: 'premium',
      lockedSectionIds: [],
      periodLocked: false,
      source: 'generated',
    };
    mockedFetch
      .mockResolvedValueOnce({
        status,
        ok: status === 204,
        json: async () => status === 404
          ? { code: 'PERSONAL_FORECAST_NOT_READY' }
          : {},
      })
      .mockResolvedValueOnce({ status: 202, ok: true, json: async () => ({ retryAfterMs: 0 }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => payload });
    jest.spyOn(global, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === 'function') callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    const result = await loadPersonalForecast({
      profile: {
        id: 'forecast-service-user', name: 'Mira', birthDate: '1990-01-01', birthTime: '', birthPlace: '',
        language: 'en', isPremium: true,
      } as never,
      period: 'day',
      periodKey: '2026-07-26',
      options: { force: true, maxInProgressRetries: 1 },
    });

    expect(result.forecast.periodKey).toBe('2026-07-26');
    expect(mockedFetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('period=day'),
      expect.stringContaining('period=day'),
      expect.stringContaining('period=day'),
    ]);
    for (const [url] of mockedFetch.mock.calls) {
      expect(new URL(url, 'https://nebo.invalid').searchParams.get('contractVersion'))
        .toBe(PERSONAL_FORECAST_CONTRACT_VERSION);
    }
    expect(mockedFetch.mock.calls.map(([, options]) => options.method)).toEqual(['GET', 'POST', 'GET']);
  });

  it('still rejects a legacy response when the new client explicitly requested its current contract', async () => {
    const legacy = projectPersonalForecastForWire({
      forecast: personalForecastFixture(), accessTier: 'premium',
      lockedSectionIds: [], periodLocked: false, source: 'cache',
    }, LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION);
    mockedFetch.mockResolvedValue({ status: 200, ok: true, json: async () => legacy });
    await expect(loadPersonalForecast({
      profile: { id: 'new-client-legacy-response', name: 'Mira', birthDate: '1990-01-01',
        birthTime: '', birthPlace: '', language: 'en', isPremium: true } as never,
      period: 'day', periodKey: '2026-07-26', options: { force: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_RESPONSE_INVALID' });
  });
});
