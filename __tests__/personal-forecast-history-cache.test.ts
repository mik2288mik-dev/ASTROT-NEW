const mockContentInterpretations = {
  getByChart: jest.fn(),
  getByUser: jest.fn(),
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
  buildContentGenerationLockKey: jest.fn(() => 'lock-v4'),
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
const mockGetAstrologyHistoryContext = jest.fn();

jest.mock('../lib/astrologyHistoryStore', () => ({
  appendCalculationSnapshot: (...args: unknown[]) => mockAppendCalculationSnapshot(...args),
  appendGeneratedArtifact: (...args: unknown[]) => mockAppendGeneratedArtifact(...args),
  getAstrologyHistoryContext: (...args: unknown[]) => mockGetAstrologyHistoryContext(...args),
}));

jest.mock('../lib/personalForecastEvidence', () => ({
  resolvePersonalForecastChartReliability: jest.fn(() => ({
    birthTimeQuality: 'exact',
    ascendantReliable: true,
    housesReliable: true,
    houseBasedPersonalization: true,
  })),
}));

jest.mock('../lib/personalForecastSemantics', () => ({
  PERSONAL_FORECAST_SEMANTICS_VERSION: 'personal-forecast-semantics-v1',
}));

jest.mock('../lib/personalForecastContract', () => ({
  PERSONAL_FORECAST_CALCULATION_VERSION: 'personal-forecast-evidence-v4',
  PERSONAL_FORECAST_CONTRACT_VERSION: 'personal-forecast-feed-v4',
  PERSONAL_FORECAST_PROMPT_VERSION: 'personal-forecast-feed.v5.semantic-writer+voice-test',
  buildPersonalForecastCacheKey: jest.fn(() => 'personal-forecast-feed-v4:key:day:2026-08-02'),
  buildPersonalForecastInputHash: jest.fn(() => 'input-v4'),
  buildPersonalForecastChartFingerprint: jest.fn(() => 'chart-v4'),
  getPreviousPersonalForecastPeriodKey: jest.fn(() => '2026-08-01'),
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

describe('personal forecast durable history cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValue(null);
    mockContentInterpretations.upsertByChart.mockResolvedValue(undefined);
    mockGetAstrologyHistoryContext.mockResolvedValue({
      calculations: [],
      explicitFacts: [],
      userMessages: [],
      artifactContinuity: [{ semanticFingerprints: ['older-semantic'] }],
    });
    mockAppendCalculationSnapshot.mockResolvedValue({ id: 101 });
    mockAppendGeneratedArtifact.mockResolvedValue({ id: 202 });
  });

  it('records raw calculation evidence before writing and stores prose as display-only output', async () => {
    const forecast = {
      overview: { semanticFingerprint: 'overview-semantic' },
      sections: [
        { semanticFingerprint: 'section-semantic' },
        { semanticFingerprint: 'section-semantic' },
      ],
      meta: {
        validationStatus: 'valid',
        generationAttempts: 1,
      },
    };
    const calculated = {
      evidence: [{
        id: 'evidence-1',
        kind: 'transit_to_natal',
        transitPlanet: 'mars',
        natalPoint: 'moon',
        aspect: 'square',
        house: 4,
        orb: 1.2,
        status: 'applying',
        exactAt: null,
        startsAt: '2026-08-02T00:00:00.000Z',
        endsAt: '2026-08-03T00:00:00.000Z',
        strength: 81,
        polarity: 'challenging',
        calculationSource: 'personal-forecast-evidence-v4:swisseph',
      }],
      continuationEvidence: [],
      evidenceViews: {
        'evidence-1': { meaning: 'Generated display explanation must not enter raw history.' },
      },
    };
    mockGeneratePersonalForecastPackage.mockImplementationOnce(async (input: {
      onEvidenceCalculated: (payload: unknown) => Promise<unknown>;
      historyContext: unknown;
    }) => {
      expect(input.historyContext).toMatchObject({
        artifactContinuity: [{ semanticFingerprints: ['older-semantic'] }],
      });
      await input.onEvidenceCalculated({
        calculated,
        semanticFacts: [{ id: 'semantic-1' }],
      });
      return forecast;
    });

    await ensurePersonalForecast({
      ctx: {
        user: { id: '42' },
        profile: {
          id: '42',
          name: 'Private name',
          birthDate: '1990-01-01',
          birthTime: '12:00',
          birthPlace: 'Private place',
          language: 'ru',
        } as never,
        chartId: 7,
        chartData: {
          timezone: 'Europe/Moscow',
          calculationVersion: 'swisseph-v2',
          birthTimeQuality: 'exact',
        } as never,
      },
      period: 'day',
      periodKey: '2026-08-02',
    });

    expect(mockAppendCalculationSnapshot).toHaveBeenCalledTimes(1);
    const snapshotInput = mockAppendCalculationSnapshot.mock.calls[0][0];
    expect(snapshotInput).toMatchObject({
      userId: '42',
      subjectChartId: 7,
      surface: 'forecast',
      period: 'day',
      periodKey: '2026-08-02',
      inputHash: 'input-v4',
      calculationVersion: 'personal-forecast-evidence-v4',
      semanticVersion: 'personal-forecast-semantics-v1',
      ephemerisSource: 'swisseph',
      birthTimeStatus: 'exact',
      calculationPayload: {
        chartFingerprint: 'chart-v4',
        natalCalculationVersion: 'swisseph-v2',
        forecastCalculationVersion: 'personal-forecast-evidence-v4',
      },
      provenance: {
        containsGeneratedProse: false,
      },
    });
    expect(snapshotInput).not.toHaveProperty('profile');
    expect(snapshotInput).not.toHaveProperty('chartData');
    expect(JSON.stringify(snapshotInput.evidencePayload)).not.toContain('Generated display explanation');
    expect(mockAppendCalculationSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      mockAppendGeneratedArtifact.mock.invocationCallOrder[0],
    );

    expect(mockAppendGeneratedArtifact).toHaveBeenCalledWith(expect.objectContaining({
      calculationSnapshotId: 101,
      contentPayload: forecast,
      semanticFingerprints: ['overview-semantic', 'section-semantic'],
      provider: 'openai',
      modelId: 'gpt-test',
      semanticVersion: 'personal-forecast-semantics-v1',
      contractVersion: 'personal-forecast-feed-v4',
      validationStatus: 'valid',
      generationAttempts: 1,
      provenance: {
        source: 'personal_forecast_semantic_pipeline',
        displayOnly: true,
        isFactualEvidence: false,
      },
    }));
    expect(mockContentInterpretations.upsertByChart).toHaveBeenCalledTimes(1);
  });
});
