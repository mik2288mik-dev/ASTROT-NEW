import { getPool } from './db';
import { resolveReadingContext } from './natalReading/apiHelper';
import {
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  type PersonalForecastPeriod,
} from './personalForecastContract';
import {
  ensurePersonalForecast,
  getCachedPersonalForecast,
} from './personalForecastCache';

const DEFAULT_ACTIVE_DAYS = 7;
const DEFAULT_LIMIT = 250;
const DEFAULT_CONCURRENCY = 2;

type ForecastTarget = {
  period: PersonalForecastPeriod;
  periodKey: string;
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    read('weekday') as 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  ] ?? 0;
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    weekday,
    hour: Number(read('hour')) % 24,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildPersonalForecastPrewarmTargets(
  now: Date,
  timezone: string,
): ForecastTarget[] {
  const safeTimezone = normalizeForecastTimezone(timezone);
  const parts = localParts(now, safeTimezone);
  const periods: PersonalForecastPeriod[] = ['day', 'week', 'month', 'year'];
  const current = Object.fromEntries(
    periods.map((period) => [
      period,
      getPersonalForecastPeriodKey(period, now, safeTimezone),
    ]),
  ) as Record<PersonalForecastPeriod, string>;
  const targets: ForecastTarget[] = periods.map((period) => ({
    period,
    periodKey: current[period],
  }));
  const addNext = (period: PersonalForecastPeriod) => {
    targets.push({
      period,
      periodKey: getNextPersonalForecastPeriodKey(
        period,
        current[period],
        safeTimezone,
      ),
    });
  };

  if (parts.hour >= 20) addNext('day');
  if (parts.weekday >= 5 || parts.weekday === 0) addNext('week');
  if (daysInMonth(parts.year, parts.month) - parts.day <= 3) addNext('month');
  if (parts.month === 12 && parts.day >= 20) addNext('year');
  return targets;
}

async function listActiveUsersWithCharts(
  limit: number,
  activeDays: number,
): Promise<string[]> {
  const result = await getPool().query(
    `SELECT u.id
     FROM users u
     JOIN LATERAL (
       SELECT c.id
       FROM natal_charts c
       WHERE c.user_id = u.id
       ORDER BY c.is_primary DESC NULLS LAST, c.id ASC
       LIMIT 1
     ) chart ON TRUE
     WHERE u.birth_date IS NOT NULL
       AND COALESCE(NULLIF(u.birth_place, ''), '') <> ''
       AND GREATEST(
         u.last_login,
         u.created_at,
         (SELECT MAX(e.occurred_at) FROM user_app_events e WHERE e.user_id = u.id)
       ) >= NOW() - ($2::int * INTERVAL '1 day')
     ORDER BY GREATEST(
       u.last_login,
       u.created_at,
       (SELECT MAX(e.occurred_at) FROM user_app_events e WHERE e.user_id = u.id)
     ) DESC NULLS LAST
     LIMIT $1`,
    [
      Math.max(1, Math.min(limit, 1000)),
      Math.max(1, Math.min(activeDays, 30)),
    ],
  );
  return result.rows.map((row: { id: string | number }) => String(row.id));
}

async function prewarmOne(userId: string, now: Date) {
  const ctx = await resolveReadingContext(userId, null);
  if (!ctx?.chartData || ctx.chartId == null) {
    return { userId, status: 'skipped' as const, reason: 'chart_missing' };
  }
  const timezone = normalizeForecastTimezone(
    ctx.chartData.timezone || ctx.profile.birthTimezone,
  );
  const targets = buildPersonalForecastPrewarmTargets(now, timezone);
  let generated = 0;
  let cached = 0;
  let inProgress = 0;

  for (const target of targets) {
    const input = { ctx, ...target };
    if (await getCachedPersonalForecast(input)) {
      cached += 1;
      continue;
    }
    const result = await ensurePersonalForecast(input);
    if (result.status === 'in_progress') inProgress += 1;
    else if (result.fromCache) cached += 1;
    else generated += 1;
  }
  return {
    userId,
    status: generated ? 'generated' as const : 'cached' as const,
    targets: targets.length,
    cached,
    generated,
    inProgress,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const runners = Array.from({
    length: Math.max(1, Math.min(concurrency, items.length || 1)),
  }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function prewarmPersonalForecastsForActiveUsers(
  now = new Date(),
  options: { limit?: number; activeDays?: number; concurrency?: number } = {},
) {
  const userIds = await listActiveUsersWithCharts(
    options.limit ?? DEFAULT_LIMIT,
    options.activeDays ?? DEFAULT_ACTIVE_DAYS,
  );
  const results = await runWithConcurrency(
    userIds,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (userId) => {
      try {
        return await prewarmOne(userId, now);
      } catch (error) {
        return {
          userId,
          status: 'failed' as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
  const counts = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: (counts.failed || 0) === 0,
    scanned: userIds.length,
    counts,
    failures: results.filter((item) => item.status === 'failed').slice(0, 20),
  };
}
