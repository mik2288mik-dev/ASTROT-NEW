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

import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
} from '../lib/aiPersonalHoroscope';
import {
  buildAiPersonalHoroscopeGenerationLockKey,
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
} from '../lib/personalForecastCache';
import {
  aiPersonalHoroscopeFixture,
  weeklyAiPersonalHoroscopeFixture,
} from './ai-personal-horoscope-fixture';

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

describe('simple AI personal horoscope cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByUser.mockResolvedValue(null);
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValue(null);
    mockContentInterpretations.upsertByUser.mockResolvedValue(undefined);
  });

  it('uses one writer lock for Today Week and Month', () => {
    const key = buildAiPersonalHoroscopeGenerationLockKey('42');
    expect(key).toContain(':42:all-periods:');
    expect(key).not.toContain(':daily:');
    expect(key).not.toContain(':weekly:');
    expect(key).not.toContain(':monthly:');
  });

  it('persists one user-level Luna horoscope without chart identity or PersonalForecastPackage', async () => {
    const horoscope = aiPersonalHoroscopeFixture();
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(horoscope);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', value: horoscope });

    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      profile: expect.objectContaining({ id: '42' }),
      recentMemory: expect.any(Array),
    }));
    const generationInput = mockGenerateAiPersonalHoroscopePackage.mock.calls[0][0];
    expect(generationInput).not.toHaveProperty('chartData');
    expect(generationInput).not.toHaveProperty('chartId');
    expect(generationInput).not.toHaveProperty('conversationMemory');
    expect(generationInput).not.toHaveProperty('recentForecasts');
    expect(mockContentInterpretations.upsertByUser).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({
        content: horoscope,
        promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
        calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      }),
    );
    expect(mockContentInterpretations.upsertByChart).not.toHaveBeenCalled();
    expect(mockContentInterpretations.getByChart).not.toHaveBeenCalled();
  });

  it('passes only compact keywords from previous horoscopes', async () => {
    const current = aiPersonalHoroscopeFixture();
    const previous = aiPersonalHoroscopeFixture();
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValueOnce({
      content: previous,
    });
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(current);

    await ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    });

    const generationInput = mockGenerateAiPersonalHoroscopePackage.mock.calls[0][0];
    expect(generationInput.recentMemory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        period: 'day',
        periodKey: '2026-07-26',
        themeKeywords: expect.any(Array),
        adviceKeywords: expect.any(Array),
      }),
    ]));
    expect(JSON.stringify(generationInput.recentMemory)).not.toContain(previous.reading.forecast);
    expect(JSON.stringify(generationInput.recentMemory)).not.toContain(previous.reading.advice[0]);
  });

  it('includes compact memory from another active period without its full prose', async () => {
    const current = aiPersonalHoroscopeFixture();
    const weekly = weeklyAiPersonalHoroscopeFixture();
    mockContentInterpretations.getLatestByUserVariant.mockImplementation(
      async (_userId, _tier, _surface, variant) => (
        variant === 'weekly' ? { content: weekly } : null
      ),
    );
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(current);

    await ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    });

    const generationInput = mockGenerateAiPersonalHoroscopePackage.mock.calls[0][0];
    expect(generationInput.recentMemory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        period: 'week',
        periodKey: '2026-W30',
        themeKeywords: weekly.continuity.themeKeywords,
        adviceKeywords: weekly.continuity.adviceKeywords,
      }),
    ]));
    expect(JSON.stringify(generationInput.recentMemory)).not.toContain(weekly.reading.forecast);
  });

  it('never serves an old PersonalForecastPackage as compatible content', async () => {
    const legacy = {
      period: 'day',
      periodKey: '2026-07-26',
      overview: { text: 'legacy' },
      sections: [],
      meta: { promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION },
    };
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'old-input-hash',
      promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
      calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      content: legacy,
    });

    await expect(getCompatibleStalePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toBeNull();
  });
});
