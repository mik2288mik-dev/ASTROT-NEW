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
  PERSONAL_FORECAST_CONTRACT_VERSION: 'personal-forecast-feed-v12',
  PERSONAL_FORECAST_PROMPT_VERSION: 'personal-forecast-feed.v24.luna-profile-test',
  buildPersonalForecastCacheKey: jest.fn(() => 'personal-forecast-profile:key:day:2026-08-02'),
  buildPersonalForecastInputHash: jest.fn(() => 'input-profile-v1'),
  buildPersonalForecastChartFingerprint: jest.fn(() => 'chart-v4'),
  getPersonalForecastPackageValidationError: jest.fn(() => null),
  isPersonalForecastPackage: jest.fn(() => true),
  resolvePersonalForecastWindow: jest.fn(() => ({
    period: 'day',
    periodKey: '2026-08-02',
    timezone: 'Europe/Moscow',
    periodStart: '2026-08-02',
    periodEnd: '2026-08-02',
    startsAt: new Date('2026-08-01T21:00:00.000Z'),
    endsAt: new Date('2026-08-02T20:59:59.999Z'),
    validTo: new Date('2026-08-02T20:59:59.999Z'),
  })),
}));

const mockGeneratePersonalForecastPackage = jest.fn();
jest.mock('../lib/personalForecastGeneration', () => ({
  generatePersonalForecastPackage: (...args: unknown[]) => mockGeneratePersonalForecastPackage(...args),
}));

import { ensurePersonalForecast } from '../lib/personalForecastCache';

describe('personal forecast profile cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValue(null);
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
});
