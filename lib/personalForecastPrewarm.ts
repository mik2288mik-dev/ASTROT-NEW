import { birthProfileRepository } from './birthProfileRepository';
import { toDateInputValue } from './date-utils';
import { db } from './db';
import { logForecastDeliveryMetric } from './forecastDeliveryMetrics';
import {
  ensurePersonalForecast,
  getCachedPersonalForecast,
  type PersonalForecastCacheContext,
} from './personalForecastCache';
import {
  buildPersonalForecastBirthProfileFingerprint,
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  isPersonalForecastPeriodAllowedForTier,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type PersonalForecastGenerationTier,
  type PersonalForecastPeriod,
  type PersonalForecastRawProfile,
} from './personalForecastContract';

export const PERSONAL_FORECAST_ROLLING_DAY_COUNT = 5;

export type PersonalForecastPrewarmReason =
  | 'birth_profile_completed'
  | 'app_open'
  | 'forecast_open'
  | 'premium_activated'
  | 'premium_restored';

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
const personalPrewarmInFlight = new Map<string, Promise<PersonalForecastPrewarmResult>>();

function uniqueTargets(targets: PersonalForecastPrewarmTarget[]): PersonalForecastPrewarmTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.accessTier}:${target.period}:${target.periodKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dayKeys(now: Date, timezone: string): string[] {
  const keys = [getPersonalForecastPeriodKey('day', now, timezone)];
  while (keys.length < PERSONAL_FORECAST_ROLLING_DAY_COUNT) {
    keys.push(getNextPersonalForecastPeriodKey('day', keys[keys.length - 1], timezone));
  }
  return keys;
}

function periodKeyForDay(
  period: Extract<PersonalForecastPeriod, 'week' | 'month'>,
  dayKey: string,
  timezone: string,
): string {
  const dayWindow = resolvePersonalForecastWindow('day', dayKey, timezone);
  return getPersonalForecastPeriodKey(
    period,
    new Date(dayWindow.startsAt.getTime() + 12 * 60 * 60 * 1000),
    timezone,
  );
}

export function buildPersonalForecastPrewarmTargets(input: {
  accessTier: PersonalForecastGenerationTier;
  timezone?: string | null;
  now?: Date;
}): PersonalForecastPrewarmTarget[] {
  const timezone = normalizeForecastTimezone(input.timezone);
  const days = dayKeys(input.now || new Date(), timezone);
  const dayTargets = days.map((periodKey) => ({
    accessTier: input.accessTier,
    period: 'day' as const,
    periodKey,
  }));
  if (input.accessTier === 'free') return dayTargets;

  const weeks = days.map((dayKey) => periodKeyForDay('week', dayKey, timezone));
  const months = days.map((dayKey) => periodKeyForDay('month', dayKey, timezone));
  return uniqueTargets([
    dayTargets[0],
    { accessTier: 'premium', period: 'week', periodKey: weeks[0] },
    { accessTier: 'premium', period: 'month', periodKey: months[0] },
    ...dayTargets.slice(1),
    ...weeks.slice(1).map((periodKey) => ({ accessTier: 'premium' as const, period: 'week' as const, periodKey })),
    ...months.slice(1).map((periodKey) => ({ accessTier: 'premium' as const, period: 'month' as const, periodKey })),
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
  const scopeKey = [
    input.userId,
    input.accessTier,
    buildPersonalForecastBirthProfileFingerprint(input.profile),
    targets[0]?.periodKey || 'none',
  ].join(':');
  const existing = personalPrewarmInFlight.get(scopeKey);
  if (existing) return existing;

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
    const generationLimit = Math.max(0, input.maxMissingGenerations ?? targets.length);
    const targetLimit = Math.max(0, input.maxTargets ?? targets.length);

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
    if (personalPrewarmInFlight.get(scopeKey) === request) personalPrewarmInFlight.delete(scopeKey);
  });
  personalPrewarmInFlight.set(scopeKey, request);
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
}
