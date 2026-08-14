import type { ContentInterpretation, UserProfile } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import {
  AI_PERSONAL_HOROSCOPE_TIMEZONE,
  buildAiPersonalHoroscopeCacheKey,
  buildAiPersonalHoroscopeInputHash,
  isAiPersonalHoroscopePackage,
  personalHoroscopeReadingToRecent,
  type AiPersonalHoroscopeRecentReading,
} from './aiPersonalHoroscope';
import {
  generateAiPersonalHoroscopePackage,
} from './aiPersonalHoroscopeGeneration';
import { loadAiPersonalHoroscopeDialogueMemory } from './aiPersonalHoroscopeMemory';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
  type ContentGenerationLockResult,
} from './contentGenerationLock';
import { db } from './db';
import { OPENAI_LUNA_MODEL } from './openai-models';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  getPreviousPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from './personalForecastContract';

const CANONICAL_CACHE_TIER = 'premium' as const;

const VARIANT_BY_PERIOD = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
} as const;

const HISTORY_LIMIT_BY_PERIOD: Record<PersonalForecastPeriod, number> = {
  day: 4,
  week: 2,
  month: 2,
};

/**
 * `ctx.profile` remains accepted for temporary source compatibility with old
 * callers and tests. No chart field is read, hashed, cached or sent to Luna.
 */
export type PersonalForecastCacheContext = {
  profile?: UserProfile;
  ctx?: { profile: UserProfile };
  period: PersonalForecastPeriod;
  periodKey: string;
  timezone?: string;
};

function profileFrom(input: PersonalForecastCacheContext): UserProfile {
  const profile = input.profile || input.ctx?.profile;
  if (!profile?.id) throw new Error('PERSONAL_FORECAST_PROFILE_REQUIRED');
  return profile;
}

async function resolveCacheIdentity(input: PersonalForecastCacheContext) {
  const profile = profileFrom(input);
  const model = OPENAI_LUNA_MODEL;
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const timezone = normalizeForecastTimezone(
    input.timezone || profile.birthTimezone || AI_PERSONAL_HOROSCOPE_TIMEZONE,
  );
  const window = resolvePersonalForecastWindow(input.period, input.periodKey, timezone);
  const common = {
    profile,
    period: input.period,
    periodKey: input.periodKey,
    timezone: window.timezone,
    language,
    modelId: model,
  };
  return {
    profile,
    userId: String(profile.id),
    common,
    model,
    language,
    window,
    cacheKey: buildAiPersonalHoroscopeCacheKey(common),
    inputHash: buildAiPersonalHoroscopeInputHash(common),
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
  const existing = await db.content_interpretations.getByUser(
    identity.userId,
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
    || !isAiPersonalHoroscopePackage(interpretation.content)
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
  const existing = await db.content_interpretations.getLatestByUserVariant(
    identity.userId,
    CANONICAL_CACHE_TIER,
    'forecast',
    identity.contentVariant,
  );
  const interpretation = existing as ContentInterpretation<PersonalForecastPackage> | null;
  const forecast = interpretation?.content;
  if (
    !interpretation
    || !forecast
    || interpretation.promptVersion !== PERSONAL_FORECAST_PROMPT_VERSION
    || interpretation.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta.contractVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || forecast.meta.semanticVersion !== PERSONAL_FORECAST_CONTRACT_VERSION
    || forecast.meta.calculationVersion !== PERSONAL_FORECAST_CALCULATION_VERSION
    || forecast.meta.voiceVersion !== APP_VOICE_VERSION
    || forecast.meta.model !== identity.model
    || forecast.period !== input.period
    || forecast.periodKey !== input.periodKey
    || !isAiPersonalHoroscopePackage(forecast)
    || interpretation.inputHash !== identity.inputHash
  ) {
    return null;
  }
  return {
    forecast,
    model: identity.model,
    cacheKey: interpretation.cacheKey,
    inputHash: identity.inputHash,
  };
}

function readingFromUnknown(value: unknown): AiPersonalHoroscopeRecentReading | null {
  if (!isAiPersonalHoroscopePackage(value)) return null;
  return personalHoroscopeReadingToRecent(value);
}

/**
 * Previous readings are private continuity and anti-repeat context only. They
 * are never served as the package for a different date or period.
 */
export async function getRecentPersonalForecastHistory(
  input: PersonalForecastCacheContext,
): Promise<AiPersonalHoroscopeRecentReading[]> {
  const identity = await resolveCacheIdentity(input);
  const readings: AiPersonalHoroscopeRecentReading[] = [];
  const seen = new Set<string>();
  const add = (reading: AiPersonalHoroscopeRecentReading | null) => {
    if (!reading) return;
    const key = `${reading.periodKey}:${reading.fragments.map((fragment) => fragment.text).join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    readings.push(reading);
  };

  try {
    const latest = await db.content_interpretations.getLatestByUserVariant(
      identity.userId,
      CANONICAL_CACHE_TIER,
      'forecast',
      identity.contentVariant,
    );
    add(readingFromUnknown((latest as ContentInterpretation<unknown> | null)?.content));
  } catch (error) {
    console.warn(
      '[ai-personal-horoscope] latest history unavailable; continuing:',
      error instanceof Error ? error.message : String(error),
    );
  }

  let previousKey = input.periodKey;
  const historyLimit = HISTORY_LIMIT_BY_PERIOD[input.period];
  for (let index = 0; index < historyLimit; index += 1) {
    previousKey = getPreviousPersonalForecastPeriodKey(
      input.period,
      previousKey,
      identity.window.timezone,
    );
    try {
      const cached = await getCachedPersonalForecast(
        {
          profile: identity.profile,
          period: input.period,
          periodKey: previousKey,
          timezone: identity.window.timezone,
        },
        { allowExpired: true },
      );
      add(cached ? readingFromUnknown(cached.forecast) : null);
    } catch (error) {
      console.warn(
        `[ai-personal-horoscope] history unavailable for ${previousKey}; continuing:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return readings.slice(0, historyLimit + 1);
}

async function savePersonalForecast(
  forecast: PersonalForecastPackage,
  identity: Awaited<ReturnType<typeof resolveCacheIdentity>>,
): Promise<void> {
  await db.content_interpretations.upsertByUser(identity.userId, {
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
  });
}

export async function ensurePersonalForecast(
  input: PersonalForecastCacheContext,
): Promise<ContentGenerationLockResult<PersonalForecastPackage>> {
  const identity = await resolveCacheIdentity(input);
  return withContentGenerationLock<PersonalForecastPackage>({
    lockKey: buildContentGenerationLockKey({
      userId: identity.userId,
      chartId: null,
      accessTier: CANONICAL_CACHE_TIER,
      contentSurface: 'forecast',
      contentVariant: identity.contentVariant,
      cacheKey: identity.cacheKey,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
    }),
    operation: `ai-personal-horoscope-${input.period}`,
    allowLocalLockFallback: true,
    readCached: async () => {
      try {
        const cached = await getCachedPersonalForecast(input);
        return cached ? { value: cached.forecast, source: 'cache' } : null;
      } catch (error) {
        console.error(
          '[ai-personal-horoscope] cache read failed; continuing with Luna:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    },
    generate: async () => {
      const [recentForecasts, conversationMemory] = await Promise.all([
        getRecentPersonalForecastHistory(input).catch((error) => {
          console.warn(
            '[ai-personal-horoscope] forecast history unavailable; continuing:',
            error instanceof Error ? error.message : String(error),
          );
          return [];
        }),
        loadAiPersonalHoroscopeDialogueMemory(identity.userId),
      ]);
      const forecast = await generateAiPersonalHoroscopePackage({
        profile: identity.profile,
        model: identity.model,
        period: input.period,
        window: identity.window,
        recentForecasts,
        conversationMemory,
      });
      if (!isAiPersonalHoroscopePackage(forecast)) {
        throw new Error('PERSONAL_FORECAST_PACKAGE_INVALID:AI_ONLY_CONTRACT');
      }
      try {
        await savePersonalForecast(forecast, identity);
      } catch (error) {
        console.error(
          '[ai-personal-horoscope] cache write failed; returning generated forecast:',
          error instanceof Error ? error.message : String(error),
        );
      }
      return forecast;
    },
  });
}
