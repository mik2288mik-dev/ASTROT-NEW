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
  getUnifiedContentModel: jest.fn(async () => 'gpt-test'),
}));

jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: jest.fn(() => 'lock-profile-v1'),
  withContentGenerationLock: jest.fn(async (input: {
    readCached: () => Promise<unknown>;
    generate: () => Promise<unknown>;
  }) => {
    const cached = await input.readCached();
    if (cached) return { status: 'ready', value: cached, fromCache: true };
    return { status: 'ready', value: await input.generate(), fromCache: false };
  }),
}));

const mockAppendCalculationSnapshot = jest.fn();
const mockAppendGeneratedArtifact = jest.fn();
jest.mock('../lib/astrologyHistoryStore', () => ({
  appendCalculationSnapshot: (...args: unknown[]) => mockAppendCalculationSnapshot(...args),
  appendGeneratedArtifact: (...args: unknown[]) => mockAppendGeneratedArtifact(...args),
}));

jest.mock('../lib/personalForecastContract', () => ({
  PERSONAL_FORECAST_CALCULATION_VERSION: 'personal-forecast-luna-natal-profile-v1',
  PERSONAL_FORECAST_CONTRACT_VERSION: 'personal-forecast-feed-v13',
  PERSONAL_FORECAST_PROMPT_VERSION: 'personal-forecast-feed.v27.luna-editorial-presentations-test',
  buildPersonalForecastCacheKey: jest.fn((input: { periodKey: string }) => (
    `personal-forecast-profile:key:day:${input.periodKey}`
  )),
  buildPersonalForecastInputHash: jest.fn((input: { periodKey: string }) => (
    `input-profile-v1:${input.periodKey}`
  )),
  buildPersonalForecastChartFingerprint: jest.fn(() => 'chart-v4'),
  getPersonalForecastPackageValidationError: jest.fn(() => null),
  isPersonalForecastPackage: jest.fn(() => true),
  getPreviousPersonalForecastPeriodKey: jest.fn((_period: string, periodKey: string) => {
    const previous: Record<string, string> = {
      '2026-08-02': '2026-08-01',
      '2026-08-01': '2026-07-31',
      '2026-07-31': '2026-07-30',
      '2026-07-30': '2026-07-29',
    };
    return previous[periodKey] || '2026-07-28';
  }),
  resolvePersonalForecastWindow: jest.fn((_period: string, periodKey: string) => ({
    period: 'day',
    periodKey,
    timezone: 'Europe/Moscow',
    periodStart: periodKey,
    periodEnd: periodKey,
    startsAt: new Date('2026-08-01T21:00:00.000Z'),
    endsAt: new Date('2026-08-02T20:59:59.999Z'),
    validTo: new Date('2026-08-02T20:59:59.999Z'),
  })),
}));

const mockGeneratePersonalForecastPackage = jest.fn();
jest.mock('../lib/personalForecastGeneration', () => ({
  generatePersonalForecastPackage: (...args: unknown[]) => mockGeneratePersonalForecastPackage(...args),
}));

import {
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
} from '../lib/personalForecastCache';

describe('personal forecast profile cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValue(null);
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValue(null);
    mockContentInterpretations.upsertByChart.mockResolvedValue(undefined);
  });

  it('persists Luna prose without constructing or storing period-specific calculations', async () => {
    const forecast = {
      overview: { semanticFingerprint: 'profile-overview' },
      sections: [{ semanticFingerprint: 'profile-advice' }],
      meta: { validationStatus: 'valid', generationAttempts: 1 },
    };
    mockGeneratePersonalForecastPackage.mockResolvedValueOnce(forecast);

    await expect(ensurePersonalForecast({
      ctx: {
        user: { id: '42' },
        profile: {
          id: '42', name: 'Private name', birthDate: '1990-01-01',
          birthTime: '12:00', birthPlace: 'Private place', language: 'ru',
        } as never,
        chartId: 7,
        chartData: { timezone: 'Europe/Moscow' } as never,
      },
      period: 'day',
      periodKey: '2026-08-02',
    })).resolves.toMatchObject({ status: 'ready', value: forecast });

    expect(mockGeneratePersonalForecastPackage).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      model: 'gpt-test',
      profile: expect.objectContaining({ id: '42' }),
    }));
    expect(mockGeneratePersonalForecastPackage.mock.calls[0][0]).not.toHaveProperty('onEvidenceCalculated');
    expect(mockAppendCalculationSnapshot).not.toHaveBeenCalled();
    expect(mockAppendGeneratedArtifact).not.toHaveBeenCalled();
    expect(mockContentInterpretations.upsertByChart).toHaveBeenCalledTimes(1);
  });

  it('passes recent same-period cache text to generation without serving it as the new period', async () => {
    const generated = {
      overview: { text: 'Новый первый фрагмент.', semanticFingerprint: 'new-overview' },
      sections: [],
      meta: { model: 'gpt-test', validationStatus: 'valid', generationAttempts: 1 },
    };
    const oldPromptReading = {
      period: 'day',
      periodKey: '2026-08-02',
      overview: {
        title: 'Точность без лишнего шума',
        text: 'Старый текст текущего дня.',
        semanticFingerprint: 'old-current',
      },
      sections: [{ text: 'Ещё один старый фрагмент.', semanticFingerprint: 'old-current-2' }],
      meta: { model: 'gpt-test' },
    };
    const yesterdayReading = {
      period: 'day',
      periodKey: '2026-08-01',
      overview: { text: 'Вчерашняя главная мысль.', semanticFingerprint: 'yesterday-overview' },
      sections: [{ text: 'Вчерашнее характерное сравнение.', semanticFingerprint: 'yesterday-2' }],
      meta: { model: 'gpt-test' },
    };
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValueOnce({
      content: oldPromptReading,
      promptVersion: 'old-prompt-version',
      calculationVersion: 'personal-forecast-luna-natal-profile-v1',
    });
    mockContentInterpretations.getByChart.mockImplementation(async (
      _chartId: number,
      _tier: string,
      _surface: string,
      _variant: string,
      cacheKey: string,
    ) => {
      if (cacheKey.endsWith(':2026-08-01')) {
        return {
          inputHash: 'input-profile-v1:2026-08-01',
          promptVersion: 'personal-forecast-feed.v27.luna-editorial-presentations-test',
          calculationVersion: 'personal-forecast-luna-natal-profile-v1',
          content: yesterdayReading,
        };
      }
      return null;
    });
    mockGeneratePersonalForecastPackage.mockResolvedValueOnce(generated);

    await expect(ensurePersonalForecast({
      ctx: {
        user: { id: '42' },
        profile: {
          id: '42', name: 'Private name', birthDate: '1990-01-01',
          birthTime: '12:00', birthPlace: 'Private place', language: 'ru',
        } as never,
        chartId: 7,
        chartData: { timezone: 'Europe/Moscow' } as never,
      },
      period: 'day',
      periodKey: '2026-08-02',
    })).resolves.toMatchObject({ status: 'ready', value: generated });

    expect(mockGeneratePersonalForecastPackage).toHaveBeenCalledWith(expect.objectContaining({
      recentForecasts: [
        expect.objectContaining({
          periodKey: '2026-08-02',
          fragments: expect.arrayContaining([
            expect.objectContaining({
              kind: 'headline',
              text: 'Точность без лишнего шума',
            }),
            expect.objectContaining({ text: 'Старый текст текущего дня.' }),
          ]),
        }),
        expect.objectContaining({
          periodKey: '2026-08-01',
          fragments: expect.arrayContaining([
            expect.objectContaining({ text: 'Вчерашняя главная мысль.' }),
          ]),
        }),
      ],
    }));
    expect(mockContentInterpretations.getByChart.mock.calls.some((call) => (
      call[4] === 'personal-forecast-profile:key:day:2026-08-01' && call[5] === true
    ))).toBe(true);
    expect(mockContentInterpretations.upsertByChart).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ content: generated }),
      '42',
    );
  });

  it('never serves a previous prompt product as compatible stale content', async () => {
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'old-input-hash',
      promptVersion: 'personal-forecast-feed.v25.luna-personal-story',
      calculationVersion: 'personal-forecast-luna-natal-profile-v1',
      content: {
        period: 'day',
        periodKey: '2026-08-02',
        overview: { text: 'Старая единственная история.' },
        sections: [],
        meta: {
          model: 'gpt-test',
          voiceVersion: '10',
          calculationVersion: 'personal-forecast-luna-natal-profile-v1',
          semanticVersion: 'personal-forecast-feed-v12',
          contractVersion: 'personal-forecast-feed-v12',
        },
      },
    });

    await expect(getCompatibleStalePersonalForecast({
      ctx: {
        user: { id: '42' },
        profile: {
          id: '42', name: 'Private name', birthDate: '1990-01-01',
          birthTime: '12:00', birthPlace: 'Private place', language: 'ru',
        } as never,
        chartId: 7,
        chartData: { timezone: 'Europe/Moscow' } as never,
      },
      period: 'day',
      periodKey: '2026-08-02',
    })).resolves.toBeNull();
  });
});
