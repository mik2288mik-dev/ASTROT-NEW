import type { ContentInterpretation, UserProfile } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from './appVoice';
import { getUnifiedContentModel } from './appSettings';
import { buildContentGenerationLockKey, withContentGenerationLock, type ContentGenerationLockResult } from './contentGenerationLock';
import { db, getPool } from './db';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastBirthProfileFingerprint,
  buildPersonalForecastCacheKey,
  buildPersonalForecastInputHash,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPackage,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastRawProfile,
  type PersonalForecastSemanticSignature,
} from './personalForecastContract';
import {
  PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT,
  generatePersonalForecastPackage,
  type PersonalForecastRecentReading,
  type PersonalForecastRepeatFragment,
} from './personalForecastGeneration';

const CACHE_TIER = 'premium' as const;
const HISTORY_LIMIT = 15;
const CROSS_USER_PACKAGE_LIMIT = 64;
const VARIANT_BY_PERIOD = { day: 'daily', week: 'weekly', month: 'monthly' } as const;

export type PersonalForecastCacheContext = {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: 'free' | 'premium';
  period: PersonalForecastPeriod;
  periodKey: string;
};

function profileIsReady(profile: PersonalForecastRawProfile): boolean {
  return Boolean(String(profile.name || '').trim() && String(profile.birthDate || '').trim());
}

async function identity(input: PersonalForecastCacheContext) {
  if (!input.userId || !profileIsReady(input.profile)) throw new Error('PERSONAL_FORECAST_PROFILE_REQUIRED');
  const model = await getUnifiedContentModel();
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const timezone = normalizeForecastTimezone(input.profile.birthTimezone);
  const window = resolvePersonalForecastWindow(input.period, input.periodKey, timezone);
  const common = {
    userId: input.userId,
    birthProfileFingerprint: buildPersonalForecastBirthProfileFingerprint(input.profile),
    period: input.period,
    periodKey: input.periodKey,
    timezone: window.timezone,
    language,
    modelId: model,
  };
  return { model, language, window, common, contentVariant: VARIANT_BY_PERIOD[input.period],
    cacheKey: buildPersonalForecastCacheKey(common), inputHash: buildPersonalForecastInputHash(common) };
}

function valid(interpretation: ContentInterpretation<PersonalForecastPackage> | null, resolved: Awaited<ReturnType<typeof identity>>) {
  const forecast = interpretation?.content;
  return Boolean(interpretation && forecast
    && interpretation.inputHash === resolved.inputHash
    && interpretation.promptVersion === PERSONAL_FORECAST_PROMPT_VERSION
    && interpretation.calculationVersion === PERSONAL_FORECAST_CALCULATION_VERSION
    && forecast.meta.contractVersion === PERSONAL_FORECAST_CONTRACT_VERSION
    && forecast.meta.voiceVersion === PERSONAL_FORECAST_VOICE_VERSION
    && forecast.meta.model === resolved.model
    && isPersonalForecastPackage(forecast));
}

export async function getCachedPersonalForecast(input: PersonalForecastCacheContext, options: { allowExpired?: boolean } = {}) {
  const resolved = await identity(input);
  const raw = await db.content_interpretations.getByUser(input.userId, CACHE_TIER, 'forecast', resolved.contentVariant, resolved.cacheKey, options.allowExpired === true) as ContentInterpretation<PersonalForecastPackage> | null;
  if (!valid(raw, resolved)) return null;
  return { forecast: raw!.content, model: resolved.model, cacheKey: resolved.cacheKey, inputHash: resolved.inputHash };
}

/** Old chart-scoped and previous-contract packages are deliberately never stale-compatible. */
export async function getCompatibleStalePersonalForecast(input: PersonalForecastCacheContext) {
  const cached = await getCachedPersonalForecast(input, { allowExpired: true });
  if (!cached || cached.forecast.period !== input.period || cached.forecast.periodKey !== input.periodKey) return null;
  return cached;
}

function reading(value: unknown): PersonalForecastRecentReading | null {
  if (!isPersonalForecastPackage(value)) return null;
  const all = [value.overview, ...value.sections];
  const fragments = [
    { kind: 'headline' as const, text: value.overview.title || '', semanticFingerprint: null },
    ...all.filter((section) => section.text.trim()).map((section) => ({ kind: 'fragment' as const, text: section.text, semanticFingerprint: section.semanticFingerprint || null })),
  ].filter((item) => item.text.trim());
  return fragments.length ? {
    period: value.period,
    periodKey: value.periodKey,
    fragments,
    semanticSignature: value.meta.semanticSignature,
  } : null;
}

/** Exactly this user, all three periods, newest first; never provider input from another user. */
export async function getRecentPersonalForecastHistory(input: PersonalForecastCacheContext): Promise<PersonalForecastRecentReading[]> {
  const result = await getPool().query(
    `SELECT content FROM content_interpretations
     WHERE user_id = $1 AND access_tier = $2 AND content_surface = 'forecast'
       AND content->'meta'->>'contractVersion' = $3
     ORDER BY updated_at DESC LIMIT $4`, [input.userId, CACHE_TIER, PERSONAL_FORECAST_CONTRACT_VERSION, HISTORY_LIMIT + 1],
  );
  const seen = new Set<string>();
  return (result.rows as Array<{content: unknown}>).flatMap((row) => {
    const item = reading(row.content);
    if (!item || item.periodKey === input.periodKey) return [];
    const key = `${item.periodKey}:${item.fragments.map((part) => part.text).join('\n')}`;
    if (seen.has(key)) return [];
    seen.add(key); return [item];
  }).slice(0, HISTORY_LIMIT);
}

function repeatFragments(value: unknown): PersonalForecastRepeatFragment[] {
  const item = reading(value);
  return (item?.fragments || []).map((part) => ({ kind: part.kind, text: part.text, semanticFingerprint: part.semanticFingerprint }));
}

/** Server-only local comparison corpus. Its text is never logged or passed to Luna. */
async function getCrossUserRepeatFragments(input: PersonalForecastCacheContext, resolved: Awaited<ReturnType<typeof identity>>) {
  const result = await getPool().query(
    `SELECT content FROM content_interpretations
     WHERE user_id IS DISTINCT FROM $1 AND access_tier = $2
       AND content_surface = 'forecast' AND content_variant = $3
       AND content->>'periodKey' = $4 AND prompt_version = $5 AND calculation_version = $6
       AND content->'meta'->>'contractVersion' = $7
     ORDER BY updated_at DESC LIMIT $8`,
    [input.userId, CACHE_TIER, resolved.contentVariant, input.periodKey, PERSONAL_FORECAST_PROMPT_VERSION, PERSONAL_FORECAST_CALCULATION_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION, CROSS_USER_PACKAGE_LIMIT],
  );
  return (result.rows as Array<{content: unknown}>).flatMap((row) => repeatFragments(row.content)).slice(0, PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT);
}

/** A compact server-only semantic corpus. No foreign copy is passed to Luna. */
async function getCrossUserSemanticSignatures(
  input: PersonalForecastCacheContext,
  resolved: Awaited<ReturnType<typeof identity>>,
): Promise<PersonalForecastSemanticSignature[]> {
  const result = await getPool().query(
    `SELECT content FROM content_interpretations
     WHERE user_id IS DISTINCT FROM $1 AND access_tier = $2
       AND content_surface = 'forecast' AND content_variant = $3
       AND content->>'periodKey' = $4 AND prompt_version = $5 AND calculation_version = $6
       AND content->'meta'->>'contractVersion' = $7
     ORDER BY updated_at DESC LIMIT $8`,
    [input.userId, CACHE_TIER, resolved.contentVariant, input.periodKey, PERSONAL_FORECAST_PROMPT_VERSION, PERSONAL_FORECAST_CALCULATION_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION, CROSS_USER_PACKAGE_LIMIT],
  );
  return (result.rows as Array<{ content: unknown }>).flatMap((row) => {
    if (!isPersonalForecastPackage(row.content)) return [];
    return [row.content.meta.semanticSignature];
  });
}

async function save(input: PersonalForecastCacheContext, forecast: PersonalForecastPackage, resolved: Awaited<ReturnType<typeof identity>>) {
  await db.content_interpretations.upsertByUser(input.userId, {
    accessTier: CACHE_TIER, contentSurface: 'forecast', contentVariant: resolved.contentVariant,
    cacheKey: resolved.cacheKey, inputHash: resolved.inputHash, content: forecast, modelTier: 'premium',
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION, calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    isPersistent: false, legacySource: null, validFrom: resolved.window.startsAt, validTo: resolved.window.validTo,
  });
}

export async function ensurePersonalForecast(input: PersonalForecastCacheContext, options: { forceRegenerate?: boolean; minimumGeneratedAt?: string | null } = {}): Promise<ContentGenerationLockResult<PersonalForecastPackage>> {
  const resolved = await identity(input);
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({ userId: input.userId, accessTier: CACHE_TIER, contentSurface: 'forecast', contentVariant: resolved.contentVariant, cacheKey: resolved.cacheKey, promptVersion: PERSONAL_FORECAST_PROMPT_VERSION }),
    operation: `personal-forecast-${input.period}`, allowLocalLockFallback: true,
    readCached: async () => {
      if (options.forceRegenerate) return null;
      const cached = await getCachedPersonalForecast(input);
      return cached ? { value: cached.forecast, source: 'cache' as const } : null;
    },
    generate: async () => {
      const [recentForecasts, crossUserRepeatFragments, crossUserSemanticSignatures] = await Promise.all([
        getRecentPersonalForecastHistory(input).catch(() => []),
        getCrossUserRepeatFragments(input, resolved).catch(() => []),
        getCrossUserSemanticSignatures(input, resolved).catch(() => []),
      ]);
      const forecast = await generatePersonalForecastPackage({ profile: input.profile as UserProfile, model: resolved.model, period: input.period, window: resolved.window, recentForecasts, crossUserRepeatFragments, crossUserSemanticSignatures });
      if (!isPersonalForecastPackage(forecast)) throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${getPersonalForecastPackageValidationError(forecast) || 'UNKNOWN'}`);
      await save(input, forecast, resolved).catch(() => undefined);
      return forecast;
    },
  });
}
