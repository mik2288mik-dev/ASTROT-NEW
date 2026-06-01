import type { NatalChartData, UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmTaskId,
} from '../lib/contentPrewarm';
import { getMoscowTodayKey } from '../lib/date-utils';
import {
  getCachedDailyForecastLayer,
  getCachedFullDaypartForecast,
  ensureMonthlyForecastLayer,
  ensureWeeklyForecastLayer,
  getCachedMonthlyForecastLayer,
  getCachedNatalAnchorLayer,
  getCachedPremiumNatalFullLayer,
  getCachedWeeklyForecastLayer,
  getDailyForecastLayer,
  getFullDaypartForecast,
  getNatalAnchorLayer,
  getPremiumNatalFullLayer,
} from './astrologyService';
import {
  ensureHumanDailySection,
  getCachedHumanDailySection,
} from './natalReadingService';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';
import {
  getRetryAfterMs,
  isGenerationInProgressError,
  waitMs,
} from '../lib/contentInterpretation';

export type PrewarmMode = 'cache-only' | 'generate-missing';

const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[ContentPrewarm] ${message}`, data || '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[ContentPrewarm] ${message}`, data || '');
  },
};

export type PrewarmUserContentInput = {
  userId: string;
  chartId?: number | null;
  profile: UserProfile;
  chartData: NatalChartData;
  isPremium: boolean;
  dateKey?: string;
  mode?: PrewarmMode;
  /** Only run these tasks (generate-missing). */
  onlyTaskIds?: PrewarmTaskId[];
  /** Max time to block caller; cache-only startup should stay under ~3s. */
  blockingBudgetMs?: number;
  onProgress?: (ratio: number) => void;
};

export type PrewarmTaskStatus = 'cached' | 'missing' | 'generated' | 'failed';

export type PrewarmTaskResult = {
  id: PrewarmTaskId;
  status: PrewarmTaskStatus;
  error?: string;
};

export type PrewarmUserContentResult = {
  planSize: number;
  completed: PrewarmTaskResult[];
  failed: PrewarmTaskResult[];
  missingTaskIds: PrewarmTaskId[];
  cachedTaskIds: PrewarmTaskId[];
};

const CACHE_ONLY_DEFAULT_BUDGET_MS = 2_500;
const GENERATE_MISSING_DEFAULT_BUDGET_MS = 120_000;

let prewarmInFlight: Promise<PrewarmUserContentResult> | null = null;
let prewarmInFlightKey: string | null = null;

async function runWithGenerationRetry<T>(
  label: string,
  attempts: number,
  run: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isGenerationInProgressError(error) || attempt >= attempts) {
        throw error;
      }
      await waitMs(getRetryAfterMs(error));
      log.info(`${label}: waiting for in-flight generation`, { attempt });
    }
  }
  throw lastError;
}

async function probeHumanDailyCached(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId: number | null | undefined,
  dateKey: string
): Promise<boolean> {
  const cached = await getCachedHumanDailySection(userId, sectionKey, chartId ?? undefined, dateKey);
  return !!cached?.content;
}

async function probePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput
): Promise<boolean> {
  const { userId, chartId, dateKey = getMoscowTodayKey() } = input;
  const language = input.profile.language === 'en' ? 'en' : 'ru';

  switch (item.id) {
    case 'forecast_daily':
      return !!(await getCachedDailyForecastLayer(userId, chartId));
    case 'natal_anchor':
      return !!(await getCachedNatalAnchorLayer(userId, language, chartId));
    case 'forecast_daypart_morning':
    case 'forecast_daypart_day':
    case 'forecast_daypart_evening':
      return !!(await getCachedFullDaypartForecast(userId, item.daypartSlot!, {
        chartId,
        accessTier: 'premium',
        dateKey,
      }));
    case 'forecast_weekly':
      return !!(await getCachedWeeklyForecastLayer(userId, chartId, item.cacheKey));
    case 'forecast_monthly':
      return !!(await getCachedMonthlyForecastLayer(userId, chartId, item.cacheKey));
    case 'natal_full':
      return !!(await getCachedPremiumNatalFullLayer(userId, language, chartId));
    default:
      if (!item.sectionKey) return false;
      return probeHumanDailyCached(userId, item.sectionKey, chartId, dateKey);
  }
}

async function generatePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput
): Promise<void> {
  const { profile, chartData, userId, chartId, dateKey = getMoscowTodayKey() } = input;

  switch (item.id) {
    case 'forecast_daily':
      await runWithGenerationRetry('forecast:daily', 3, () =>
        getDailyForecastLayer(profile, chartData, chartId)
      );
      return;
    case 'natal_anchor':
      await runWithGenerationRetry('natal:anchor', 3, () =>
        getNatalAnchorLayer(profile, chartData, chartId)
      );
      return;
    case 'forecast_daypart_morning':
    case 'forecast_daypart_day':
    case 'forecast_daypart_evening':
      await runWithGenerationRetry(`forecast:${item.daypartSlot}`, 3, async () => {
        await getFullDaypartForecast(profile, chartData, item.daypartSlot!, {
          accessTier: 'premium',
          date: dateKey,
          chartId,
        });
      });
      return;
    case 'forecast_weekly':
      await runWithGenerationRetry('forecast:weekly', 2, () =>
        ensureWeeklyForecastLayer(profile, chartData, item.cacheKey, chartId)
      );
      return;
    case 'forecast_monthly':
      await runWithGenerationRetry('forecast:monthly', 2, () =>
        ensureMonthlyForecastLayer(profile, chartData, item.cacheKey, chartId)
      );
      return;
    case 'natal_full':
      await runWithGenerationRetry('natal:full', 2, () =>
        getPremiumNatalFullLayer(profile, chartData, chartId)
      );
      return;
    default:
      if (!item.sectionKey) return;
      await runWithGenerationRetry(`human-daily:${item.sectionKey}`, 3, () =>
        ensureHumanDailySection(userId, item.sectionKey!, chartId ?? undefined, dateKey, {
          accessTier: item.sectionKey === 'daily_overview' ? undefined : 'premium',
        })
      );
  }
}

async function runPlan(
  plan: PrewarmPlanItem[],
  input: PrewarmUserContentInput,
  deadlineMs: number
): Promise<PrewarmUserContentResult> {
  const completed: PrewarmTaskResult[] = [];
  const failed: PrewarmTaskResult[] = [];
  const missingTaskIds: PrewarmTaskId[] = [];
  const cachedTaskIds: PrewarmTaskId[] = [];
  const mode = input.mode ?? 'cache-only';

  for (const item of plan) {
    if (Date.now() >= deadlineMs) {
      if (mode === 'cache-only') {
        missingTaskIds.push(item.id);
      }
      continue;
    }

    try {
      const hasCache = await probePrewarmItem(item, input);
      if (hasCache) {
        cachedTaskIds.push(item.id);
        completed.push({ id: item.id, status: 'cached' });
        continue;
      }

      if (mode === 'cache-only') {
        missingTaskIds.push(item.id);
        completed.push({ id: item.id, status: 'missing' });
        continue;
      }

      await generatePrewarmItem(item, input);
      completed.push({ id: item.id, status: 'generated' });
    } catch (error: any) {
      const message = error?.message || String(error);
      log.warn(`Task failed: ${item.id}`, { message, code: error?.code, mode });
      failed.push({ id: item.id, status: 'failed', error: message });
      if (mode === 'cache-only') {
        missingTaskIds.push(item.id);
      }
    }

    input.onProgress?.((completed.length + failed.length) / Math.max(plan.length, 1));
  }

  return {
    planSize: plan.length,
    completed,
    failed,
    missingTaskIds,
    cachedTaskIds,
  };
}

export async function prewarmUserContent(
  input: PrewarmUserContentInput
): Promise<PrewarmUserContentResult> {
  const dateKey = input.dateKey || getMoscowTodayKey();
  const mode = input.mode ?? 'cache-only';
  const key = `${input.userId}:${input.chartId ?? 'primary'}:${dateKey}:${input.isPremium ? 'premium' : 'free'}:${mode}`;

  if (prewarmInFlight && prewarmInFlightKey === key) {
    return prewarmInFlight;
  }

  let plan = buildUserPrewarmPlan(input.isPremium, dateKey);
  if (input.onlyTaskIds?.length) {
    const allowed = new Set(input.onlyTaskIds);
    plan = plan.filter((item) => allowed.has(item.id));
  }

  const blockingBudgetMs =
    input.blockingBudgetMs ??
    (mode === 'cache-only' ? CACHE_ONLY_DEFAULT_BUDGET_MS : GENERATE_MISSING_DEFAULT_BUDGET_MS);
  const deadline = Date.now() + blockingBudgetMs;

  const run = async (): Promise<PrewarmUserContentResult> => {
    log.info('Starting prewarm', {
      userId: input.userId,
      chartId: input.chartId ?? null,
      isPremium: input.isPremium,
      planSize: plan.length,
      dateKey,
      mode,
    });

    return runPlan(plan, input, deadline);
  };

  prewarmInFlightKey = key;
  prewarmInFlight = run().finally(() => {
    if (prewarmInFlightKey === key) {
      prewarmInFlight = null;
      prewarmInFlightKey = null;
    }
  });

  return prewarmInFlight;
}

export function resetPrewarmSessionForTests() {
  prewarmInFlight = null;
  prewarmInFlightKey = null;
}
