import type { NatalChartData, UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmPriority,
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
  getCachedHumanDailySection,
  loadHumanDailySection,
  type HumanReadingError,
} from './natalReadingService';
import type { HumanDailySectionKey } from '../lib/natalHumanShared';
import {
  GENERATION_IN_PROGRESS,
  getRetryAfterMs,
  isGenerationInProgressError,
  waitMs,
} from '../lib/contentInterpretation';

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
  /** Max time to block startup on high+medium layers */
  blockingBudgetMs?: number;
  onProgress?: (ratio: number) => void;
};

export type PrewarmTaskResult = {
  id: PrewarmTaskId;
  status: 'skipped' | 'ready' | 'failed';
  error?: string;
};

export type PrewarmUserContentResult = {
  planSize: number;
  completed: PrewarmTaskResult[];
  failed: PrewarmTaskResult[];
  backgroundTaskIds: PrewarmTaskId[];
};

const DEFAULT_BLOCKING_BUDGET_MS = 38_000;
const MAX_TASK_ATTEMPTS: Record<PrewarmPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

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
      const delay = getRetryAfterMs(error);
      log.info(`${label}: waiting for in-flight generation`, { attempt, delayMs: delay });
      await waitMs(delay);
    }
  }
  throw lastError;
}

async function ensureHumanDailySection(
  userId: string,
  profile: UserProfile,
  chartData: NatalChartData,
  chartId: number | null | undefined,
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  accessTier: 'free' | 'premium',
  attempts: number
): Promise<'skipped' | 'ready'> {
  const cached = await getCachedHumanDailySection(userId, sectionKey, chartId ?? undefined, dateKey);
  if (cached?.content) return 'skipped';

  await runWithGenerationRetry(
    `human-daily:${sectionKey}`,
    attempts,
    async () => {
      const result = await loadHumanDailySection(userId, sectionKey, chartId ?? undefined, dateKey, {
        accessTier: sectionKey === 'daily_overview' ? undefined : 'premium',
      });
      if (!result?.content) {
        const err = new Error('Human daily section is empty') as HumanReadingError;
        err.code = 'EMPTY_INTERPRETATION';
        throw err;
      }
      return result;
    }
  );

  return 'ready';
}

async function executePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput
): Promise<'skipped' | 'ready'> {
  const { profile, chartData, userId, chartId, dateKey = getMoscowTodayKey() } = input;
  const language = profile.language === 'en' ? 'en' : 'ru';
  const attempts = MAX_TASK_ATTEMPTS[item.priority];

  switch (item.id) {
    case 'forecast_daily': {
      const cached = await getCachedDailyForecastLayer(userId, chartId);
      if (cached) return 'skipped';
      await runWithGenerationRetry('forecast:daily', attempts, () =>
        getDailyForecastLayer(profile, chartData)
      );
      return 'ready';
    }
    case 'natal_anchor': {
      const cached = await getCachedNatalAnchorLayer(userId, language, chartId);
      if (cached) return 'skipped';
      await runWithGenerationRetry('natal:anchor', attempts, () =>
        getNatalAnchorLayer(profile, chartData, chartId)
      );
      return 'ready';
    }
    case 'forecast_daypart_morning':
    case 'forecast_daypart_day':
    case 'forecast_daypart_evening': {
      const slot = item.daypartSlot!;
      const cached = await getCachedFullDaypartForecast(userId, slot, {
        chartId,
        accessTier: 'premium',
        dateKey,
      });
      if (cached) return 'skipped';
      await runWithGenerationRetry(`forecast:${slot}`, attempts, async () => {
        await getFullDaypartForecast(profile, chartData, slot, {
          accessTier: 'premium',
          date: dateKey,
        });
      });
      return 'ready';
    }
    case 'forecast_weekly': {
      const cached = await getCachedWeeklyForecastLayer(userId, chartId, item.cacheKey);
      if (cached) return 'skipped';
      await runWithGenerationRetry('forecast:weekly', attempts, () =>
        ensureWeeklyForecastLayer(profile, chartData, item.cacheKey)
      );
      return 'ready';
    }
    case 'forecast_monthly': {
      const cached = await getCachedMonthlyForecastLayer(userId, chartId, item.cacheKey);
      if (cached) return 'skipped';
      await runWithGenerationRetry('forecast:monthly', attempts, () =>
        ensureMonthlyForecastLayer(profile, chartData, item.cacheKey)
      );
      return 'ready';
    }
    case 'natal_full': {
      const cached = await getCachedPremiumNatalFullLayer(userId, language, chartId);
      if (cached) return 'skipped';
      await runWithGenerationRetry('natal:full', attempts, () =>
        getPremiumNatalFullLayer(profile, chartData, chartId)
      );
      return 'ready';
    }
    default: {
      if (!item.sectionKey) return 'skipped';
      return ensureHumanDailySection(
        userId,
        profile,
        chartData,
        chartId,
        item.sectionKey,
        dateKey,
        item.accessTier === 'free' ? 'free' : 'premium',
        attempts
      );
    }
  }
}

async function runPlanSlice(
  plan: PrewarmPlanItem[],
  input: PrewarmUserContentInput,
  deadlineMs: number
): Promise<{ completed: PrewarmTaskResult[]; failed: PrewarmTaskResult[]; stoppedEarly: boolean }> {
  const completed: PrewarmTaskResult[] = [];
  const failed: PrewarmTaskResult[] = [];

  for (const item of plan) {
    if (Date.now() >= deadlineMs) {
      return { completed, failed, stoppedEarly: true };
    }

    try {
      const status = await executePrewarmItem(item, input);
      completed.push({ id: item.id, status });
    } catch (error: any) {
      const message = error?.message || String(error);
      log.warn(`Task failed: ${item.id}`, { message, code: error?.code });
      failed.push({ id: item.id, status: 'failed', error: message });
    }

    input.onProgress?.((completed.length + failed.length) / Math.max(plan.length, 1));
  }

  return { completed, failed, stoppedEarly: false };
}

export async function prewarmUserContent(
  input: PrewarmUserContentInput
): Promise<PrewarmUserContentResult> {
  const dateKey = input.dateKey || getMoscowTodayKey();
  const key = `${input.userId}:${input.chartId ?? 'primary'}:${dateKey}:${input.isPremium ? 'premium' : 'free'}`;

  if (prewarmInFlight && prewarmInFlightKey === key) {
    return prewarmInFlight;
  }

  const plan = buildUserPrewarmPlan(input.isPremium, dateKey);
  const blockingBudgetMs = input.blockingBudgetMs ?? DEFAULT_BLOCKING_BUDGET_MS;
  const deadline = Date.now() + blockingBudgetMs;

  const highMedium = plan.filter((item) => item.priority !== 'low');
  const low = plan.filter((item) => item.priority === 'low');

  const run = async (): Promise<PrewarmUserContentResult> => {
    log.info('Starting prewarm', {
      userId: input.userId,
      isPremium: input.isPremium,
      planSize: plan.length,
      dateKey,
    });

    const blocking = await runPlanSlice(highMedium, input, deadline);
    const backgroundTaskIds = low.map((item) => item.id);

    if (blocking.stoppedEarly && low.length === 0) {
      return {
        planSize: plan.length,
        completed: blocking.completed,
        failed: blocking.failed,
        backgroundTaskIds: plan
          .filter((item) => !blocking.completed.some((c) => c.id === item.id))
          .map((item) => item.id),
      };
    }

    void runPlanSlice(low, { ...input, blockingBudgetMs: 120_000 }, Date.now() + 120_000).then((bg) => {
      log.info('Background prewarm finished', {
        ready: bg.completed.filter((c) => c.status === 'ready').length,
        skipped: bg.completed.filter((c) => c.status === 'skipped').length,
        failed: bg.failed.length,
      });
    });

    return {
      planSize: plan.length,
      completed: blocking.completed,
      failed: blocking.failed,
      backgroundTaskIds,
    };
  };

  prewarmInFlightKey = key;
  prewarmInFlight = run().finally(() => {
    prewarmInFlight = null;
    prewarmInFlightKey = null;
  });

  return prewarmInFlight;
}

export function resetPrewarmSessionForTests() {
  prewarmInFlight = null;
  prewarmInFlightKey = null;
}
