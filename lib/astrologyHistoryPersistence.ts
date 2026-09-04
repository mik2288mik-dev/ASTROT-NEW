import type {
  ContentVariant,
  NatalChartData,
  PlanetPosition,
  SynastryResult,
} from '../types';
import type { NatalAngleV2, NatalChartDataV2, NatalPositionV2 } from './natalChartV2Types';
import { APP_VOICE_VERSION } from './appVoice';
import { getOpenAIModelForContent } from './appSettings';
import {
  appendCalculationSnapshot,
  appendGeneratedArtifact,
  type ArtifactValidationStatus,
  type BirthTimeStatus,
} from './astrologyHistoryStore';

const HISTORY_SCHEMA_VERSION = 'history-v1';
const NATAL_HISTORY_CONTRACT_VERSION = 'natal-content-interpretation-v1';
const NATAL_HISTORY_SEMANTIC_VERSION = 'legacy-unstructured';
const SYNASTRY_HISTORY_CALCULATION_VERSION = 'synastry-aspects-v1';
const SYNASTRY_HISTORY_CONTRACT_VERSION = 'synastry-result-v1';
const SYNASTRY_HISTORY_SEMANTIC_VERSION = 'synastry-aspects-v1';

const PLANET_KEYS = [
  'sun',
  'moon',
  'rising',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
] as const;

export type NatalHistoryGeneration = {
  source?: 'generated' | 'deterministic_fallback';
  provider?: string;
  modelId?: string;
  generationAttempts?: 0 | 1 | 2;
  period?: string | null;
  periodKey?: string | null;
};

type NatalHistoryChart = NatalChartData | NatalChartDataV2;
type NatalHistoryPosition = PlanetPosition | NatalPositionV2 | NatalAngleV2;

function factualPlanet(position: NatalHistoryPosition | null | undefined) {
  if (!position) return null;
  return {
    planet: position.planet,
    sign: position.sign,
    degree: position.degree ?? null,
    longitude: position.longitude ?? null,
    house: position.house ?? null,
    retrograde: position.retrograde ?? false,
    speedLongitude: position.speedLongitude ?? null,
  };
}

/**
 * History calculations are an allow-listed technical projection. Generated
 * summaries, descriptions and keyword prose never enter factual continuity.
 */
export function factualNatalCalculation(chart: NatalHistoryChart) {
  const placements = Object.fromEntries(
    PLANET_KEYS.map((key) => [key, factualPlanet(chart[key])]),
  );
  return {
    placements,
    element: chart.element || null,
    rulingPlanet: chart.rulingPlanet || null,
    houses: Array.isArray(chart.houses)
      ? chart.houses.map((house) => ({
          house: house.house,
          sign: house.sign,
          degree: house.degree,
          longitude: house.longitude,
        }))
      : [],
    aspects: Array.isArray(chart.aspects)
      ? chart.aspects.map((aspect) => ({
          type: aspect.type,
          angle: aspect.angle,
          orb: aspect.orb,
          from: aspect.from,
          to: aspect.to,
        }))
      : [],
    calculationVersion: chart.calculationVersion || null,
    calculationMetadata: chart.calculationMetadata || null,
    birthTimeQuality: chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality || null,
    chartQuality: chart.chartQuality
      ? {
          birthTimeQuality: chart.chartQuality.birthTimeQuality,
          ascendantReliable: chart.chartQuality.ascendantReliable,
          housesReliable: chart.chartQuality.housesReliable,
          houseBasedPersonalization: chart.chartQuality.houseBasedPersonalization,
        }
      : null,
  };
}

export function resolveHistoryBirthTimeStatus(
  chart: NatalHistoryChart,
  rawBirthTime?: string | null,
): BirthTimeStatus {
  const explicit = chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
  if (explicit === 'exact' || explicit === 'approximate' || explicit === 'unknown') {
    return explicit;
  }
  if (chart.calculationMetadata?.housesComputedFrom === 'default_noon') return 'unknown';
  return String(rawBirthTime ?? '').trim() ? 'exact' : 'unknown';
}

function artifactStatus(source: NatalHistoryGeneration['source']): ArtifactValidationStatus {
  return source === 'deterministic_fallback' ? 'deterministic_fallback' : 'legacy_unvalidated';
}

export async function persistNatalReadingHistory(input: {
  userId: string;
  chartId: number;
  chart: NatalChartData;
  rawBirthTime?: string | null;
  language: 'ru' | 'en';
  accessTier: 'free' | 'premium';
  contentVariant: ContentVariant;
  cacheKey: string;
  inputHash: string;
  promptVersion: string;
  content: unknown;
  generation?: NatalHistoryGeneration;
}): Promise<void> {
  const factual = factualNatalCalculation(input.chart);
  const generation = input.generation || {};
  const fallback = generation.source === 'deterministic_fallback';
  const resolvedModel = generation.modelId
    ? { model: generation.modelId }
    : fallback
      ? { model: 'deterministic-natal-fallback-v1' }
      : await getOpenAIModelForContent({
          accessTier: input.accessTier,
          contentSurface: 'natal',
          contentVariant: input.contentVariant,
        });
  const snapshot = await appendCalculationSnapshot({
    userId: input.userId,
    subjectChartId: input.chartId,
    natalSourceChart: input.chart,
    surface: 'natal',
    period: generation.period ?? null,
    periodKey: generation.periodKey ?? null,
    inputHash: input.inputHash,
    calculationVersion: input.chart.calculationVersion || 'natal-calculation-legacy',
    semanticVersion: null,
    ephemerisSource: input.chart.calculationMetadata?.ephemerisMode || 'swisseph',
    houseSystem: input.chart.calculationMetadata?.houseSystem || null,
    birthTimeStatus: resolveHistoryBirthTimeStatus(input.chart, input.rawBirthTime),
    calculationPayload: factual,
    evidencePayload: {
      placements: factual.placements,
      aspects: factual.aspects,
    },
    provenance: {
      source: 'saved_natal_reading',
      containsGeneratedProse: false,
    },
    schemaVersion: HISTORY_SCHEMA_VERSION,
  });

  await appendGeneratedArtifact({
    userId: input.userId,
    subjectChartId: input.chartId,
    calculationSnapshotId: snapshot.id,
    surface: 'natal',
    variant: input.cacheKey || input.contentVariant,
    period: generation.period ?? null,
    periodKey: generation.periodKey ?? null,
    language: input.language,
    contentPayload: input.content,
    semanticFingerprints: [],
    provider: generation.provider || (fallback ? 'deterministic' : 'openai'),
    modelId: resolvedModel.model,
    promptVersion: input.promptVersion,
    voiceVersion: APP_VOICE_VERSION,
    semanticVersion: NATAL_HISTORY_SEMANTIC_VERSION,
    contractVersion: NATAL_HISTORY_CONTRACT_VERSION,
    validationStatus: artifactStatus(generation.source),
    generationAttempts: generation.generationAttempts ?? (fallback ? 0 : 1),
    inputHash: input.inputHash,
    provenance: {
      source: 'saved_natal_reading',
      displayOnly: true,
      isFactualEvidence: false,
    },
    schemaVersion: HISTORY_SCHEMA_VERSION,
  });
}

export async function persistSavedSynastryHistory(input: {
  userId: string;
  subjectChartId: number;
  counterpartChartId: number;
  subjectChart: NatalHistoryChart;
  counterpartChart: NatalHistoryChart;
  subjectBirthTime?: string | null;
  counterpartBirthTime?: string | null;
  inputHash: string;
  language: 'ru' | 'en';
  relationshipType: string;
  aspects: unknown[];
  content: SynastryResult;
  provider: 'openai' | 'deepseek' | 'deterministic';
  modelId: string;
  promptVersion: string;
  generationAttempts: 0 | 1 | 2;
}): Promise<void> {
  const subject = factualNatalCalculation(input.subjectChart);
  const counterpart = factualNatalCalculation(input.counterpartChart);
  const snapshot = await appendCalculationSnapshot({
    userId: input.userId,
    subjectChartId: input.subjectChartId,
    counterpartChartId: input.counterpartChartId,
    natalSourceChart: input.subjectChart,
    counterpartNatalSourceChart: input.counterpartChart,
    surface: 'synastry',
    inputHash: input.inputHash,
    calculationVersion: SYNASTRY_HISTORY_CALCULATION_VERSION,
    semanticVersion: SYNASTRY_HISTORY_SEMANTIC_VERSION,
    ephemerisSource: input.subjectChart.calculationMetadata?.ephemerisMode || 'swisseph',
    houseSystem: input.subjectChart.calculationMetadata?.houseSystem || null,
    birthTimeStatus: resolveHistoryBirthTimeStatus(input.subjectChart, input.subjectBirthTime),
    calculationPayload: {
      subject,
      counterpart,
      counterpartBirthTimeStatus: resolveHistoryBirthTimeStatus(
        input.counterpartChart,
        input.counterpartBirthTime,
      ),
    },
    evidencePayload: {
      aspects: input.aspects,
    },
    provenance: {
      source: 'saved_chart_synastry',
      relationshipType: input.relationshipType,
      containsGeneratedProse: false,
    },
    schemaVersion: HISTORY_SCHEMA_VERSION,
  });

  await appendGeneratedArtifact({
    userId: input.userId,
    subjectChartId: input.subjectChartId,
    counterpartChartId: input.counterpartChartId,
    calculationSnapshotId: snapshot.id,
    surface: 'synastry',
    variant: 'full',
    language: input.language,
    contentPayload: input.content,
    semanticFingerprints: [],
    provider: input.provider,
    modelId: input.modelId,
    promptVersion: input.promptVersion,
    voiceVersion: APP_VOICE_VERSION,
    semanticVersion: SYNASTRY_HISTORY_SEMANTIC_VERSION,
    contractVersion: SYNASTRY_HISTORY_CONTRACT_VERSION,
    validationStatus: input.provider === 'deterministic'
      ? 'deterministic_fallback'
      : 'legacy_unvalidated',
    generationAttempts: input.generationAttempts,
    inputHash: input.inputHash,
    provenance: {
      source: 'saved_chart_synastry',
      displayOnly: true,
      isFactualEvidence: false,
    },
    schemaVersion: HISTORY_SCHEMA_VERSION,
  });
}
