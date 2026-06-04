import type { NatalChartData, UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmTaskId,
} from '../lib/contentPrewarm';
import { getMoscowTodayKey } from '../lib/date-utils';
import {
  ensureDailySignHoroscope,
  getCachedDailySignHoroscope,
  getCachedFullDaypartForecast,
  getFullDaypartForecast,
} from './astrologyService';
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

const CACHE_ONLY_DEFAULT_BUDGET_MS = 1_500;
const GENERATE_MISSING_DEFAULT_BUDGET_MS = 120_000;
const GENERATE_MISSING_CONCURRENCY = 4;

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

async function probePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput
): Promise<boolean> {
  const { userId, chartId, dateKey = getMoscowTodayKey() } = input;
  const language = input.profile.language === 'en' ? 'en' : 'ru';

  switch (item.id) {
    case 'sign_daily': {
      const sign = String(input.chartData?.sun?.sign || '').trim();
      if (!sign) return false;
      return !!(await getCachedDailySignHoroscope(sign, dateKey, language));
    }
    case 'forecast_daypart_day':
      return !!(await getCachedFullDaypartForecast(userId, 'day', {
        chartId,
        accessTier: 'premium',
        dateKey,
      }));
    default:
      return false;
  }
}

async function generatePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput
): Promise<void> {
  const { profile, chartData, chartId, dateKey = getMoscowTodayKey() } = input;

  switch (item.id) {
    case 'sign_daily': {
      const sign = String(chartData?.sun?.sign || '').trim();
      if (!sign) return;
      await runWithGenerationRetry('sign-daily', 3, () =>
        ensureDailySignHoroscope(sign, dateKey, profile.language === 'en' ? 'en' : 'ru')
      );
      return;
    }
    case 'forecast_daypart_day':
      await runWithGenerationRetry('forecast:day', 3, async () => {
        await getFullDaypartForecast(profile, chartData, 'day', {
          accessTier: 'premium',
          date: dateKey,
          chartId,
        });
      });
      return;
    default:
      return;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
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

  if (mode === 'generate-missing') {
    const orderedCompleted: Array<PrewarmTaskResult | null> = Array(plan.length).fill(null);
    let settled = 0;

    await runWithConcurrency(plan, GENERATE_MISSING_CONCURRENCY, async (item, index) => {
      try {
        if (Date.now() >= deadlineMs) {
          throw new Error('startup-content-deadline');
        }

        const hasCache = await probePrewarmItem(item, input);
        if (hasCache) {
          cachedTaskIds.push(item.id);
          orderedCompleted[index] = { id: item.id, status: 'cached' };
          return;
        }

        if (Date.now() >= deadlineMs) {
          throw new Error('startup-content-deadline');
        }

        await generatePrewarmItem(item, input);
        orderedCompleted[index] = { id: item.id, status: 'generated' };
      } catch (error: any) {
        const message = error?.message || String(error);
        log.warn(`Task failed: ${item.id}`, { message, code: error?.code, mode });
        failed.push({ id: item.id, status: 'failed', error: message });
      } finally {
        settled += 1;
        input.onProgress?.(settled / Math.max(plan.length, 1));
      }
    });

    return {
      planSize: plan.length,
      completed: orderedCompleted.filter((item): item is PrewarmTaskResult => !!item),
      failed,
      missingTaskIds,
      cachedTaskIds,
    };
  }

  for (const item of plan) {
    if (Date.now() >= deadlineMs) {
      missingTaskIds.push(item.id);
      continue;
    }

    try {
      const hasCache = await probePrewarmItem(item, input);
      if (hasCache) {
        cachedTaskIds.push(item.id);
        completed.push({ id: item.id, status: 'cached' });
        continue;
      }

      missingTaskIds.push(item.id);
      completed.push({ id: item.id, status: 'missing' });
      continue;
    } catch (error: any) {
      const message = error?.message || String(error);
      log.warn(`Task failed: ${item.id}`, { message, code: error?.code, mode });
      failed.push({ id: item.id, status: 'failed', error: message });
      missingTaskIds.push(item.id);
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
  const taskScope = input.onlyTaskIds?.length ? [...input.onlyTaskIds].sort().join(',') : 'all';
  const key = `${input.userId}:${input.chartId ?? 'primary'}:${dateKey}:${input.isPremium ? 'premium' : 'free'}:${mode}:${taskScope}`;

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
