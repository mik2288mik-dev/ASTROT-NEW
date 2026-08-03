import type { ContentInterpretation } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import { getUnifiedContentModel } from './appSettings';
import {
  appendCalculationSnapshot,
  appendGeneratedArtifact,
  getAstrologyHistoryContext,
} from './astrologyHistoryStore';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
  type ContentGenerationLockResult,
} from './contentGenerationLock';
import { db } from './db';
import type { ReadingContext } from './natalReading/apiHelper';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastChartFingerprint,
  buildPersonalForecastCacheKey,
  buildPersonalForecastInputHash,
  getPreviousPersonalForecastPeriodKey,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from './personalForecastContract';
import {
  resolvePersonalForecastChartReliability,
  type EvidenceCalculationResult,
  type PersonalForecastCalculatedEvidence,
} from './personalForecastEvidence';
import { generatePersonalForecastPackage } from './personalForecastGeneration';
import {
  PERSONAL_FORECAST_SEMANTICS_VERSION,
  type ForecastSemanticFact,
} from './personalForecastSemantics';

const CANONICAL_CACHE_TIER = 'premium' as const;
const ASTROLOGY_HISTORY_SCHEMA_VERSION = 'history-v1';

const VARIANT_BY_PERIOD = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
} as const;

export type PersonalForecastCacheContext = {
  ctx: ReadingContext;
  period: PersonalForecastPeriod;
  periodKey: string;
};

async function resolveCacheIdentity(input: PersonalForecastCacheContext) {
  if (!input.ctx.profile.id || !input.ctx.chartData || input.ctx.chartId == null) {
    throw new Error('PERSONAL_FORECAST_CHART_REQUIRED');
  }
  const model = await getUnifiedContentModel();
  const language: 'ru' | 'en' = input.ctx.profile.language === 'en' ? 'en' : 'ru';
  const timezone = input.ctx.chartData.timezone || input.ctx.profile.birthTimezone || 'Europe/Moscow';
  const window = resolvePersonalForecastWindow(input.period, input.periodKey, timezone);
  const common = {
    userId: String(input.ctx.profile.id),
    chartId: input.ctx.chartId,
    chartData: input.ctx.chartData,
    period: input.period,
    periodKey: input.periodKey,
    timezone: window.timezone,
    language,
    modelId: model,
  };
  return {
    model,
    language,
    window,
    cacheKey: buildPersonalForecastCacheKey(common),
    inputHash: buildPersonalForecastInputHash(common),
    contentVariant: VARIANT_BY_PERIOD[input.period],
  };
}

function rawEvidenceMetadata(item: PersonalForecastCalculatedEvidence) {
  return {
    id: item.id,
    kind: item.kind,
    transitPlanet: item.transitPlanet ?? null,
    natalPoint: item.natalPoint ?? null,
    aspect: item.aspect ?? null,
    house: item.house ?? null,
    orb: item.orb ?? null,
    status: item.status,
    exactAt: item.exactAt ?? null,
    startsAt: item.startsAt ?? null,
    endsAt: item.endsAt ?? null,
    strength: item.strength,
    polarity: item.polarity,
    calculationSource: item.calculationSource,
    motion: item.motion ?? null,
    ingress: item.ingress ?? null,
  };
}

async function appendForecastCalculationSnapshot(input: {
  cache: PersonalForecastCacheContext;
  identity: Awaited<ReturnType<typeof resolveCacheIdentity>>;
  calculated: EvidenceCalculationResult;
  semanticFacts: ForecastSemanticFact[];
}): Promise<number> {
  const chartData = input.cache.ctx.chartData!;
  const chartId = input.cache.ctx.chartId!;
  const reliability = resolvePersonalForecastChartReliability(chartData);
  const metadata = (chartData as typeof chartData & {
    calculationMetadata?: {
      ephemerisMode?: string | null;
      houseSystem?: string | null;
    };
  }).calculationMetadata;
  const snapshot = await appendCalculationSnapshot({
    userId: String(input.cache.ctx.profile.id),
    subjectChartId: chartId,
    surface: 'forecast',
    period: input.cache.period,
    periodKey: input.cache.periodKey,
    inputHash: input.identity.inputHash,
    calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
    ephemerisSource: metadata?.ephemerisMode || 'swisseph',
    houseSystem: metadata?.houseSystem || null,
    birthTimeStatus: reliability.birthTimeQuality,
    calculationPayload: {
      chartFingerprint: buildPersonalForecastChartFingerprint(chartData),
      natalCalculationVersion: chartData.calculationVersion || null,
      forecastCalculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      periodStart: input.identity.window.periodStart,
      periodEnd: input.identity.window.periodEnd,
    },
    evidencePayload: {
      current: input.calculated.evidence.map(rawEvidenceMetadata),
      continuation: input.calculated.continuationEvidence.map(rawEvidenceMetadata),
    },
    provenance: {
      source: 'personal_forecast_semantic_pipeline',
      semanticFactCount: input.semanticFacts.length,
      containsGeneratedProse: false,
    },
    schemaVersion: ASTROLOGY_HISTORY_SCHEMA_VERSION,
  });
  return snapshot.id;
}

async function appendForecastGeneratedArtifact(input: {
  cache: PersonalForecastCacheContext;
  identity: Awaited<ReturnType<typeof resolveCacheIdentity>>;
  forecast: PersonalForecastPackage;
  calculationSnapshotId: number;
}): Promise<void> {
  const semanticFingerprints = [...new Set(
    [input.forecast.overview, ...input.forecast.sections]
      .map((section) => section.semanticFingerprint.trim())
      .filter(Boolean),
  )];
  await appendGeneratedArtifact({
    userId: String(input.cache.ctx.profile.id),
    subjectChartId: input.cache.ctx.chartId!,
    calculationSnapshotId: input.calculationSnapshotId,
    surface: 'forecast',
    variant: input.identity.contentVariant,
    period: input.cache.period,
    periodKey: input.cache.periodKey,
    language: input.identity.language,
    contentPayload: input.forecast,
    semanticFingerprints,
    provider: 'openai',
    modelId: input.identity.model,
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    voiceVersion: APP_VOICE_VERSION,
    semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
    contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
    validationStatus: input.forecast.meta.validationStatus,
    generationAttempts: input.forecast.meta.generationAttempts,
    inputHash: input.identity.inputHash,
    provenance: {
      source: 'personal_forecast_semantic_pipeline',
      displayOnly: true,
      isFactualEvidence: false,
    },
    schemaVersion: ASTROLOGY_HISTORY_SCHEMA_VERSION,
  });
}

export async function getCachedPersonalForecast(
  input: PersonalForecastCacheContext,
  options: { allowExpired?: boolean } = {},
): Promise<{
  forecast: PersonalForecastPackage;
  model: string;
  cacheKey: string;
  inputHash: string;
} | null> {
  const identity = await resolveCacheIdentity(input);
  const userId = String(input.ctx.profile.id);
  const existing = input.ctx.chartId != null
    ? await db.content_interpretations.getByChart(
        input.ctx.chartId,
        CANONICAL_CACHE_TIER,
        'forecast',
        identity.contentVariant,
        identity.cacheKey,
        options.allowExpired === true,
      )
    : await db.content_interpretations.getByUser(
        userId,
        CANONICAL_CACHE_TIER,
        'forecast',
        identity.contentVariant,
        identity.cacheKey,
        options.allowExpired === true,
      );
  const interpretation = existing as ContentInterpretation<PersonalForecastPackage> | null;
  if (
    !interpretation
    || interpretation.inputHash !== identity.inputHash
    || interpretation.promptVersion !== PERSONAL_FORECAST_PROMPT_VERSION
    || interpretation.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || !isPersonalForecastPackage(interpretation.content)
    || interpretation.content.meta.model !== identity.model
  ) {
    return null;
  }
  return {
    forecast: interpretation.content,
    model: identity.model,
    cacheKey: identity.cacheKey,
    inputHash: identity.inputHash,
  };
}

async function savePersonalForecast(
  input: PersonalForecastCacheContext,
  forecast: PersonalForecastPackage,
  identity: Awaited<ReturnType<typeof resolveCacheIdentity>>,
): Promise<void> {
  const payload = {
    accessTier: CANONICAL_CACHE_TIER,
    contentSurface: 'forecast' as const,
    contentVariant: identity.contentVariant,
    cacheKey: identity.cacheKey,
    inputHash: identity.inputHash,
    content: forecast,
    modelTier: 'premium' as const,
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    isPersistent: false,
    legacySource: null,
    validFrom: identity.window.startsAt,
    validTo: identity.window.validTo,
  };
  const userId = String(input.ctx.profile.id);
  if (input.ctx.chartId != null) {
    await db.content_interpretations.upsertByChart(
      input.ctx.chartId,
      payload,
      userId,
    );
    return;
  }
  await db.content_interpretations.upsertByUser(userId, payload);
}

export async function ensurePersonalForecast(
  input: PersonalForecastCacheContext,
): Promise<ContentGenerationLockResult<PersonalForecastPackage>> {
  const identity = await resolveCacheIdentity(input);
  return withContentGenerationLock<PersonalForecastPackage>({
    lockKey: buildContentGenerationLockKey({
      userId: String(input.ctx.profile.id),
      chartId: input.ctx.chartId,
      accessTier: CANONICAL_CACHE_TIER,
      contentSurface: 'forecast',
      contentVariant: identity.contentVariant,
      cacheKey: identity.cacheKey,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    }),
    operation: `personal-forecast-feed-v4-${input.period}`,
    allowLocalLockFallback: true,
    readCached: async () => {
      try {
        const cached = await getCachedPersonalForecast(input);
        return cached ? { value: cached.forecast, source: 'cache' } : null;
      } catch (error) {
        console.error(
          '[personal-forecast-feed-v4] cache read failed; continuing with calculation:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    },
    generate: async () => {
      const historyContext = await getAstrologyHistoryContext({
        userId: String(input.ctx.profile.id),
        subjectChartId: input.ctx.chartId!,
        surface: 'forecast',
        calculationLimit: 8,
        factLimit: 20,
        messageLimit: 12,
        artifactLimit: 20,
      }).catch((error) => {
        console.error(
          '[personal-forecast-feed-v4] history context unavailable:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      });
      const previousPeriodKey = getPreviousPersonalForecastPeriodKey(
        input.period,
        input.periodKey,
        identity.window.timezone,
      );
      const previous = await getCachedPersonalForecast({
        ...input,
        periodKey: previousPeriodKey,
      }, { allowExpired: true }).catch((error) => {
        console.error(
          '[personal-forecast-feed-v4] previous forecast unavailable:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      });
      let calculationSnapshotId: number | null = null;
      const forecast = await generatePersonalForecastPackage({
        profile: input.ctx.profile,
        chartData: input.ctx.chartData!,
        model: identity.model,
        period: input.period,
        window: identity.window,
        previousForecast: previous?.forecast ?? null,
        historyContext,
        onEvidenceCalculated: async ({ calculated, semanticFacts }) => {
          try {
            calculationSnapshotId = await appendForecastCalculationSnapshot({
              cache: input,
              identity,
              calculated,
              semanticFacts,
            });
          } catch (error) {
            console.error(
              '[personal-forecast-feed-v4] calculation history write failed:',
              error instanceof Error ? error.message : String(error),
            );
          }
          return { calculationSnapshotId };
        },
      });
      if (!isPersonalForecastPackage(forecast)) {
        throw new Error(
          `PERSONAL_FORECAST_PACKAGE_INVALID:${getPersonalForecastPackageValidationError(forecast) || 'UNKNOWN'}`,
        );
      }
      try {
        await savePersonalForecast(input, forecast, identity);
      } catch (error) {
        console.error(
          '[personal-forecast-feed-v4] cache write failed; returning calculated forecast:',
          error instanceof Error ? error.message : String(error),
        );
      }
      if (calculationSnapshotId != null) {
        try {
          await appendForecastGeneratedArtifact({
            cache: input,
            identity,
            forecast,
            calculationSnapshotId,
          });
        } catch (error) {
          console.error(
            '[personal-forecast-feed-v4] generated history write failed:',
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      return forecast;
    },
  });
}
