import { birthProfileRepository } from './birthProfileRepository';
import { toDateInputValue } from './date-utils';
import { db, getPool } from './db';
import { getPremiumEntitlementState } from './contentArchitecture';
import { logForecastDeliveryMetric } from './forecastDeliveryMetrics';
import {
  buildCanonicalNatalInputHash,
  buildLegacyCanonicalNatalInputHash,
  isCanonicalNatalChartDataComplete,
} from './natalChartCanonical';
import { natalChartV2Repository } from './natalChartV2Repository';
import {
  ensurePersonalForecast,
  getCachedPersonalForecast,
  type PersonalForecastCacheContext,
} from './personalForecastCache';
import {
  buildPersonalForecastBirthProfileFingerprint,
  PERSONAL_FORECAST_ROLLING_DAY_COUNT,
  getPersonalForecastDayHorizon,
  getPersonalForecastPeriodKey,
  isPersonalForecastPeriodAllowedForTier,
  normalizeForecastTimezone,
  type PersonalForecastGenerationTier,
  type PersonalForecastPeriod,
  type PersonalForecastRawProfile,
} from './personalForecastContract';

export { PERSONAL_FORECAST_ROLLING_DAY_COUNT } from './personalForecastContract';

export type PersonalForecastPrewarmReason =
  | 'birth_profile_completed'
  | 'app_open'
  | 'forecast_open'
  | 'premium_activated'
  | 'premium_restored'
  | 'scheduled_refresh';

export type PersonalForecastPrewarmTarget = {
  accessTier: PersonalForecastGenerationTier;
  period: PersonalForecastPeriod;
  periodKey: string;
};

export type PersonalForecastPrewarmRuntime = {
  readCached: typeof getCachedPersonalForecast;
  ensure: typeof ensurePersonalForecast;
};

export type PersonalForecastPrewarmResult = {
  targets: PersonalForecastPrewarmTarget[];
  cached: PersonalForecastPrewarmTarget[];
  generated: PersonalForecastPrewarmTarget[];
  inProgress: PersonalForecastPrewarmTarget[];
  failed: Array<{ target: PersonalForecastPrewarmTarget; error: string }>;
  skippedEntitlement: PersonalForecastPrewarmTarget[];
};

const DEFAULT_RUNTIME: PersonalForecastPrewarmRuntime = {
  readCached: getCachedPersonalForecast,
  ensure: ensurePersonalForecast,
};
const personalPrewarmInFlight = new Map<string, {
  request: Promise<PersonalForecastPrewarmResult>;
  generationLimit: number;
  targetLimit: number;
}>();

// A generation keeps a database connection for its distributed lock while
// calling the model. Leave most of the five-connection pool for app requests.
const MAX_BACKGROUND_GENERATIONS = 2;
const PARTIAL_FORECAST_RETRY_DELAY_MS = 15 * 60 * 1000;
let backgroundGenerations = 0;
const userTriggeredGenerationWaiters: Array<() => void> = [];
const scheduledGenerationWaiters: Array<() => void> = [];

async function withBackgroundGenerationSlot<T>(
  reason: PersonalForecastPrewarmReason,
  generate: () => Promise<T>,
): Promise<T> {
  if (backgroundGenerations < MAX_BACKGROUND_GENERATIONS) {
    backgroundGenerations += 1;
  } else {
    await new Promise<void>((resolve) => {
      const waiters = reason === 'scheduled_refresh'
        ? scheduledGenerationWaiters : userTriggeredGenerationWaiters;
      waiters.push(resolve);
    });
  }
  try {
    return await generate();
  } finally {
    const next = userTriggeredGenerationWaiters.shift() || scheduledGenerationWaiters.shift();
    if (next) next();
    else backgroundGenerations -= 1;
  }
}

function uniqueTargets(targets: PersonalForecastPrewarmTarget[]): PersonalForecastPrewarmTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.accessTier}:${target.period}:${target.periodKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPersonalForecastPrewarmTargets(input: {
  accessTier: PersonalForecastGenerationTier;
  timezone?: string | null;
  now?: Date;
}): PersonalForecastPrewarmTarget[] {
  const timezone = normalizeForecastTimezone(input.timezone);
  const now = input.now || new Date();
  const days = getPersonalForecastDayHorizon(timezone, now);
  const dayTargets = days.map((periodKey) => ({
    accessTier: input.accessTier,
    period: 'day' as const,
    periodKey,
  }));
  if (input.accessTier === 'free') return dayTargets;

  return uniqueTargets([
    ...dayTargets,
    { accessTier: 'premium', period: 'week', periodKey: getPersonalForecastPeriodKey('week', now, timezone) },
    { accessTier: 'premium', period: 'month', periodKey: getPersonalForecastPeriodKey('month', now, timezone) },
  ]);
}

/** Only stable validator codes go into metrics; provider messages may contain private data. */
function prewarmErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/^PERSONAL_FORECAST_(?:GENERATION_INVALID|PACKAGE_INVALID):[A-Z0-9_:,-]{1,160}$/u.test(message)) {
    return message;
  }
  return /^[A-Z0-9_]{1,100}$/u.test(message.split(':', 1)[0])
    ? message.split(':', 1)[0]
    : 'PERSONAL_FORECAST_PREWARM_FAILED';
}

export async function prewarmPersonalForecastHorizon(input: {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  now?: Date;
  maxMissingGenerations?: number;
  maxTargets?: number;
  targetIndex?: number;
  notBeforeDayKey?: string;
  notAfterDayKey?: string;
}, runtime: PersonalForecastPrewarmRuntime = DEFAULT_RUNTIME): Promise<PersonalForecastPrewarmResult> {
  const allTargets = buildPersonalForecastPrewarmTargets({
    accessTier: input.accessTier,
    timezone: input.profile.birthTimezone,
    now: input.now,
  });
  const selectedTargets = input.targetIndex === undefined ? allTargets
    : allTargets.slice(input.targetIndex, input.targetIndex + 1);
  const targets = selectedTargets.filter((target) => target.period !== 'day' || (
    (!input.notBeforeDayKey || target.periodKey >= input.notBeforeDayKey)
    && (!input.notAfterDayKey || target.periodKey <= input.notAfterDayKey)
  ));
  const boundedLimit = (value: number | undefined) => value === undefined
    ? targets.length : Number.isFinite(value) ? Math.min(targets.length, Math.max(0, Math.floor(value))) : 0;
  const generationLimit = boundedLimit(input.maxMissingGenerations);
  const targetLimit = boundedLimit(input.maxTargets);
  const scopeKey = [
    input.userId,
    buildPersonalForecastBirthProfileFingerprint(input.profile),
    targets.map((target) => `${target.accessTier}:${target.period}:${target.periodKey}`).join('|') || 'none',
  ].join(':');
  const existing = personalPrewarmInFlight.get(scopeKey);
  if (existing) {
    if (existing.generationLimit >= generationLimit && existing.targetLimit >= targetLimit) return existing.request;
    // A one-item scheduler increment must not silently truncate a foreground fill.
    await existing.request;
    return prewarmPersonalForecastHorizon(input, runtime);
  }

  const request = (async () => {
    const result: PersonalForecastPrewarmResult = {
      targets,
      cached: [],
      generated: [],
      inProgress: [],
      failed: [],
      skippedEntitlement: [],
    };
    let missingGenerations = 0;

    for (const target of targets.slice(0, targetLimit)) {
      if (!isPersonalForecastPeriodAllowedForTier(target.accessTier, target.period)) {
        result.skippedEntitlement.push(target);
        logForecastDeliveryMetric({
          domain: 'personal', outcome: 'skipped_entitlement', tier: target.accessTier,
          period: target.period, periodKey: target.periodKey, reason: input.reason,
        });
        continue;
      }
      const cacheInput: PersonalForecastCacheContext = {
        userId: input.userId,
        profile: input.profile,
        accessTier: target.accessTier,
        period: target.period,
        periodKey: target.periodKey,
      };
      try {
        const cached = await runtime.readCached(cacheInput);
        const partialGeneratedAt = cached?.forecast?.meta?.diagnosticCode === 'PERSONAL_FORECAST_PARTIAL_RECOVERY'
          ? Date.parse(cached.forecast.meta.generatedAt)
          : Number.NaN;
        const retryPartial = Number.isFinite(partialGeneratedAt)
          && Date.now() - partialGeneratedAt >= PARTIAL_FORECAST_RETRY_DELAY_MS;
        if (cached && !retryPartial) {
          result.cached.push(target);
          logForecastDeliveryMetric({
            domain: 'personal', outcome: 'skipped_already_cached', tier: target.accessTier,
            period: target.period, periodKey: target.periodKey, reason: input.reason,
          });
          continue;
        }
        if (missingGenerations >= generationLimit) continue;
        missingGenerations += 1;
        const ensured = await withBackgroundGenerationSlot(input.reason, () => retryPartial
          ? runtime.ensure(cacheInput, { forceRegenerate: true })
          : runtime.ensure(cacheInput));
        if (ensured.status === 'in_progress') {
          result.inProgress.push(target);
          logForecastDeliveryMetric({
            domain: 'personal', outcome: 'generation_in_progress', tier: target.accessTier,
            period: target.period, periodKey: target.periodKey, reason: input.reason,
          });
        } else if (ensured.fromCache) {
          result.cached.push(target);
          logForecastDeliveryMetric({
            domain: 'personal', outcome: 'skipped_already_cached', tier: target.accessTier,
            period: target.period, periodKey: target.periodKey, reason: input.reason,
          });
        } else {
          result.generated.push(target);
          logForecastDeliveryMetric({
            domain: 'personal', outcome: 'prewarmed', tier: target.accessTier,
            period: target.period, periodKey: target.periodKey, reason: input.reason,
            generationCount: 1,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed.push({ target, error: message });
        logForecastDeliveryMetric({
          domain: 'personal', outcome: 'failed', tier: target.accessTier,
          period: target.period, periodKey: target.periodKey, reason: input.reason,
          errorCode: prewarmErrorCode(error),
        });
      }
    }
    return result;
  })().finally(() => {
    if (personalPrewarmInFlight.get(scopeKey)?.request === request) personalPrewarmInFlight.delete(scopeKey);
  });
  personalPrewarmInFlight.set(scopeKey, { request, generationLimit, targetLimit });
  return request;
}

export function buildPersonalForecastPrewarmProfile(
  userId: string,
  user: any,
  birthSettings: any,
): (PersonalForecastRawProfile & { language: 'ru' | 'en' }) | null {
  const name = String(user?.name || '').trim();
  const birthDate = toDateInputValue(user?.birth_date) || String(user?.birth_date || '').trim();
  if (!name || !birthDate) return null;
  return {
    id: userId,
    name,
    birthDate,
    birthTime: user.birth_time || '',
    birthTimeMode: birthSettings?.birth_time_mode || user.birth_time_mode || undefined,
    birthTimeUncertaintyMinutes: birthSettings?.birth_time_uncertainty_minutes
      ?? user.birth_time_uncertainty_minutes
      ?? null,
    birthPlace: user.birth_place || '',
    birthTimezone: user.birth_timezone || null,
    gender: user.gender === 'male' || user.gender === 'female' ? user.gender : 'unspecified',
    language: user.language === 'en' ? 'en' : 'ru',
  };
}

/** Match the saved self-chart to the current birth profile before scheduling AI work. */
async function hasCurrentSavedChart(userId: string, profile: PersonalForecastRawProfile): Promise<boolean> {
  const chart = await natalChartV2Repository.getPrimary(userId);
  if (!chart || String(chart.user_id) !== userId || !isCanonicalNatalChartDataComplete(chart.chart_data)) return false;
  const birth = chart.chart_data.birth;
  const input = {
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    birthPlace: profile.birthPlace,
    birthTimeMode: profile.birthTimeMode,
    birthTimeUncertaintyMinutes: profile.birthTimeUncertaintyMinutes,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezone: birth.timezone,
  };
  if (chart.input_hash === buildCanonicalNatalInputHash(input)) return true;
  // The generator itself can upgrade this older hash when the saved birth
  // details still match; do not force a recalculation just for prewarming.
  return chart.input_hash === buildLegacyCanonicalNatalInputHash(input)
    && birth.localDate === profile.birthDate
    && (birth.time?.localTime || undefined) === (profile.birthTime || undefined);
}

/** A Premium package cannot be read after expiry because the cache is tier-scoped. */
function freeFallbackStartDay(
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>,
  profile: PersonalForecastRawProfile,
  now = new Date(),
): string | null {
  if (!entitlement.isPremium || !entitlement.endsAt) return null;
  const expiry = new Date(entitlement.endsAt);
  if (!Number.isFinite(expiry.getTime())) return null;
  const days = getPersonalForecastDayHorizon(profile.birthTimezone, now);
  const expiryDay = getPersonalForecastPeriodKey('day', expiry, normalizeForecastTimezone(profile.birthTimezone));
  if (expiryDay > days[days.length - 1]) return null;
  return expiryDay < days[0] ? days[0] : expiryDay;
}

const APP_OPEN_PREWARM_COOLDOWN_MS = 5 * 60 * 1000;
const appOpenPrewarmUntil = new Map<string, number>();

function reserveFrequentPrewarm(key: string): boolean {
  const now = Date.now();
  for (const [entry, until] of appOpenPrewarmUntil) {
    if (until <= now) appOpenPrewarmUntil.delete(entry);
  }
  if ((appOpenPrewarmUntil.get(key) || 0) > now) return false;
  appOpenPrewarmUntil.set(key, now + APP_OPEN_PREWARM_COOLDOWN_MS);
  return true;
}

async function prewarmTriggeredHorizon(input: {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  maxMissingGenerations?: number;
}, freeFrom: string | null): Promise<boolean> {
  let failed = false;
  if (input.accessTier === 'premium' && freeFrom) {
    const days = getPersonalForecastDayHorizon(input.profile.birthTimezone);
    const expiryIndex = days.indexOf(freeFrom);
    if (expiryIndex === 0 || expiryIndex === 1) {
      // Make the currently visible Premium Today ready first. Then secure the
      // Free reading needed on the expiry date before filling distant days.
      const today = await prewarmPersonalForecastHorizon({ ...input, targetIndex: 0, maxMissingGenerations: 1 });
      const expiryDay = await prewarmPersonalForecastHorizon({
        ...input, accessTier: 'free', targetIndex: expiryIndex, maxMissingGenerations: 1,
      });
      failed = Boolean(today.failed.length || expiryDay.failed.length);
    }
  }
  const primary = await prewarmPersonalForecastHorizon({
    ...input,
    notAfterDayKey: input.accessTier === 'premium' ? freeFrom || undefined : undefined,
  });
  const fallback = freeFrom ? await prewarmPersonalForecastHorizon({
    ...input, accessTier: 'free', notBeforeDayKey: freeFrom,
  }) : null;
  return failed || Boolean(primary.failed.length || fallback?.failed.length);
}

export function queuePersonalForecastPrewarm(input: {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  maxMissingGenerations?: number;
}): void {
  const frequentKey = input.reason === 'forecast_open' ? [
    input.reason, input.userId, input.accessTier,
    buildPersonalForecastBirthProfileFingerprint(input.profile),
  ].join(':') : null;
  if (frequentKey && !reserveFrequentPrewarm(frequentKey)) return;
  void (async () => {
    if (!(await hasCurrentSavedChart(input.userId, input.profile))) return;
    const freeFrom = input.accessTier === 'premium'
      ? freeFallbackStartDay(await getPremiumEntitlementState(input.userId), input.profile)
      : null;
    const failed = await prewarmTriggeredHorizon(input, freeFrom);
    if (failed && frequentKey) appOpenPrewarmUntil.delete(frequentKey);
  })().catch((error) => {
    if (frequentKey) appOpenPrewarmUntil.delete(frequentKey);
    console.warn('[personal-forecast-prewarm] background fill failed', {
      tier: input.accessTier,
      reason: input.reason,
      errorCode: prewarmErrorCode(error),
    });
  });
}

export function queuePersonalForecastPrewarmForUser(input: {
  userId: string;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  maxMissingGenerations?: number;
}): void {
  const frequentKey = input.reason === 'app_open'
    ? `${input.reason}:${input.userId}:${input.accessTier}` : null;
  if (frequentKey && !reserveFrequentPrewarm(frequentKey)) return;
  void (async () => {
    const [user, birthSettings, entitlement] = await Promise.all([
      // db.users.get includes the lightweight primary-chart summary even on
      // its fast path, so timezone identity stays canonical without loading
      // the full chart payload.
      db.users.get(input.userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(input.userId),
      getPremiumEntitlementState(input.userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(input.userId, user, birthSettings);
    if (!profile || !(await hasCurrentSavedChart(input.userId, profile))) return;
    const accessTier = entitlement.isPremium ? 'premium' : 'free';
    const freeFrom = accessTier === 'premium' ? freeFallbackStartDay(entitlement, profile) : null;
    const failed = await prewarmTriggeredHorizon({ ...input, profile, accessTier }, freeFrom);
    if (failed && frequentKey) appOpenPrewarmUntil.delete(frequentKey);
  })().catch((error) => {
    if (frequentKey) appOpenPrewarmUntil.delete(frequentKey);
    console.warn('[personal-forecast-prewarm] user trigger failed', {
      tier: input.accessTier,
      reason: input.reason,
      errorCode: prewarmErrorCode(error),
    });
  });
}

export function resetPersonalForecastPrewarmForTests(): void {
  if (backgroundGenerations || userTriggeredGenerationWaiters.length || scheduledGenerationWaiters.length) {
    throw new Error('PERSONAL_FORECAST_PREWARM_RESET_WHILE_ACTIVE');
  }
  personalPrewarmInFlight.clear();
  backgroundGenerations = 0;
  userTriggeredGenerationWaiters.length = 0;
  scheduledGenerationWaiters.length = 0;
  appOpenPrewarmUntil.clear();
  scheduledCursor = '';
  scheduledTargetIndex = 0;
  scheduledDayKey = '';
  scheduledInFlight = null;
}

type ScheduledForecastUser = {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  freeFallbackFromDayKey?: string | null;
};
export type PersonalForecastIncrementRuntime = {
  listUsers: (afterId: string, limit: number, now: Date) => Promise<string[]>;
  loadUser: (userId: string) => Promise<ScheduledForecastUser | null>;
  prewarm: typeof prewarmPersonalForecastHorizon;
};

const SCHEDULED_RUNTIME: PersonalForecastIncrementRuntime = {
  async listUsers(afterId, limit) {
    const result = await getPool().query<{ id: string }>(
      `SELECT u.id::text AS id FROM users u
       WHERE u.id::text > $1 AND u.birth_date IS NOT NULL AND NULLIF(TRIM(u.name), '') IS NOT NULL
         AND (u.last_login IS NOT NULL
           OR EXISTS (SELECT 1 FROM user_sessions s WHERE s.user_id = u.id))
         AND EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = u.id
           AND c.subject_type = 'self' AND c.archived_at IS NULL)
       ORDER BY u.id::text LIMIT $2`, [afterId, limit],
    );
    return result.rows.map((row) => row.id);
  },
  async loadUser(userId) {
    const [user, settings, entitlement] = await Promise.all([
      db.users.get(userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(userId),
      getPremiumEntitlementState(userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(userId, user, settings);
    return profile && await hasCurrentSavedChart(userId, profile)
      ? {
        userId,
        profile,
        accessTier: entitlement.isPremium ? 'premium' : 'free',
        freeFallbackFromDayKey: freeFallbackStartDay(entitlement, profile),
      }
      : null;
  },
  prewarm: prewarmPersonalForecastHorizon,
};

let scheduledCursor = '';
let scheduledTargetIndex = 0;
let scheduledDayKey = '';
let scheduledInFlight: Promise<{ scanned: number; generated: number; inProgress: number; failed: number }> | null = null;

const SCHEDULED_BATCH_SIZE = 8;
const SCHEDULED_CONCURRENCY = 1;
// Five rolling days, then the two current Premium periods. Free users simply
// have no work in the final two passes.
const SCHEDULED_TARGET_PASSES = PERSONAL_FORECAST_ROLLING_DAY_COUNT + 2;

/** Reconcile logged-in accounts in date order. Missing items are retried on
 * later passes; the cache and generation locks deduplicate overlapping runs. */
export function prewarmPersonalForecastIncrement(
  input: { now?: Date; userLimit?: number } = {},
  runtime: PersonalForecastIncrementRuntime = SCHEDULED_RUNTIME,
) {
  if (scheduledInFlight) return scheduledInFlight;
  const now = input.now || new Date();
  const dayKey = getPersonalForecastPeriodKey('day', now, 'Europe/Moscow');
  if (scheduledDayKey !== dayKey) {
    scheduledDayKey = dayKey;
    scheduledCursor = '';
    scheduledTargetIndex = 0;
  }
  const userLimit = Math.min(32, Math.max(1, Math.floor(input.userLimit || SCHEDULED_BATCH_SIZE)));
  const request = (async () => {
    const result = { scanned: 0, generated: 0, inProgress: 0, failed: 0 };
    const ids = await runtime.listUsers(scheduledCursor, userLimit, now);
    if (!ids.length) {
      scheduledCursor = '';
      scheduledTargetIndex = (scheduledTargetIndex + 1) % SCHEDULED_TARGET_PASSES;
      return result;
    }
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const userId = ids[next++];
        result.scanned += 1;
        try {
          const user = await runtime.loadUser(userId);
          if (!user) continue;
          const targetDay = scheduledTargetIndex < PERSONAL_FORECAST_ROLLING_DAY_COUNT
            ? getPersonalForecastDayHorizon(user.profile.birthTimezone, now)[scheduledTargetIndex]
            : null;
          // Premium readings after expiry cannot be shown. The expiry date
          // itself still needs Premium until the exact expiry timestamp.
          if (!user.freeFallbackFromDayKey || !targetDay || targetDay <= user.freeFallbackFromDayKey) {
            const filled = await runtime.prewarm({
              ...user,
              reason: 'scheduled_refresh',
              now,
              maxMissingGenerations: 1,
              targetIndex: scheduledTargetIndex,
            });
            result.generated += filled.generated.length;
            result.inProgress += filled.inProgress.length;
            result.failed += filled.failed.length;
          }
          if (user.freeFallbackFromDayKey && targetDay && targetDay >= user.freeFallbackFromDayKey) {
            const fallback = await runtime.prewarm({
              ...user,
              accessTier: 'free',
              reason: 'scheduled_refresh',
              now,
              targetIndex: scheduledTargetIndex,
              maxMissingGenerations: 1,
            });
            result.generated += fallback.generated.length;
            result.inProgress += fallback.inProgress.length;
            result.failed += fallback.failed.length;
          }
        } catch {
          result.failed += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SCHEDULED_CONCURRENCY, ids.length) }, worker));
    if (ids.length < userLimit) {
      scheduledCursor = '';
      scheduledTargetIndex = (scheduledTargetIndex + 1) % SCHEDULED_TARGET_PASSES;
    } else {
      scheduledCursor = ids[ids.length - 1];
    }
    return result;
  })().finally(() => { if (scheduledInFlight === request) scheduledInFlight = null; });
  scheduledInFlight = request;
  return request;
}
