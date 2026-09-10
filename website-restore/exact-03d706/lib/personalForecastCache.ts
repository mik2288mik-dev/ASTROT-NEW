import type { ContentInterpretation, UserProfile } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from './appVoice';
import { getUnifiedContentModel } from './appSettings';
import { buildContentGenerationLockKey, withContentGenerationLock, type ContentGenerationLockResult } from './contentGenerationLock';
import { db, getPool } from './db';
import { logForecastDeliveryMetric } from './forecastDeliveryMetrics';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastBirthProfileFingerprint,
  buildPersonalForecastCacheKey,
  buildPersonalForecastInputHash,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPeriodAllowedForTier,
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
    generationTier: input.accessTier,
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
  return Boolean(interpretation && isPersonalForecastPackage(forecast)
    && interpretation.inputHash === resolved.inputHash
    && interpretation.promptVersion === PERSONAL_FORECAST_PROMPT_VERSION
    && interpretation.calculationVersion === PERSONAL_FORECAST_CALCULATION_VERSION
    && forecast.meta.contractVersion === PERSONAL_FORECAST_CONTRACT_VERSION
    && forecast.meta.voiceVersion === PERSONAL_FORECAST_VOICE_VERSION
    && forecast.meta.model === resolved.model
    && forecast.period === resolved.common.period
    && forecast.periodKey === resolved.common.periodKey
    && forecast.timezone === resolved.window.timezone);
}

export async function getCachedPersonalForecast(input: PersonalForecastCacheContext, options: { allowExpired?: boolean } = {}) {
  const resolved = await identity(input);
  const raw = await db.content_interpretations.getByUser(input.userId, input.accessTier, 'forecast', resolved.contentVariant, resolved.cacheKey, options.allowExpired === true) as ContentInterpretation<PersonalForecastPackage> | null;
  if (!valid(raw, resolved)) {
    logForecastDeliveryMetric({ domain: 'personal', outcome: 'cache_miss', tier: input.accessTier, period: input.period, periodKey: input.periodKey });
    return null;
  }
  logForecastDeliveryMetric({ domain: 'personal', outcome: 'cache_hit', tier: input.accessTier, period: input.period, periodKey: input.periodKey });
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
    { kind: 'title' as const, text: value.overview.title || '', semanticFingerprint: null },
    ...all.flatMap((section) => {
      if (section.contentBlocks.length) {
        return section.contentBlocks.map((block) => ({
          kind: block.role === 'action'
            ? 'closing' as const
            : 'forecast' as const,
          text: block.text,
          semanticFingerprint: section.semanticFingerprint || null,
        }));
      }
      return section.text.trim()
        ? [{ kind: 'forecast' as const, text: section.text, semanticFingerprint: section.semanticFingerprint || null }]
        : [];
    }),
  ].filter((item) => item.text.trim());
  return fragments.length ? {
    period: value.period,
    periodKey: value.periodKey,
    fragments,
    semanticSignature: value.meta.semanticSignature,
    briefSignature: value.meta.astrologerBrief.briefSignature,
  } : null;
}

function historyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function historyText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** Only extracts visible copy from the persisted user-profile package family.
 * Historical text can prevent repetition without becoming a valid current response.
 */
function historicalReading(value: unknown): PersonalForecastRecentReading | null {
  const forecast = historyObject(value);
  const meta = historyObject(forecast?.meta);
  const version = historyText(meta?.contractVersion, 100).match(/^personal-forecast-feed-v(\d+)-[a-z0-9-]+$/u);
  const currentVersion = Number(PERSONAL_FORECAST_CONTRACT_VERSION.match(/-v(\d+)-/u)?.[1]);
  if (!forecast || !version || Number(version[1]) < 14 || Number(version[1]) > currentVersion) return null;
  const period = forecast.period;
  const periodKey = historyText(forecast.periodKey, 32);
  if (period !== 'day' && period !== 'week' && period !== 'month') return null;
  try { resolvePersonalForecastWindow(period, periodKey, 'UTC'); } catch { return null; }
  const overview = historyObject(forecast.overview);
  if (!overview || !Array.isArray(forecast.sections)) return null;
  const sections = forecast.sections.slice(0, 12).map(historyObject);
  if (sections.some((section) => !section)) return null;
  const title = historyText(overview.title, 120);
  const last = sections.at(-1);
  const lastBlocks = Array.isArray(last?.contentBlocks) ? last.contentBlocks : [];
  const lastBlock = lastBlocks.length === 1 ? historyObject(lastBlocks[0]) : null;
  const oldSignature = historyObject(meta?.semanticSignature);
  // Generated section IDs contain a content hash. Recognize the saved closing
  // contract as well as older explicit IDs; do not classify every legacy action as a closing.
  const hasClosing = last?.id === 'semantic:closing' || lastBlock?.atomId === 'closing'
    || (lastBlock?.role === 'action' && Boolean(historyText(oldSignature?.closing, 220)));
  const closing = hasClosing ? historyText(last?.text, 220) : '';
  const body = [overview, ...(hasClosing ? sections.slice(0, -1) : sections)]
    .map((section) => historyText(section?.text, 3_000)).filter(Boolean).join('\n\n').slice(0, 3_000);
  if (!body) return null;
  const fragments: PersonalForecastRecentReading['fragments'] = [
    ...(title ? [{ kind: 'title' as const, text: title, semanticFingerprint: null }] : []),
    { kind: 'forecast', text: body, semanticFingerprint: null },
    ...(closing ? [{ kind: 'closing' as const, text: closing, semanticFingerprint: null }] : []),
  ];
  const situation = historyText(oldSignature?.situation, 500);
  const turn = historyText(oldSignature?.turn, 500);
  const outcome = historyText(oldSignature?.outcome, 500);
  const briefSignature = historyText(historyObject(meta?.astrologerBrief)?.briefSignature, 256);
  return {
    period, periodKey, fragments,
    ...(situation && turn && outcome ? {
      semanticSignature: { situation, turn, outcome, title, forecast: body, closing },
    } : {}),
    ...(briefSignature ? { briefSignature } : {}),
  };
}

/** Exactly this user across prior versions and subscriptions; never another person's reading. */
export async function getRecentPersonalForecastHistory(input: PersonalForecastCacheContext): Promise<PersonalForecastRecentReading[]> {
  if (!String(input.userId || '').trim()) throw new Error('PERSONAL_FORECAST_PROFILE_REQUIRED');
  const result = await getPool().query(
    `SELECT user_id, content FROM content_interpretations
     WHERE user_id = $1 AND chart_id IS NULL AND content_surface = 'forecast'
       AND content_variant IN ('daily', 'weekly', 'monthly')
       AND content->'meta'->>'contractVersion' LIKE 'personal-forecast-feed-v%'
       AND NOT (content->>'period' = $2 AND content->>'periodKey' = $3)
     ORDER BY updated_at DESC, id DESC LIMIT $4`, [input.userId, input.period, input.periodKey, HISTORY_LIMIT * 4],
  );
  const seen = new Set<string>();
  return (result.rows as Array<{ user_id: unknown; content: unknown }>).flatMap((row) => {
    if (String(row.user_id) !== input.userId) return [];
    const item = historicalReading(row.content);
    if (!item || (item.period === input.period && item.periodKey === input.periodKey)) return [];
    const key = `${item.period}:${item.periodKey}:${item.fragments.map((part) => part.text).join('\n')}`;
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
    [input.userId, input.accessTier, resolved.contentVariant, input.periodKey, PERSONAL_FORECAST_PROMPT_VERSION, PERSONAL_FORECAST_CALCULATION_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION, CROSS_USER_PACKAGE_LIMIT],
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
    [input.userId, input.accessTier, resolved.contentVariant, input.periodKey, PERSONAL_FORECAST_PROMPT_VERSION, PERSONAL_FORECAST_CALCULATION_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION, CROSS_USER_PACKAGE_LIMIT],
  );
  return (result.rows as Array<{ content: unknown }>).flatMap((row) => {
    if (!isPersonalForecastPackage(row.content)) return [];
    return [row.content.meta.semanticSignature];
  });
}

async function save(input: PersonalForecastCacheContext, forecast: PersonalForecastPackage, resolved: Awaited<ReturnType<typeof identity>>) {
  await db.content_interpretations.upsertByUser(input.userId, {
    accessTier: input.accessTier, contentSurface: 'forecast', contentVariant: resolved.contentVariant,
    cacheKey: resolved.cacheKey, inputHash: resolved.inputHash, content: forecast, modelTier: 'premium',
    promptVersion: PERSONAL_FORECAST_PROMPT_VERSION, calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
    isPersistent: false, legacySource: null, validFrom: resolved.window.startsAt, validTo: resolved.window.validTo,
  });
}

export async function ensurePersonalForecast(input: PersonalForecastCacheContext, options: { forceRegenerate?: boolean; minimumGeneratedAt?: string | null } = {}): Promise<ContentGenerationLockResult<PersonalForecastPackage>> {
  if (!isPersonalForecastPeriodAllowedForTier(input.accessTier, input.period)) {
    logForecastDeliveryMetric({ domain: 'personal', outcome: 'skipped_entitlement', tier: input.accessTier, period: input.period, periodKey: input.periodKey });
    throw new Error('PERSONAL_FORECAST_PREMIUM_REQUIRED');
  }
  const resolved = await identity(input);
  let lockBusyLogged = false;
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({ userId: input.userId, accessTier: input.accessTier, contentSurface: 'forecast', contentVariant: resolved.contentVariant, cacheKey: resolved.cacheKey, promptVersion: PERSONAL_FORECAST_PROMPT_VERSION }),
    operation: `personal-forecast-${input.period}`, allowLocalLockFallback: true,
    onLockBusy: () => {
      if (lockBusyLogged) return;
      lockBusyLogged = true;
      logForecastDeliveryMetric({ domain: 'personal', outcome: 'generation_in_progress', tier: input.accessTier, period: input.period, periodKey: input.periodKey });
    },
    readCached: async () => {
      if (options.forceRegenerate) return null;
      const cached = await getCachedPersonalForecast(input);
      return cached ? { value: cached.forecast, source: 'cache' as const } : null;
    },
    generate: async () => {
      const [recentForecasts, crossUserRepeatFragments, crossUserSemanticSignatures] = await Promise.all([
        getRecentPersonalForecastHistory(input),
        getCrossUserRepeatFragments(input, resolved).catch(() => []),
        getCrossUserSemanticSignatures(input, resolved).catch(() => []),
      ]);
      const forecast = await generatePersonalForecastPackage({ profile: input.profile as UserProfile, model: resolved.model, period: input.period, window: resolved.window, recentForecasts, crossUserRepeatFragments, crossUserSemanticSignatures });
      if (!isPersonalForecastPackage(forecast)) throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${getPersonalForecastPackageValidationError(forecast) || 'UNKNOWN'}`);
      // A generated package is not ready until it is durably stored. Swallowing
      // this error reports a false success and leaves every later GET at 204.
      try {
        await save(input, forecast, resolved);
      } catch (cause) {
        const error = new Error('PERSONAL_FORECAST_CACHE_WRITE_FAILED') as Error & {
          code?: string;
          cause?: unknown;
        };
        error.code = 'PERSONAL_FORECAST_CACHE_WRITE_FAILED';
        error.cause = cause;
        throw error;
      }
      logForecastDeliveryMetric({ domain: 'personal', outcome: 'generated', tier: input.accessTier, period: input.period, periodKey: input.periodKey, generationCount: 1 });
      return forecast;
    },
  });
}
