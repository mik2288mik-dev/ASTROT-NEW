jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '../services/apiClient';
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
    lockedTopicKeys: [],
    source: 'cache',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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

    expect(readLocalPersonalForecast(request)?.forecast.overview.card).toBe(
      personalForecastFixture().overview.card,
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
});
