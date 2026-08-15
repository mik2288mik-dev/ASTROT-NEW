jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '../services/apiClient';
import { sliceAiPersonalHoroscopeForAccess } from '../lib/aiPersonalHoroscope';
import {
  clearPersonalForecastSessionCache,
  loadPersonalForecast,
  readLocalPersonalForecast,
  selectActiveReadyPersonalForecast,
} from '../services/personalForecastService';
import {
  aiPersonalHoroscopeFixture,
  weeklyAiPersonalHoroscopeFixture,
} from './ai-personal-horoscope-fixture';

const mockedApiFetch = apiFetch as jest.Mock;
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
};
const profile = {
  id: '42',
  name: 'Михаил',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Москва',
  birthTimezone: 'Europe/Moscow',
  language: 'ru' as const,
  isPremium: true,
  isSetup: true,
  theme: 'light' as const,
};
const request = {
  profile,
  period: 'day' as const,
  periodKey: '2026-07-26',
};

function responseFor(
  horoscope = aiPersonalHoroscopeFixture(),
  accessTier: 'free' | 'premium' = 'premium',
) {
  const sliced = sliceAiPersonalHoroscopeForAccess(
    horoscope,
    accessTier === 'premium',
  );
  return new Response(JSON.stringify({
    horoscope: sliced.horoscope,
    accessTier,
    lockedAdviceIndexes: sliced.lockedAdviceIndexes,
    periodLocked: sliced.periodLocked,
    source: 'cache',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('simple AI personal horoscope client cache', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: localStorageMock },
    });
  });

  afterAll(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  beforeEach(() => {
    storage.clear();
    clearPersonalForecastSessionCache();
    mockedApiFetch.mockReset();
  });

  it('never substitutes a daily horoscope for another active period', () => {
    const dailyResult = {
      horoscope: aiPersonalHoroscopeFixture(),
      accessTier: 'premium' as const,
      lockedAdviceIndexes: [],
      periodLocked: false,
      source: 'cache' as const,
    };
    const periodStates = {
      day: { result: dailyResult },
      week: { result: null },
      month: { result: null },
    };

    expect(selectActiveReadyPersonalForecast('day', periodStates)).toBe(dailyResult);
    expect(selectActiveReadyPersonalForecast('month', periodStates)).toBeNull();
  });

  it('uses the saved simple package on repeated opens without another request', async () => {
    mockedApiFetch.mockResolvedValueOnce(responseFor());
    await loadPersonalForecast({ ...request, options: { cacheOnly: true } });
    mockedApiFetch.mockClear();

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true },
    })).resolves.toMatchObject({ source: expect.stringMatching(/local|cache/) });
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect([...storage.keys()]).toEqual([
      expect.stringMatching(/^tvoi-goroskop:ai-personal-horoscope-v3:/),
    ]);
  });

  it('deduplicates two parallel server cache reads', async () => {
    let resolveRequest!: (response: Response) => void;
    mockedApiFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    const first = loadPersonalForecast({ ...request, options: { cacheOnly: true } });
    const second = loadPersonalForecast({ ...request, options: { cacheOnly: true } });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    resolveRequest(responseFor());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('accepts the locked weekly package for Free', async () => {
    const freeProfile = { ...profile, isPremium: false };
    const weekly = weeklyAiPersonalHoroscopeFixture();
    mockedApiFetch.mockResolvedValueOnce(responseFor(weekly, 'free'));

    await expect(loadPersonalForecast({
      profile: freeProfile,
      period: 'week',
      periodKey: '2026-W30',
      options: { cacheOnly: true },
    })).resolves.toMatchObject({
      accessTier: 'free',
      periodLocked: true,
      lockedAdviceIndexes: [0, 1, 2],
      horoscope: {
        reading: { opening: '', forecast: '', advice: [] },
      },
    });
  });

  it('keeps Free Today opening, forecast and one advice item', async () => {
    const freeProfile = { ...profile, isPremium: false };
    mockedApiFetch.mockResolvedValueOnce(responseFor(aiPersonalHoroscopeFixture(), 'free'));

    await expect(loadPersonalForecast({
      ...request,
      profile: freeProfile,
      options: { cacheOnly: true },
    })).resolves.toMatchObject({
      periodLocked: false,
      lockedAdviceIndexes: [1, 2],
      horoscope: {
        reading: {
          opening: expect.stringContaining('Михаил'),
          forecast: expect.any(String),
          advice: [expect.any(String)],
        },
      },
    });
  });

  it('rejects a malformed or legacy transport object', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      horoscope: {
        ...aiPersonalHoroscopeFixture(),
        version: 'legacy-personal-forecast-package',
      },
      accessTier: 'premium',
      lockedAdviceIndexes: [],
      periodLocked: false,
      source: 'cache',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_HOROSCOPE_RESPONSE_INVALID' });
    expect(readLocalPersonalForecast(request)).toBeNull();
  });

  it('continues from a retryable cache failure to one generation request', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Cache temporarily unavailable',
        code: 'CACHE_UNAVAILABLE',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(responseFor());

    await expect(loadPersonalForecast({
      ...request,
      options: { force: true },
    })).resolves.toMatchObject({ horoscope: { period: 'day' } });

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    expect(mockedApiFetch.mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST']);
    expect(mockedApiFetch.mock.calls[1][1]?.body).not.toContain('chartId');
    expect(mockedApiFetch.mock.calls[1][1]?.body).not.toContain('chartData');
  });

  it('does not turn an authorization failure into generation', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Forbidden',
      code: 'FORBIDDEN',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { force: true },
    })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it('bounds an in-progress generation to one POST and two polls', async () => {
    jest.useFakeTimers();
    mockedApiFetch
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'GENERATION_IN_PROGRESS',
        retryAfterMs: 500,
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'GENERATION_IN_PROGRESS',
        retryAfterMs: 500,
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'GENERATION_IN_PROGRESS',
        retryAfterMs: 500,
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }));

    try {
      const pending = loadPersonalForecast({
        ...request,
        options: { force: true, maxInProgressRetries: 2 },
      });
      const expectation = expect(pending).rejects.toMatchObject({
        status: 202,
        code: 'GENERATION_IN_PROGRESS',
      });
      await jest.advanceTimersByTimeAsync(1_000);
      await expectation;
    } finally {
      jest.useRealTimers();
    }

    expect(mockedApiFetch).toHaveBeenCalledTimes(4);
    expect(mockedApiFetch.mock.calls.map((call) => call[1]?.method)).toEqual([
      'GET', 'POST', 'POST', 'POST',
    ]);
  });
});
