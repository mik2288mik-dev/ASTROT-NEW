import { getPool } from './db';
import { getMoscowTodayKey } from './date-utils';
import {
  getCachedReading,
  resolveReadingContext,
  saveReading,
  type CachedReadingOptions,
} from './natalReading/apiHelper';
import {
  buildHumanInputHash,
  generateDailyCanvas,
  getDailyVoiceVersion,
  validateDailyCanvas,
} from './natalHumanInterpretation';
import {
  HUMAN_DAILY_PROMPT_VERSION,
  humanDailyCanvasCacheKey,
  type DailyCanvas,
} from './natalHumanShared';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from './contentGenerationLock';

const CANVAS_CACHE_TIER = 'premium' as const;
const DEFAULT_ACTIVE_DAYS = 7;
const DEFAULT_LIMIT = 250;
const DEFAULT_CONCURRENCY = 2;

function moscowDayWindow(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return {
    validFrom: new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0)),
    validTo: new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0)),
  };
}

export function getNextMoscowDateKey(now = new Date()): string {
  return getMoscowTodayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

async function listActiveUsersWithCharts(limit: number, activeDays: number): Promise<string[]> {
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
    [Math.max(1, Math.min(limit, 1000)), Math.max(1, Math.min(activeDays, 30))]
  );
  return result.rows.map((row: { id: string | number }) => String(row.id));
}

async function prewarmOne(userId: string, dateKey: string) {
  const ctx = await resolveReadingContext(userId, null);
  if (!ctx?.chartData || ctx.chartId == null) {
    return { userId, status: 'skipped' as const, reason: 'chart_missing' };
  }

  const locale = ctx.profile.language === 'en' ? 'en' : 'ru';
  const voiceVersion = getDailyVoiceVersion(locale);
  const cacheKey = humanDailyCanvasCacheKey(userId, dateKey, locale, voiceVersion);
  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData,
    sectionKey: 'canvas',
    dateKey,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    locale,
  });
  const window = moscowDayWindow(dateKey);
  const cacheOpts: CachedReadingOptions = {
    accessTier: CANVAS_CACHE_TIER,
    contentVariant: 'living',
    cacheKey,
    inputHash,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    isPersistent: false,
    validFrom: window.validFrom,
    validTo: window.validTo,
  };

  const cached = await getCachedReading<DailyCanvas>(ctx, cacheOpts);
  if (cached && validateDailyCanvas(cached.content, locale).valid) {
    return { userId, status: 'cached' as const };
  }

  const lockResult = await withContentGenerationLock<DailyCanvas>({
    lockKey: buildContentGenerationLockKey({
      userId,
      chartId: ctx.chartId,
      accessTier: CANVAS_CACHE_TIER,
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
      promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    }),
    operation: 'human-daily-canvas-prewarm',
    readCached: async () => {
      const reading = await getCachedReading<DailyCanvas>(ctx, cacheOpts);
      if (!reading || !validateDailyCanvas(reading.content, locale).valid) return null;
      return { value: reading.content, source: 'server-cache' };
    },
    generate: async () => {
      const canvas = await generateDailyCanvas(ctx.profile, ctx.chartData!, dateKey);
      const validation = validateDailyCanvas(canvas, locale);
      if (!validation.valid) {
        const error = new Error('DAILY_PACKAGE_HARD_INVALID') as Error & { hardErrors?: string[] };
        error.hardErrors = validation.hardErrors;
        throw error;
      }
      await saveReading<DailyCanvas>(ctx, cacheOpts, canvas);
      return canvas;
    },
  });

  if (lockResult.status === 'in_progress') {
    return { userId, status: 'in_progress' as const };
  }
  return { userId, status: lockResult.fromCache ? 'cached' as const : 'generated' as const };
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function prewarmPersonalDailyForActiveUsers(
  dateKey: string,
  options: { limit?: number; activeDays?: number; concurrency?: number } = {}
) {
  const userIds = await listActiveUsersWithCharts(
    options.limit ?? DEFAULT_LIMIT,
    options.activeDays ?? DEFAULT_ACTIVE_DAYS
  );
  const results = await runWithConcurrency(
    userIds,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (userId) => {
      try {
        return await prewarmOne(userId, dateKey);
      } catch (error) {
        return {
          userId,
          status: 'failed' as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  const counts = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: (counts.failed || 0) === 0,
    dateKey,
    scanned: userIds.length,
    counts,
    failures: results.filter((item) => item.status === 'failed').slice(0, 20),
  };
}
