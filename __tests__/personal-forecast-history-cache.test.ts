const mockContentInterpretations = {
  getByChart: jest.fn(),
  getByUser: jest.fn(),
  getLatestByChartVariant: jest.fn(),
  getLatestByUserVariant: jest.fn(),
  upsertByChart: jest.fn(),
  upsertByUser: jest.fn(),
};

jest.mock('../lib/db', () => ({
  db: { content_interpretations: mockContentInterpretations },
}));

jest.mock('../lib/contentGenerationLock', () => ({
  withContentGenerationLock: jest.fn(async (input: {
    readCached: () => Promise<unknown>;
    generate: () => Promise<unknown>;
  }) => {
    const cached = await input.readCached();
    if (cached) return { status: 'ready', value: (cached as { value: unknown }).value, fromCache: true };
    return { status: 'ready', value: await input.generate(), fromCache: false };
  }),
}));

const mockGenerateAiPersonalHoroscopePackage = jest.fn();
jest.mock('../lib/aiPersonalHoroscopeGeneration', () => ({
  generateAiPersonalHoroscopePackage: (...args: unknown[]) => (
    mockGenerateAiPersonalHoroscopePackage(...args)
  ),
}));

const mockLoadPreviousAiPersonalHoroscopes = jest.fn();
jest.mock('../lib/aiPersonalHoroscopeHistory', () => ({
  loadPreviousAiPersonalHoroscopes: (...args: unknown[]) => (
    mockLoadPreviousAiPersonalHoroscopes(...args)
  ),
}));

import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  buildAiPersonalHoroscopeCacheKey,
  type AiPersonalHoroscopeHistoryItem,
} from '../lib/aiPersonalHoroscope';
import {
  buildAiPersonalHoroscopeGenerationLockKey,
  ensurePersonalForecast,
} from '../lib/personalForecastCache';
import { aiPersonalHoroscopeFixture } from './ai-personal-horoscope-fixture';

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

const previousForecasts: AiPersonalHoroscopeHistoryItem[] = Array.from(
  { length: 15 },
  (_, index) => ({
    period: 'day' as const,
    periodKey: `2026-07-${String(25 - index).padStart(2, '0')}`,
    currentDate: `2026-07-${String(25 - index).padStart(2, '0')}`,
    opening: `Прошлое вступление ${index + 1}`,
    forecast: `Прошлый прогноз ${index + 1}`,
    advice: [`Совет ${index + 1}.1`, `Совет ${index + 1}.2`],
  }),
);

describe('direct AI personal horoscope cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByUser.mockResolvedValue(null);
    mockContentInterpretations.upsertByUser.mockResolvedValue(undefined);
    mockLoadPreviousAiPersonalHoroscopes.mockResolvedValue(previousForecasts);
  });

  it('uses an independent writer lock for each period and date snapshot', () => {
    const day = buildAiPersonalHoroscopeGenerationLockKey({
      userId: '42',
      period: 'day',
      periodKey: '2026-07-26',
      currentDate: '2026-07-26',
    });
    const week = buildAiPersonalHoroscopeGenerationLockKey({
      userId: '42',
      period: 'week',
      periodKey: '2026-W30',
      currentDate: '2026-07-26',
    });
    expect(day).not.toBe(week);
    expect(week).toContain(':week:2026-W30:2026-07-26:');
  });

  it('passes the previous 15 full forecasts to Luna and persists the new result', async () => {
    const horoscope = aiPersonalHoroscopeFixture();
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(horoscope);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', value: horoscope });

    expect(mockLoadPreviousAiPersonalHoroscopes).toHaveBeenCalledWith('42', 15);
    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      profile: expect.objectContaining({ id: '42' }),
      previousForecasts,
    }));
    expect(mockContentInterpretations.upsertByUser).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({
        content: horoscope,
        promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
        calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      }),
    );
    expect(mockContentInterpretations.upsertByChart).not.toHaveBeenCalled();
  });

  it('returns an exact cache hit without loading history or calling Luna', async () => {
    const horoscope = aiPersonalHoroscopeFixture();
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(horoscope);
    await ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    });
    const saved = mockContentInterpretations.upsertByUser.mock.calls[0][1];

    jest.clearAllMocks();
    mockContentInterpretations.getByUser.mockResolvedValueOnce({
      inputHash: saved.inputHash,
      promptVersion: saved.promptVersion,
      calculationVersion: saved.calculationVersion,
      content: horoscope,
    });

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', fromCache: true, value: horoscope });
    expect(mockGenerateAiPersonalHoroscopePackage).not.toHaveBeenCalled();
    expect(mockLoadPreviousAiPersonalHoroscopes).not.toHaveBeenCalled();
  });

  it('forces a real rewrite and still supplies the previous forecasts', async () => {
    const oldHoroscope = aiPersonalHoroscopeFixture();
    const newHoroscope = {
      ...aiPersonalHoroscopeFixture(),
      reading: {
        ...aiPersonalHoroscopeFixture().reading,
        opening: 'Новое вступление.',
      },
    };
    mockContentInterpretations.getByUser.mockResolvedValue({
      inputHash: 'existing',
      promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
      calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      content: oldHoroscope,
    });
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(newHoroscope);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    }, { forceRegenerate: true })).resolves.toMatchObject({
      status: 'ready',
      fromCache: false,
      value: newHoroscope,
    });
    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      previousForecasts,
    }));
  });

  it('changes Week and Month cache identity when the current date changes', () => {
    const base = {
      profile,
      period: 'week' as const,
      periodKey: '2026-W30',
      timezone: 'Europe/Moscow',
      language: 'ru' as const,
      modelId: 'gpt-5.6-luna',
    };
    const monday = buildAiPersonalHoroscopeCacheKey({
      ...base,
      currentDate: '2026-07-20',
    });
    const friday = buildAiPersonalHoroscopeCacheKey({
      ...base,
      currentDate: '2026-07-24',
    });
    expect(monday).not.toBe(friday);
  });
});
