import type { ContentInterpretation } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import { getUnifiedContentModel } from './appSettings';
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
  buildPersonalForecastCacheKey,
  buildPersonalForecastInputHash,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from './personalForecastContract';
import { generatePersonalForecastPackage } from './personalForecastGeneration';

const CANONICAL_CACHE_TIER = 'premium' as const;

const VARIANT_BY_PERIOD = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
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
    common,
    model,
    language,
    window,
    cacheKey: buildPersonalForecastCacheKey(common),
    inputHash: buildPersonalForecastInputHash(common),
    contentVariant: VARIANT_BY_PERIOD[input.period],
  };
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

export async function getCompatibleStalePersonalForecast(
  input: PersonalForecastCacheContext,
): Promise<{
  forecast: PersonalForecastPackage;
  model: string;
  cacheKey: string;
  inputHash: string;
} | null> {
  const identity = await resolveCacheIdentity(input);
  const userId = String(input.ctx.profile.id);
  const existing = input.ctx.chartId != null
    ? await db.content_interpretations.getLatestByChartVariant(
        input.ctx.chartId,
        CANONICAL_CACHE_TIER,
        'forecast',
        identity.contentVariant,
      )
    : await db.content_interpretations.getLatestByUserVariant(
        userId,
        CANONICAL_CACHE_TIER,
        'forecast',
        identity.contentVariant,
      );
  const interpretation = existing as ContentInterpretation<PersonalForecastPackage> | null;
  const forecast = interpretation?.content;
  const stalePromptVersion = interpretation?.promptVersion;
  if (
    !interpretation
    || !forecast
    || typeof stalePromptVersion !== 'string'
    || !stalePromptVersion.trim()
    || interpretation.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta.contractVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || forecast.meta.semanticVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || forecast.meta.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta.voiceVersion !== APP_VOICE_VERSION
    || forecast.meta.model !== identity.model
    || forecast.period !== input.period
    || forecast.periodKey !== input.periodKey
    || !isPersonalForecastPackage(forecast, { promptVersion: stalePromptVersion })
  ) {
    return null;
  }
  const expectedInputHash = buildPersonalForecastInputHash(identity.common, {
    calculationVersion: forecast.meta.calculationVersion,
    contractVersion: forecast.meta.contractVersion,
    promptVersion: stalePromptVersion,
    voiceVersion: forecast.meta.voiceVersion,
  });
  if (interpretation.inputHash !== expectedInputHash) return null;
  return {
    forecast,
    model: identity.model,
    cacheKey: interpretation.cacheKey,
    inputHash: expectedInputHash,
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
    operation: `personal-forecast-profile-v1-${input.period}`,
    allowLocalLockFallback: true,
    readCached: async () => {
      try {
        const cached = await getCachedPersonalForecast(input);
        return cached ? { value: cached.forecast, source: 'cache' } : null;
      } catch (error) {
        console.error(
          '[personal-forecast-profile-v1] cache read failed; continuing with Luna generation:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    },
    generate: async () => {
      const forecast = await generatePersonalForecastPackage({
        profile: input.ctx.profile,
        chartData: input.ctx.chartData!,
        model: identity.model,
        period: input.period,
        window: identity.window,
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
          '[personal-forecast-profile-v1] cache write failed; returning generated forecast:',
          error instanceof Error ? error.message : String(error),
        );
      }
      return forecast;
    },
  });
}
