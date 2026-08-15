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
  getPool: jest.fn(),
}));

jest.mock('../lib/appSettings', () => ({
  getUnifiedContentModel: jest.fn(async () => 'gpt-5.6-luna'),
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

jest.mock('../lib/aiPersonalHoroscopeMemory', () => ({
  loadAiPersonalHoroscopeDialogueMemory: jest.fn(async () => []),
}));

import {
  buildAiPersonalHoroscopeGenerationLockKey,
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
} from '../lib/personalForecastCache';
import { buildForecastLockedPreview } from '../lib/personalForecastContract';
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

describe('AI personal horoscope profile cache path', () => {
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

  it('persists one user-level Luna horoscope without chart identity or calculations', async () => {
    const forecast = aiPersonalHoroscopeFixture();
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(forecast);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', value: forecast });

    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      model: 'gpt-5.6-luna',
      profile: expect.objectContaining({ id: '42' }),
    }));
    const generationInput = mockGenerateAiPersonalHoroscopePackage.mock.calls[0][0];
    expect(generationInput).not.toHaveProperty('chartData');
    expect(generationInput).not.toHaveProperty('chartId');
    expect(mockContentInterpretations.upsertByUser).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ content: forecast }),
    );
    expect(mockContentInterpretations.upsertByChart).not.toHaveBeenCalled();
    expect(mockContentInterpretations.getByChart).not.toHaveBeenCalled();
  });

  it('passes recent AI horoscope text as anti-repeat context', async () => {
    const current = aiPersonalHoroscopeFixture();
    const yesterdayBase = aiPersonalHoroscopeFixture();
    const yesterdayOpening = 'Михаил, вчера планы шумели громче результата. Ты это уже видел.';
    const yesterdayOverview = {
      ...yesterdayBase.overview,
      text: yesterdayOpening,
      contentBlocks: yesterdayBase.overview.contentBlocks.map((block, index) => (
        index === 0 ? { ...block, text: yesterdayOpening } : block
      )),
      semanticFingerprint: 'ai:yesterday:overview',
      lockedPreview: buildForecastLockedPreview(
        yesterdayOpening,
        yesterdayBase.overview.premiumTeaser,
      ),
      explanationAnchors: yesterdayBase.overview.explanationAnchors.map((anchor, index) => (
        index === 0 ? { ...anchor, conclusion: yesterdayOpening } : anchor
      )),
    };
    const yesterday = {
      ...yesterdayBase,
      periodKey: '2026-07-25',
      periodStart: '2026-07-25',
      periodEnd: '2026-07-25',
      overview: yesterdayOverview,
    };
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValueOnce({
      content: yesterday,
    });
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(current);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', value: current });

    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      recentForecasts: [
        expect.objectContaining({
          period: 'day',
          periodKey: '2026-07-25',
          fragments: expect.arrayContaining([
            expect.objectContaining({
              kind: 'opening',
              text: expect.stringContaining('планы шумели'),
            }),
          ]),
        }),
      ],
    }));
  });

  it('passes another active period and its advice as anti-repeat context', async () => {
    const current = aiPersonalHoroscopeFixture();
    const weekly = weeklyAiPersonalHoroscopeFixture();
    mockContentInterpretations.getLatestByUserVariant.mockImplementation(
      async (_userId, _tier, _surface, variant) => (
        variant === 'weekly' ? { content: weekly } : null
      ),
    );
    mockGenerateAiPersonalHoroscopePackage.mockResolvedValueOnce(current);

    await expect(ensurePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toMatchObject({ status: 'ready', value: current });

    expect(mockGenerateAiPersonalHoroscopePackage).toHaveBeenCalledWith(expect.objectContaining({
      recentForecasts: expect.arrayContaining([
        expect.objectContaining({
          period: 'week',
          periodKey: '2026-W30',
          fragments: expect.arrayContaining([
            expect.objectContaining({
              kind: 'advice',
              text: expect.stringContaining('Оставь три главных дела'),
            }),
          ]),
        }),
      ]),
    }));
  });

  it('never serves an old natal-profile product as compatible stale content', async () => {
    const legacy = aiPersonalHoroscopeFixture();
    mockContentInterpretations.getLatestByUserVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'old-input-hash',
      promptVersion: legacy.meta.promptVersion,
      calculationVersion: legacy.meta.calculationVersion,
      content: {
        ...legacy,
        meta: {
          ...legacy.meta,
          contentMode: 'legacy-natal-profile',
        },
      },
    });

    await expect(getCompatibleStalePersonalForecast({
      profile,
      period: 'day',
      periodKey: '2026-07-26',
    })).resolves.toBeNull();
  });
});
