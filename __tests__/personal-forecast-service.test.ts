jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { apiFetch } from '../services/apiClient';
import { slicePersonalForecastForAccess } from '../lib/personalForecastContract';
import {
  clearPersonalForecastSessionCache,
  loadPersonalForecast,
  primeLocalPersonalForecast,
  readLocalPersonalForecast,
  selectActiveReadyPersonalForecast,
} from '../services/personalForecastService';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

const mockedApiFetch = apiFetch as jest.Mock;
const ROOT = path.resolve(__dirname, '..');
const storage = new Map<string, string>();
const localStorageMock = {
  get length() { return storage.size; },
  key: (index: number) => [...storage.keys()][index] ?? null,
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
  chartData: chartFixture,
  chartId: 7,
  period: 'day' as const,
  periodKey: '2026-07-26',
};

function responseFor(
  forecast = personalForecastFixture(),
  accessTier: 'free' | 'premium' = 'premium',
  source: 'cache' | 'generated' = 'cache',
) {
  const sliced = slicePersonalForecastForAccess(
    forecast,
    accessTier === 'premium',
  );
  return new Response(JSON.stringify({
    forecast: sliced.forecast,
    accessTier,
    lockedSectionIds: sliced.lockedSectionIds,
    periodLocked: sliced.periodLocked,
    source,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function weeklyForecastFixture() {
  const fixture = personalForecastFixture();
  return {
    ...fixture,
    period: 'week' as const,
    periodKey: '2026-W30',
    periodStart: '2026-07-20',
    periodEnd: '2026-07-26',
    sections: [],
    meta: {
      ...fixture.meta,
      freeSelection: {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      },
    },
  };
}

describe('personal forecast package client cache', () => {
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

  it('never substitutes a daily forecast for another active period', () => {
    const dailyResult = {
      forecast: personalForecastFixture(),
      accessTier: 'premium' as const,
      lockedSectionIds: [],
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

  it('uses the refreshed v6 client package on repeated opens without another request', async () => {
    mockedApiFetch.mockResolvedValueOnce(responseFor());
    await loadPersonalForecast({
      ...request,
      options: { cacheOnly: true, background: true },
    });
    mockedApiFetch.mockClear();

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({ source: expect.stringMatching(/local|cache/) });
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect([...storage.keys()]).toEqual([
      expect.stringMatching(/^tvoi-goroskop:personal-forecast-feed-v6:/),
    ]);
  });

  it('serves an immediate local fallback while a background request refreshes it', async () => {
    const fallback = primeLocalPersonalForecast(request);

    expect(fallback).toMatchObject({
      source: 'local',
      forecast: {
        period: 'day',
        periodKey: '2026-07-26',
        meta: { status: 'ready', validationStatus: 'deterministic_fallback' },
      },
    });
    expect(readLocalPersonalForecast(request)).toEqual(fallback);

    mockedApiFetch.mockResolvedValueOnce(responseFor());
    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({ source: 'cache' });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it('keys saved Luna content by both saved profile and natal chart fingerprints', async () => {
    mockedApiFetch.mockResolvedValueOnce(responseFor());
    await loadPersonalForecast({ ...request, options: { cacheOnly: true, background: true } });

    expect(readLocalPersonalForecast(request)?.forecast.overview.text)
      .toBe(personalForecastFixture().overview.text);
    expect(readLocalPersonalForecast({
      ...request,
      profile: { ...profile, birthDate: '1991-01-01', birthPlace: 'Kazan' },
    })).toBeNull();
    expect(readLocalPersonalForecast({
      ...request,
      profile: { ...profile, name: 'Changed name' },
    })).toBeNull();
    expect(readLocalPersonalForecast({
      ...request,
      chartData: {
        ...chartFixture,
        sun: { ...chartFixture.sun!, degree: (chartFixture.sun?.degree ?? 0) + 1 },
      },
    })).toBeNull();
  });

  it('deduplicates two parallel server cache reads for one package', async () => {
    let resolveRequest!: (response: Response) => void;
    mockedApiFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    const first = loadPersonalForecast({ ...request, options: { cacheOnly: true, background: true } });
    const second = loadPersonalForecast({ ...request, options: { cacheOnly: true, background: true } });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    resolveRequest(responseFor());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('loads a personalized locked weekly preview for Free', async () => {
    const freeProfile = { ...profile, isPremium: false };
    const weekly = weeklyForecastFixture();
    mockedApiFetch.mockResolvedValueOnce(responseFor(weekly, 'free'));

    await expect(loadPersonalForecast({
      ...request,
      profile: freeProfile,
      period: 'week',
      periodKey: '2026-W30',
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({
      accessTier: 'free',
      periodLocked: true,
      forecast: {
        overview: {
          text: '',
          lockedPreview: { teaser: expect.any(String) },
        },
      },
    });
  });

  it('keeps the valid Free Today slice and its section lock metadata', async () => {
    const freeProfile = { ...profile, isPremium: false };
    const sliced = slicePersonalForecastForAccess(personalForecastFixture(), false);
    mockedApiFetch.mockResolvedValueOnce(responseFor(personalForecastFixture(), 'free'));

    await expect(loadPersonalForecast({
      ...request,
      profile: freeProfile,
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({
      periodLocked: false,
      lockedSectionIds: sliced.lockedSectionIds,
      forecast: {
        overview: { text: personalForecastFixture().overview.text },
        sections: expect.arrayContaining([
          expect.objectContaining({ id: 'semantic:workload', text: '' }),
        ]),
      },
    });
  });

  it('rejects a malformed or legacy transport object', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      forecast: {
        ...personalForecastFixture(),
        overview: { card: 'legacy personal forecast content' },
      },
      accessTier: 'premium',
      lockedSectionIds: [],
      periodLocked: false,
      source: 'cache',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true, background: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_RESPONSE_INVALID' });
    expect(readLocalPersonalForecast(request)).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('rejects a structurally complete stale package from the server cache', async () => {
    const legacy = personalForecastFixture();
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      forecast: {
        ...legacy,
        meta: {
          ...legacy.meta,
          calculationVersion: 'personal-forecast-evidence-v3',
          semanticVersion: 'legacy-topic-routing',
          contractVersion: 'personal-forecast-feed-v3',
        },
      },
      accessTier: 'premium',
      lockedSectionIds: [],
      periodLocked: false,
      source: 'cache',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true, background: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_FORECAST_RESPONSE_INVALID' });
    expect(readLocalPersonalForecast(request)).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('continues from a retryable cache failure to one ordinary generation request', async () => {
    mockedApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Cache temporarily unavailable',
        code: 'CACHE_UNAVAILABLE',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(responseFor(personalForecastFixture(), 'premium', 'generated'));

    await expect(loadPersonalForecast({
      ...request,
      options: { background: true },
    })).resolves.toMatchObject({
      forecast: { period: 'day' },
      source: 'generated',
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    expect(mockedApiFetch.mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST']);
    expect(mockedApiFetch.mock.calls[1][1]?.body).toContain('"regenerate":false');
  });

  it('does not turn an authorization failure into a generation request', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Forbidden',
      code: 'FORBIDDEN',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { background: true },
    })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch.mock.calls[0][1]?.method).toBe('GET');
  });

  it('bounds an in-progress generation to one initial POST and two POST polls', async () => {
    jest.useFakeTimers();
    mockedApiFetch
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
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
        options: { background: true, maxInProgressRetries: 2 },
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
      'GET',
      'POST',
      'POST',
      'POST',
    ]);
    expect(mockedApiFetch.mock.calls.slice(1).every(
      (call) => call[1]?.body?.includes('"regenerate":false'),
    )).toBe(true);
  });

  it('force bypasses local and server caches and requests a real rewrite', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      responseFor(personalForecastFixture(), 'premium', 'generated'),
    );

    await expect(loadPersonalForecast({
      ...request,
      options: { force: true, background: true },
    })).resolves.toMatchObject({ source: 'generated' });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch.mock.calls[0][1]?.method).toBe('POST');
    expect(mockedApiFetch.mock.calls[0][1]?.body).toContain('"regenerate":true');
  });

  it('keeps startup generation invisible and schedules all periods for Premium', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'services/personalForecastService.ts'),
      'utf8',
    );
    expect(source).toContain('scheduleStartupPrewarm');
    expect(source).toContain("? ['day', 'week', 'month']");
    expect(source).toContain('background: true');
    expect(source).toContain('maxInProgressRetries: 60');
  });
});
