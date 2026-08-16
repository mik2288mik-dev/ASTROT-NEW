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

import fs from 'fs';
import path from 'path';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  buildAiPersonalHoroscopeCacheKey,
} from '../lib/aiPersonalHoroscope';
import {
  buildAiPersonalHoroscopeGenerationLockKey,
  ensurePersonalForecast,
} from '../lib/personalForecastCache';
import { aiPersonalHoroscopeFixture } from './ai-personal-horoscope-fixture';

const ROOT = path.resolve(__dirname, '..');
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

describe('direct AI personal horoscope cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByUser.mockResolvedValue(null);
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValue(null);
    mockContentInterpretations.upsertByUser.mockResolvedValue(undefined);
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
    expect(day).not.toContain(':all-periods:');
    expect(week).toContain(':week:2026-W30:2026-07-26:');
  });

  it('persists one user-level Luna horoscope without chart identity or prior-text memory', async () => {
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
    }));
    const generationInput = mockGenerateAiPersonalHoroscopePackage.mock.calls[0][0];
    expect(generationInput).not.toHaveProperty('chartData');
    expect(generationInput).not.toHaveProperty('chartId');
    expect(generationInput).not.toHaveProperty('conversationMemory');
    expect(generationInput).not.toHaveProperty('recentForecasts');
    expect(generationInput).not.toHaveProperty('recentMemory');
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
    expect(mockContentInterpretations.getLatestByUserVariant).not.toHaveBeenCalled();
  });

  it('returns an exact cache hit without another Luna call', async () => {
    const horoscope = aiPersonalHoroscopeFixture();
    mockContentInterpretations.getByUser.mockResolvedValueOnce({
      inputHash: expect.anything(),
      promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
      calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
      content: horoscope,
    });

    // The input hash is deterministic but is generated inside the cache module.
    // Capture it from a first save and reuse it for the cache-hit assertion.
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
  });

  it('forces a real rewrite instead of returning the existing server cache', async () => {
    const oldHoroscope = aiPersonalHoroscopeFixture();
    const newHoroscope = {
      ...aiPersonalHoroscopeFixture(),
      reading: {
        ...aiPersonalHoroscopeFixture().reading,
        opening: 'Михаил, сегодня новый текст действительно создан заново.',
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
    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledTimes(1);
    expect(mockContentInterpretations.upsertByUser).toHaveBeenCalledTimes(1);
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

  it('contains no cross-period keyword extractor or stale-content path', () => {
    const cacheSource = fs.readFileSync(
      path.join(ROOT, 'lib/personalForecastCache.ts'),
      'utf8',
    );
    const contractSource = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscope.ts'),
      'utf8',
    );
    expect(cacheSource).not.toContain('getRecentPersonalForecastMemory');
    expect(cacheSource).not.toContain('getLatestByUserVariant');
    expect(cacheSource).not.toContain('getCompatibleStalePersonalForecast');
    expect(cacheSource).not.toContain('recentMemory');
    expect(contractSource).not.toContain('themeKeywords');
    expect(contractSource).not.toContain('adviceKeywords');
    expect(contractSource).not.toContain('buildAiPersonalHoroscopeContinuity');
  });
});
