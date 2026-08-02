jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '../services/apiClient';
import {
  slicePersonalForecastForAccess,
} from '../lib/personalForecastContract';
import {
  clearPersonalForecastSessionCache,
  loadPersonalForecast,
  readLocalPersonalForecast,
} from '../services/personalForecastService';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

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
  name: 'Test',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Moscow',
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

function cachedResponse() {
  return new Response(JSON.stringify({
    forecast: personalForecastFixture(),
    accessTier: 'premium',
    lockedSectionIds: [],
    periodLocked: false,
    source: 'cache',
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
    sections: fixture.sections,
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

describe('personal forecast stale-while-revalidate client cache', () => {
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

  it('shows saved content while a server refresh remains in flight', async () => {
    mockedApiFetch.mockResolvedValueOnce(cachedResponse());
    await loadPersonalForecast({ ...request, options: { cacheOnly: true } });

    let resolveRefresh!: (response: Response) => void;
    mockedApiFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    }));
    const refresh = loadPersonalForecast({ ...request, options: { cacheOnly: true, force: true } });

    expect(readLocalPersonalForecast(request)?.forecast.overview.text).toBe(
      personalForecastFixture().overview.text,
    );
    resolveRefresh(cachedResponse());
    await expect(refresh).resolves.toMatchObject({ source: 'cache' });
  });

  it('uses the saved package on a repeated open of the same period', async () => {
    mockedApiFetch.mockResolvedValueOnce(cachedResponse());
    await loadPersonalForecast({ ...request, options: { cacheOnly: true } });
    mockedApiFetch.mockClear();

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true },
    })).resolves.toMatchObject({ source: expect.stringMatching(/local|cache/) });
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect([...storage.keys()]).toEqual([
      expect.stringMatching(/^tvoi-goroskop:personal-forecast-feed-v4:/),
    ]);
  });

  it('deduplicates two parallel server cache reads for one package', async () => {
    let resolveRequest!: (response: Response) => void;
    mockedApiFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    const first = loadPersonalForecast({ ...request, options: { cacheOnly: true } });
    const second = loadPersonalForecast({ ...request, options: { cacheOnly: true } });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    resolveRequest(cachedResponse());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('loads and reuses a personalized locked period preview for Free', async () => {
    const freeProfile = { ...profile, isPremium: false };
    const sliced = slicePersonalForecastForAccess(weeklyForecastFixture(), false);
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      forecast: sliced.forecast,
      accessTier: 'free',
      lockedSectionIds: sliced.lockedSectionIds,
      periodLocked: true,
      source: 'cache',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      profile: freeProfile,
      period: 'week',
      periodKey: '2026-W30',
      options: { cacheOnly: true },
    })).resolves.toMatchObject({
      accessTier: 'free',
      periodLocked: true,
      forecast: {
        overview: {
          text: '',
          lockedPreview: {
            teaser: expect.any(String),
          },
        },
      },
    });

    expect(readLocalPersonalForecast({
      ...request,
      profile: freeProfile,
      period: 'week',
      periodKey: '2026-W30',
    })).toMatchObject({
      accessTier: 'free',
      periodLocked: true,
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid Free V4 slice and keeps its section lock metadata', async () => {
    const sliced = slicePersonalForecastForAccess(personalForecastFixture(), false);
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      forecast: sliced.forecast,
      accessTier: 'free',
      lockedSectionIds: sliced.lockedSectionIds,
      periodLocked: sliced.periodLocked,
      source: 'cache',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(loadPersonalForecast({
      ...request,
      options: { cacheOnly: true },
    })).resolves.toMatchObject({
      lockedSectionIds: expect.arrayContaining([
        'semantic:workload',
      ]),
      periodLocked: false,
      forecast: {
        overview: { text: personalForecastFixture().overview.text },
        sections: expect.arrayContaining([
          expect.objectContaining({ id: 'semantic:workload', text: '' }),
        ]),
      },
    });
    clearPersonalForecastSessionCache();
    expect(readLocalPersonalForecast(request)).toMatchObject({
      accessTier: 'free',
      lockedSectionIds: sliced.lockedSectionIds,
      periodLocked: false,
      source: 'local',
    });
  });

  it('rejects a legacy or malformed payload without replacing local content', async () => {
    mockedApiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      forecast: {
        ...personalForecastFixture(),
        overview: { card: 'legacy V2 content' },
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
      options: { cacheOnly: true },
    })).rejects.toMatchObject({
      code: 'PERSONAL_FORECAST_RESPONSE_INVALID',
    });
    expect(readLocalPersonalForecast(request)).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('rejects a structurally complete V3 package from the server cache', async () => {
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
      options: { cacheOnly: true },
    })).rejects.toMatchObject({
      code: 'PERSONAL_FORECAST_RESPONSE_INVALID',
    });
    expect(readLocalPersonalForecast(request)).toBeNull();
    expect(storage.size).toBe(0);
  });
});
