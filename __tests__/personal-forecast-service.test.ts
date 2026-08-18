jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
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
  period: 'day' as const,
  periodKey: '2026-07-26',
};

function responseFor(
  horoscope = aiPersonalHoroscopeFixture(),
  accessTier: 'free' | 'premium' = 'premium',
  source: 'cache' | 'generated' = 'cache',
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
    source,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('direct AI personal horoscope client cache', () => {
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
      expect.stringMatching(/^tvoi-goroskop:ai-personal-horoscope-v6:/),
    ]);
  });

  it('accepts a Free weekly package locked for either two or three advice items', async () => {
    const freeProfile = { ...profile, isPremium: false };
    const weekly = weeklyAiPersonalHoroscopeFixture();
    mockedApiFetch.mockResolvedValueOnce(responseFor(weekly, 'free'));

    await expect(loadPersonalForecast({
      profile: freeProfile,
      period: 'week',
      periodKey: '2026-W30',
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({
      accessTier: 'free',
      periodLocked: true,
      lockedAdviceIndexes: expect.arrayContaining([0, 1]),
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
      options: { cacheOnly: true, background: true },
    })).resolves.toMatchObject({
      periodLocked: false,
      lockedAdviceIndexes: expect.arrayContaining([1]),
      horoscope: {
        reading: {
          opening: expect.any(String),
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
      options: { cacheOnly: true, background: true },
    })).rejects.toMatchObject({ code: 'PERSONAL_HOROSCOPE_RESPONSE_INVALID' });
    expect(readLocalPersonalForecast(request)).toBeNull();
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
      .mockResolvedValueOnce(responseFor(aiPersonalHoroscopeFixture(), 'premium', 'generated'));

    await expect(loadPersonalForecast({
      ...request,
      options: { background: true },
    })).resolves.toMatchObject({
      horoscope: { period: 'day' },
      source: 'generated',
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    expect(mockedApiFetch.mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST']);
    expect(mockedApiFetch.mock.calls[1][1]?.body).toContain('"regenerate":false');
  });

  it('force bypasses local and server caches and requests a real rewrite', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      responseFor(aiPersonalHoroscopeFixture(), 'premium', 'generated'),
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
    expect(source).toContain("CLIENT_PROMPT_VARIANT = 'few-shot-v2'");
  });
});
