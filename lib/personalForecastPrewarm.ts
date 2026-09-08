import { birthProfileRepository } from './birthProfileRepository';
import { toDateInputValue } from './date-utils';
import { db, getPool } from './db';
import { getPremiumEntitlementState } from './contentArchitecture';
import { logForecastDeliveryMetric } from './forecastDeliveryMetrics';
import {
  ensurePersonalForecast,
  getCachedPersonalForecast,
  type PersonalForecastCacheContext,
} from './personalForecastCache';
import {
  buildPersonalForecastBirthProfileFingerprint,
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
    dayTargets[0],
    { accessTier: 'premium', period: 'week', periodKey: getPersonalForecastPeriodKey('week', now, timezone) },
    { accessTier: 'premium', period: 'month', periodKey: getPersonalForecastPeriodKey('month', now, timezone) },
    ...dayTargets.slice(1),
  ]);
}

export async function prewarmPersonalForecastHorizon(input: {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  now?: Date;
  maxMissingGenerations?: number;
  maxTargets?: number;
}, runtime: PersonalForecastPrewarmRuntime = DEFAULT_RUNTIME): Promise<PersonalForecastPrewarmResult> {
  const targets = buildPersonalForecastPrewarmTargets({
    accessTier: input.accessTier,
    timezone: input.profile.birthTimezone,
    now: input.now,
  });
  const boundedLimit = (value: number | undefined) => value === undefined
    ? targets.length : Number.isFinite(value) ? Math.min(targets.length, Math.max(0, Math.floor(value))) : 0;
  const generationLimit = boundedLimit(input.maxMissingGenerations);
  const targetLimit = boundedLimit(input.maxTargets);
  const scopeKey = [
    input.userId,
    input.accessTier,
    buildPersonalForecastBirthProfileFingerprint(input.profile),
    targets[0]?.periodKey || 'none',
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
        if (await runtime.readCached(cacheInput)) {
          result.cached.push(target);
          logForecastDeliveryMetric({
            domain: 'personal', outcome: 'skipped_already_cached', tier: target.accessTier,
            period: target.period, periodKey: target.periodKey, reason: input.reason,
          });
          continue;
        }
        if (missingGenerations >= generationLimit) continue;
        missingGenerations += 1;
        const ensured = await runtime.ensure(cacheInput);
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
          errorCode: message.split(':', 1)[0],
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

export function queuePersonalForecastPrewarm(input: {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  maxMissingGenerations?: number;
}): void {
  void prewarmPersonalForecastHorizon(input).catch((error) => {
    console.warn('[personal-forecast-prewarm] background fill failed', {
      tier: input.accessTier,
      reason: input.reason,
      errorCode: (error instanceof Error ? error.message : String(error)).split(':', 1)[0],
    });
  });
}

export function queuePersonalForecastPrewarmForUser(input: {
  userId: string;
  accessTier: PersonalForecastGenerationTier;
  reason: PersonalForecastPrewarmReason;
  maxMissingGenerations?: number;
}): void {
  void (async () => {
    const [user, birthSettings] = await Promise.all([
      // db.users.get includes the lightweight primary-chart summary even on
      // its fast path, so timezone identity stays canonical without loading
      // the full chart payload.
      db.users.get(input.userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(input.userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(input.userId, user, birthSettings);
    if (!profile) return;
    await prewarmPersonalForecastHorizon({ ...input, profile });
  })().catch((error) => {
    console.warn('[personal-forecast-prewarm] user trigger failed', {
      tier: input.accessTier,
      reason: input.reason,
      errorCode: (error instanceof Error ? error.message : String(error)).split(':', 1)[0],
    });
  });
}

export function resetPersonalForecastPrewarmForTests(): void {
  personalPrewarmInFlight.clear();
  scheduledCursor = '';
  scheduledInFlight = null;
}

type ScheduledForecastUser = { userId: string; profile: PersonalForecastRawProfile; accessTier: PersonalForecastGenerationTier };
export type PersonalForecastIncrementRuntime = {
  listUsers: (afterId: string, limit: number, now: Date) => Promise<string[]>;
  loadUser: (userId: string) => Promise<ScheduledForecastUser | null>;
  prewarm: typeof prewarmPersonalForecastHorizon;
};

const SCHEDULED_RUNTIME: PersonalForecastIncrementRuntime = {
  async listUsers(afterId, limit, now) {
    const result = await getPool().query<{ id: string }>(
      `SELECT u.id::text AS id FROM users u
       WHERE u.id::text > $1 AND u.birth_date IS NOT NULL AND NULLIF(TRIM(u.name), '') IS NOT NULL
         AND (u.last_login >= $2::timestamptz - INTERVAL '7 days'
           OR EXISTS (SELECT 1 FROM user_sessions s WHERE s.user_id = u.id
             AND s.last_seen_at >= $2::timestamptz - INTERVAL '7 days'))
       ORDER BY u.id::text LIMIT $3`, [afterId, now.toISOString(), limit],
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
    return profile ? { userId, profile, accessTier: entitlement.isPremium ? 'premium' : 'free' } : null;
  },
  prewarm: prewarmPersonalForecastHorizon,
};

let scheduledCursor = '';
let scheduledInFlight: Promise<{ scanned: number; generated: number; inProgress: number; failed: number }> | null = null;

/** At most one provider generation per tick. Cursor scans active accounts fairly;
 * the existing per-user cache locks also deduplicate overlapping server replicas. */
export function prewarmPersonalForecastIncrement(
  input: { now?: Date; userLimit?: number } = {},
  runtime: PersonalForecastIncrementRuntime = SCHEDULED_RUNTIME,
) {
  if (scheduledInFlight) return scheduledInFlight;
  const now = input.now || new Date();
  const userLimit = Math.min(32, Math.max(1, Math.floor(input.userLimit || 16)));
  const request = (async () => {
    const result = { scanned: 0, generated: 0, inProgress: 0, failed: 0 };
    const ids = await runtime.listUsers(scheduledCursor, userLimit, now);
    if (!ids.length) { scheduledCursor = ''; return result; }
    for (const userId of ids) {
      scheduledCursor = userId;
      result.scanned += 1;
      try {
        const user = await runtime.loadUser(userId);
        if (!user) continue;
        const filled = await runtime.prewarm({ ...user, reason: 'scheduled_refresh', now, maxMissingGenerations: 1 });
        result.generated += filled.generated.length;
        result.inProgress += filled.inProgress.length;
        result.failed += filled.failed.length;
        if (filled.generated.length || filled.inProgress.length || filled.failed.length) break;
      } catch {
        result.failed += 1;
        break;
      }
    }
    return result;
  })().finally(() => { if (scheduledInFlight === request) scheduledInFlight = null; });
  scheduledInFlight = request;
  return request;
}
