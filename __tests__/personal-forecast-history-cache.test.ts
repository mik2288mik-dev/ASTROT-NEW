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
jest.mock('../lib/astrologyHistoryStore', () => ({
  appendCalculationSnapshot: (...args: unknown[]) => mockAppendCalculationSnapshot(...args),
  appendGeneratedArtifact: (...args: unknown[]) => mockAppendGeneratedArtifact(...args),
}));

jest.mock('../lib/personalForecastEvidence', () => ({
  resolvePersonalForecastChartReliability: jest.fn(() => ({
    birthTimeQuality: 'exact',
    ascendantReliable: true,
    housesReliable: true,
    houseBasedPersonalization: true,
  })),
}));

jest.mock('../lib/personalForecastContract', () => ({
  PERSONAL_FORECAST_CALCULATION_VERSION: 'personal-forecast-evidence-v4',
  PERSONAL_FORECAST_CONTRACT_VERSION: 'personal-forecast-feed-v5',
  PERSONAL_FORECAST_PROMPT_VERSION: 'personal-forecast-feed.v6.editorial-writer+voice-test',
  buildPersonalForecastCacheKey: jest.fn(() => 'personal-forecast-feed-v5:key:day:2026-08-02'),
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

import {
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
} from '../lib/personalForecastCache';

describe('personal forecast durable history cache path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContentInterpretations.getByChart.mockResolvedValue(null);
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValue(null);
    mockContentInterpretations.upsertByChart.mockResolvedValue(undefined);
    mockAppendCalculationSnapshot.mockResolvedValue({ id: 101 });
    mockAppendGeneratedArtifact.mockResolvedValue({ id: 202 });
  });

  it('accepts only an input-compatible old-prompt result as stale', async () => {
    const forecast = {
      period: 'day',
      periodKey: '2026-08-02',
      meta: {
        model: 'gpt-test',
        promptVersion: 'old-prompt',
        voiceVersion: '8',
        calculationVersion: 'personal-forecast-evidence-v4',
        semanticVersion: 'personal-forecast-feed-v5',
        contractVersion: 'personal-forecast-feed-v5',
      },
    };
    mockContentInterpretations.getLatestByChartVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'input-v4',
      promptVersion: 'old-prompt',
      calculationVersion: 'personal-forecast-evidence-v4',
      content: forecast,
    });
    const input = {
      ctx: {
        user: { id: '42' },
        profile: { id: '42', language: 'ru' } as never,
        chartId: 7,
        chartData: { timezone: 'Europe/Moscow' } as never,
      },
      period: 'day' as const,
      periodKey: '2026-08-02',
    };

    await expect(getCompatibleStalePersonalForecast(input)).resolves.toMatchObject({
      forecast,
      cacheKey: 'old-cache-key',
      inputHash: 'input-v4',
    });

    mockContentInterpretations.getLatestByChartVariant.mockResolvedValueOnce({
      cacheKey: 'old-cache-key',
      inputHash: 'different-chart-or-period',
      promptVersion: 'old-prompt',
      calculationVersion: 'personal-forecast-evidence-v4',
      content: forecast,
    });
    await expect(getCompatibleStalePersonalForecast(input)).resolves.toBeNull();
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
    }) => {
      expect(input).not.toHaveProperty('historyContext');
      expect(input).not.toHaveProperty('previousForecast');
      await input.onEvidenceCalculated({
        calculated,
        semanticFacts: [],
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
      semanticVersion: 'personal-forecast-feed-v5',
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
      semanticVersion: 'personal-forecast-feed-v5',
      contractVersion: 'personal-forecast-feed-v5',
      validationStatus: 'valid',
      generationAttempts: 1,
      provenance: {
        source: 'personal_forecast_direct_evidence',
        displayOnly: true,
        isFactualEvidence: false,
      },
    }));
    expect(mockContentInterpretations.upsertByChart).toHaveBeenCalledTimes(1);
  });

  it('returns the calculated forecast when history and cache persistence are unavailable', async () => {
    const forecast = {
      overview: { semanticFingerprint: 'overview-semantic' },
      sections: [{ semanticFingerprint: 'section-semantic' }],
      meta: {
        validationStatus: 'deterministic_fallback',
        generationAttempts: 0,
      },
    };
    const calculated = {
      evidence: [],
      continuationEvidence: [],
      evidenceViews: {},
    };
    mockAppendCalculationSnapshot.mockRejectedValueOnce(new Error('history write offline'));
    mockContentInterpretations.getByChart.mockRejectedValueOnce(new Error('cache read offline'));
    mockContentInterpretations.upsertByChart.mockRejectedValueOnce(new Error('cache write offline'));
    mockGeneratePersonalForecastPackage.mockImplementationOnce(async (input: {
      onEvidenceCalculated: (payload: unknown) => Promise<unknown>;
    }) => {
      expect(input).not.toHaveProperty('historyContext');
      expect(input).not.toHaveProperty('previousForecast');
      await input.onEvidenceCalculated({ calculated, semanticFacts: [] });
      return forecast;
    });

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(ensurePersonalForecast({
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
      })).resolves.toMatchObject({
        status: 'ready',
        value: forecast,
      });
    } finally {
      consoleError.mockRestore();
    }

    expect(mockAppendGeneratedArtifact).not.toHaveBeenCalled();
  });
});
