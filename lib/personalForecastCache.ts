import type { ContentInterpretation, UserProfile } from '../types';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_TIMEZONE,
  buildAiPersonalHoroscopeCacheKey,
  buildAiPersonalHoroscopeInputHash,
  getAiPersonalHoroscopeCurrentDate,
  isAiPersonalHoroscopePackage,
  normalizeAiPersonalHoroscopeTimezone,
  resolveAiPersonalHoroscopeWindow,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
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
  const currentDate = getAiPersonalHoroscopeCurrentDate(window);
  const common = {
    profile: input.profile,
    period: input.period,
    periodKey: input.periodKey,
    currentDate,
    timezone: window.timezone,
    language,
    modelId: model,
  };
  return {
    profile: input.profile,
    userId: String(input.profile.id),
    common,
    currentDate,
    model,
    window,
    cacheKey: buildAiPersonalHoroscopeCacheKey(common),
    inputHash: buildAiPersonalHoroscopeInputHash(common),
    contentVariant: VARIANT_BY_PERIOD[input.period],
  };
}

export function buildAiPersonalHoroscopeGenerationLockKey(input: {
  userId: string;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
}): string {
  return [
    'ai-personal-horoscope-generation',
    String(input.userId).trim(),
    input.period,
    input.periodKey,
    input.currentDate,
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
    || interpretation.content.currentDate !== identity.currentDate
  ) return null;

  return {
    horoscope: interpretation.content,
    model: identity.model,
    cacheKey: identity.cacheKey,
    inputHash: identity.inputHash,
  };
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
  options: { forceRegenerate?: boolean } = {},
): Promise<ContentGenerationLockResult<AiPersonalHoroscopePackage>> {
  const identity = await resolveCacheIdentity(input);
  const forceRegenerate = options.forceRegenerate === true;
  return withContentGenerationLock<AiPersonalHoroscopePackage>({
    lockKey: buildAiPersonalHoroscopeGenerationLockKey({
      userId: identity.userId,
      period: input.period,
      periodKey: input.periodKey,
      currentDate: identity.currentDate,
    }),
    operation: `ai-personal-horoscope-${input.period}`,
    allowLocalLockFallback: true,
    readCached: async () => {
      if (forceRegenerate) return null;
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
      const horoscope = await generateAiPersonalHoroscopePackage({
        profile: identity.profile,
        period: input.period,
        window: identity.window,
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
