const mockAppendCalculationSnapshot = jest.fn();
const mockAppendGeneratedArtifact = jest.fn();

jest.mock('../lib/astrologyHistoryStore', () => ({
  appendCalculationSnapshot: (...args: unknown[]) => mockAppendCalculationSnapshot(...args),
  appendGeneratedArtifact: (...args: unknown[]) => mockAppendGeneratedArtifact(...args),
}));

jest.mock('../lib/appSettings', () => ({
  getOpenAIModelForContent: jest.fn(async () => ({ model: 'gpt-history-test', modelTier: 'base' })),
}));

import type { NatalChartData } from '../types';
import {
  factualNatalCalculation,
  persistNatalReadingHistory,
  persistSavedSynastryHistory,
  resolveHistoryBirthTimeStatus,
} from '../lib/astrologyHistoryPersistence';

function chart(overrides: Partial<NatalChartData> = {}): NatalChartData {
  const position = (planet: string, sign: string) => ({
    planet,
    sign,
    degree: 12.5,
    longitude: 42.5,
    house: 3,
    retrograde: false,
    description: `generated description for ${planet}`,
  });
  return {
    sun: position('Sun', 'Aries'),
    moon: position('Moon', 'Taurus'),
    rising: position('Ascendant', 'Gemini'),
    mercury: position('Mercury', 'Pisces'),
    venus: position('Venus', 'Aries'),
    mars: position('Mars', 'Cancer'),
    element: 'Fire',
    rulingPlanet: 'Mars',
    houses: [{ house: 1, sign: 'Gemini', degree: 2, longitude: 62 }],
    aspects: [{ type: 'square', angle: 90, orb: 1.2, from: 'Sun', to: 'Moon' }],
    calculationVersion: 'swisseph-v2',
    calculationMetadata: {
      ephemerisMode: 'swisseph',
      houseSystem: 'placidus',
      housesComputedFrom: 'default_noon',
    },
    birthTimeQuality: 'unknown',
    summary: 'generated natal summary that must not be factual history',
    keywords: {
      love: 'generated love keyword',
      career: 'generated career keyword',
      karma: 'generated karma keyword',
    },
    ...overrides,
  };
}

describe('natal and synastry durable history persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendCalculationSnapshot.mockResolvedValue({ id: 101 });
    mockAppendGeneratedArtifact.mockResolvedValue({ id: 202 });
  });

  it('stores only allow-listed natal calculations and keeps generated prose display-only', async () => {
    const natal = chart();
    expect(resolveHistoryBirthTimeStatus(natal, '')).toBe('unknown');
    expect(JSON.stringify(factualNatalCalculation(natal))).not.toContain('generated');

    const content = { title: 'Generated title', body: 'Generated interpretation' };
    await persistNatalReadingHistory({
      userId: '42',
      chartId: 7,
      chart: natal,
      rawBirthTime: '',
      language: 'ru',
      accessTier: 'free',
      contentVariant: 'anchor',
      cacheKey: 'natal.anchor.v1',
      inputHash: 'natal-input-hash',
      promptVersion: 'natal-prompt-v1',
      content,
    });

    expect(mockAppendCalculationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42',
      subjectChartId: 7,
      surface: 'natal',
      birthTimeStatus: 'unknown',
      provenance: expect.objectContaining({ containsGeneratedProse: false }),
    }));
    const snapshot = mockAppendCalculationSnapshot.mock.calls[0][0];
    expect(JSON.stringify(snapshot)).not.toContain('Generated interpretation');
    expect(JSON.stringify(snapshot)).not.toContain('generated natal summary');
    expect(mockAppendGeneratedArtifact).toHaveBeenCalledWith(expect.objectContaining({
      calculationSnapshotId: 101,
      contentPayload: content,
      provider: 'openai',
      modelId: 'gpt-history-test',
      validationStatus: 'legacy_unvalidated',
      generationAttempts: 1,
      provenance: {
        source: 'saved_natal_reading',
        displayOnly: true,
        isFactualEvidence: false,
      },
    }));
    expect(mockAppendCalculationSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      mockAppendGeneratedArtifact.mock.invocationCallOrder[0],
    );
  });

  it('scopes saved-person synastry to both chart ids and preserves unknown partner time', async () => {
    const subject = chart({
      birthTimeQuality: 'exact',
      calculationMetadata: {
        ephemerisMode: 'swisseph',
        houseSystem: 'placidus',
        housesComputedFrom: 'exact_time',
      },
    });
    const counterpart = chart();
    const content = { summary: 'Display prose', fullAnalysis: { generalTheme: 'Display only' } };

    await persistSavedSynastryHistory({
      userId: '42',
      subjectChartId: 7,
      counterpartChartId: 9,
      subjectChart: subject,
      counterpartChart: counterpart,
      subjectBirthTime: '08:15',
      counterpartBirthTime: '',
      inputHash: 'pair-hash',
      language: 'ru',
      relationshipType: 'friendship',
      aspects: [{ from: 'Sun', to: 'Moon', type: 'trine', orb: 1 }],
      content: content as never,
      provider: 'openai',
      modelId: 'gpt-history-test',
      promptVersion: 'synastry-context.v2',
      generationAttempts: 1,
    });

    expect(mockAppendCalculationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      subjectChartId: 7,
      counterpartChartId: 9,
      surface: 'synastry',
      birthTimeStatus: 'exact',
      calculationPayload: expect.objectContaining({ counterpartBirthTimeStatus: 'unknown' }),
      evidencePayload: {
        aspects: [{ from: 'Sun', to: 'Moon', type: 'trine', orb: 1 }],
      },
    }));
    expect(JSON.stringify(mockAppendCalculationSnapshot.mock.calls[0][0])).not.toContain('Display prose');
    expect(mockAppendGeneratedArtifact).toHaveBeenCalledWith(expect.objectContaining({
      subjectChartId: 7,
      counterpartChartId: 9,
      calculationSnapshotId: 101,
      contentPayload: content,
      surface: 'synastry',
      validationStatus: 'legacy_unvalidated',
    }));
  });
});
