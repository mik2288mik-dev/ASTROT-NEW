import type { ContentInterpretation, UserProfile } from '../types';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_TIMEZONE,
  buildAiPersonalHoroscopeCacheKey,
  buildAiPersonalHoroscopeInputHash,
  getPreviousAiPersonalHoroscopePeriodKey,
  isAiPersonalHoroscopePackage,
  normalizeAiPersonalHoroscopeTimezone,
  resolveAiPersonalHoroscopeWindow,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeRecentMemory,
} from './aiPersonalHoroscope';
import { generateAiPersonalHoroscopePackage } from './aiPersonalHoroscopeGeneration';
import {
  withContentGenerationLock,
  type ContentGenerationLockResult,
} from './contentGenerationLock';
import { db } from './db';
import { OPENAI_LUNA_MODEL } from './openai-models';

const CANONICAL_CACHE_TIER = 'premium' as const;

const VARIANT_BY_PERIOD = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
} as const;

const ALL_VARIANTS = [
  VARIANT_BY_PERIOD.day,
  VARIANT_BY_PERIOD.week,
  VARIANT_BY_PERIOD.month,
] as const;

const HISTORY_LIMIT_BY_PERIOD: Record<AiPersonalHoroscopePeriod, number> = {
  day: 4,
  week: 2,
  month: 2,
};

export type PersonalForecastCacheContext = {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  timezone?: string;
};

async function resolveCacheIdentity(input: PersonalForecastCacheContext) {
  if (!input.profile?.id) throw new Error('PERSONAL_HOROSCOPE_PROFILE_REQUIRED');
  const model = OPENAI_LUNA_MODEL;
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const timezone = normalizeAiPersonalHoroscopeTimezone(
    input.timezone || input.profile.birthTimezone || AI_PERSONAL_HOROSCOPE_TIMEZONE,
  );
  const window = resolveAiPersonalHoroscopeWindow(input.period, input.periodKey, timezone);
  const common = {
    profile: input.profile,
    period: input.period,
    periodKey: input.periodKey,
    timezone: window.timezone,
    language,
    modelId: model,
  };
  return {
    profile: input.profile,
    userId: String(input.profile.id),
    common,
    model,
    window,
    cacheKey: buildAiPersonalHoroscopeCacheKey(common),
    inputHash: buildAiPersonalHoroscopeInputHash(common),
    contentVariant: VARIANT_BY_PERIOD[input.period],
  };
}

export function buildAiPersonalHoroscopeGenerationLockKey(userId: string): string {
  return [
    'ai-personal-horoscope-generation',
    String(userId).trim(),
    'all-periods',
    AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  ].join(':');
}

export async function getCachedPersonalForecast(
  input: PersonalForecastCacheContext,
  options: { allowExpired?: boolean } = {},
): Promise<{
  horoscope: AiPersonalHoroscopePackage;
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
  const interpretation = existing as ContentInterpretation<AiPersonalHoroscopePackage> | null;
  if (
    !interpretation
    || interpretation.inputHash !== identity.inputHash
    || interpretation.promptVersion !== AI_PERSONAL_HOROSCOPE_PROMPT_VERSION
    || interpretation.calculationVersion !== AI_PERSONAL_HOROSCOPE_CACHE_VERSION
    || !isAiPersonalHoroscopePackage(interpretation.content)
    || interpretation.content.meta.model !== identity.model
  ) return null;

  return {
    horoscope: interpretation.content,
    model: identity.model,
    cacheKey: identity.cacheKey,
    inputHash: identity.inputHash,
  };
}

export async function getCompatibleStalePersonalForecast(
  input: PersonalForecastCacheContext,
): Promise<{
  horoscope: AiPersonalHoroscopePackage;
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
  const interpretation = existing as ContentInterpretation<AiPersonalHoroscopePackage> | null;
  const horoscope = interpretation?.content;
  if (
    !interpretation
    || !horoscope
    || interpretation.promptVersion !== AI_PERSONAL_HOROSCOPE_PROMPT_VERSION
    || interpretation.calculationVersion !== AI_PERSONAL_HOROSCOPE_CACHE_VERSION
    || interpretation.inputHash !== identity.inputHash
    || !isAiPersonalHoroscopePackage(horoscope)
    || horoscope.period !== input.period
    || horoscope.periodKey !== input.periodKey
    || horoscope.meta.model !== identity.model
  ) return null;

  return {
    horoscope,
    model: identity.model,
    cacheKey: interpretation.cacheKey,
    inputHash: identity.inputHash,
  };
}

function recentMemoryFromUnknown(value: unknown): AiPersonalHoroscopeRecentMemory | null {
  if (!isAiPersonalHoroscopePackage(value)) return null;
  return {
    period: value.period,
    periodKey: value.periodKey,
    themeKeywords: value.continuity.themeKeywords.slice(0, 8),
    adviceKeywords: value.continuity.adviceKeywords.slice(0, 8),
  };
}

export async function getRecentPersonalForecastMemory(
  input: PersonalForecastCacheContext,
): Promise<AiPersonalHoroscopeRecentMemory[]> {
  const identity = await resolveCacheIdentity(input);
  const memories: AiPersonalHoroscopeRecentMemory[] = [];
  const seen = new Set<string>();
  const add = (memory: AiPersonalHoroscopeRecentMemory | null) => {
    if (!memory) return;
    const key = JSON.stringify(memory);
    if (seen.has(key)) return;
    seen.add(key);
    memories.push(memory);
  };

  for (const contentVariant of ALL_VARIANTS) {
    try {
      const latest = await db.content_interpretations.getLatestByUserVariant(
        identity.userId,
        CANONICAL_CACHE_TIER,
        'forecast',
        contentVariant,
      );
      add(recentMemoryFromUnknown(
        (latest as ContentInterpretation<unknown> | null)?.content,
      ));
    } catch (error) {
      console.warn(
        `[ai-personal-horoscope] compact ${contentVariant} memory unavailable; continuing:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  let previousKey = input.periodKey;
  for (let index = 0; index < HISTORY_LIMIT_BY_PERIOD[input.period]; index += 1) {
    previousKey = getPreviousAiPersonalHoroscopePeriodKey(
      input.period,
      previousKey,
      identity.window.timezone,
    );
    try {
      const cached = await getCachedPersonalForecast({
        profile: identity.profile,
        period: input.period,
        periodKey: previousKey,
        timezone: identity.window.timezone,
      }, { allowExpired: true });
      add(cached ? recentMemoryFromUnknown(cached.horoscope) : null);
    } catch (error) {
      console.warn(
        `[ai-personal-horoscope] compact history unavailable for ${previousKey}; continuing:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return memories.slice(0, 8);
}

async function savePersonalForecast(
  horoscope: AiPersonalHoroscopePackage,
  identity: Awaited<ReturnType<typeof resolveCacheIdentity>>,
): Promise<void> {
  await db.content_interpretations.upsertByUser(identity.userId, {
    accessTier: CANONICAL_CACHE_TIER,
    contentSurface: 'forecast' as const,
    contentVariant: identity.contentVariant,
    cacheKey: identity.cacheKey,
    inputHash: identity.inputHash,
    content: horoscope,
    modelTier: 'premium' as const,
    promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    calculationVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
    isPersistent: false,
    legacySource: null,
    validFrom: identity.window.startsAt,
    validTo: identity.window.validTo,
  });
}

export async function ensurePersonalForecast(
  input: PersonalForecastCacheContext,
): Promise<ContentGenerationLockResult<AiPersonalHoroscopePackage>> {
  const identity = await resolveCacheIdentity(input);
  return withContentGenerationLock<AiPersonalHoroscopePackage>({
    lockKey: buildAiPersonalHoroscopeGenerationLockKey(identity.userId),
    operation: `ai-personal-horoscope-${input.period}`,
    allowLocalLockFallback: true,
    readCached: async () => {
      try {
        const cached = await getCachedPersonalForecast(input);
        return cached ? { value: cached.horoscope, source: 'cache' } : null;
      } catch (error) {
        console.error(
          '[ai-personal-horoscope] cache read failed; continuing with Luna:',
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    },
    generate: async () => {
      const recentMemory = await getRecentPersonalForecastMemory(input).catch((error) => {
        console.warn(
          '[ai-personal-horoscope] compact memory unavailable; continuing:',
          error instanceof Error ? error.message : String(error),
        );
        return [];
      });
      const horoscope = await generateAiPersonalHoroscopePackage({
        profile: identity.profile,
        period: input.period,
        window: identity.window,
        recentMemory,
      });
      if (!isAiPersonalHoroscopePackage(horoscope)) {
        throw new Error('PERSONAL_HOROSCOPE_PACKAGE_INVALID');
      }
      try {
        await savePersonalForecast(horoscope, identity);
      } catch (error) {
        console.error(
          '[ai-personal-horoscope] cache write failed; returning generated horoscope:',
          error instanceof Error ? error.message : String(error),
        );
      }
      return horoscope;
    },
  });
}
