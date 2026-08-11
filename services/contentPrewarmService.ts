import type { NatalChartData, UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmTaskId,
} from '../lib/contentPrewarm';
import {
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  loadPersonalForecast,
  type PersonalForecastClientError,
} from './personalForecastService';

export type PrewarmMode = 'cache-only' | 'generate-missing';

export type PrewarmUserContentInput = {
  userId: string;
  chartId?: number | null;
  profile: UserProfile;
  chartData: NatalChartData;
  isPremium: boolean;
  dateKey?: string;
  mode?: PrewarmMode;
  onlyTaskIds?: PrewarmTaskId[];
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
const prewarmInFlight = new Map<string, Promise<PrewarmUserContentResult>>();

type PrewarmExecutionInput = PrewarmUserContentInput & {
  periodKeys: Record<PersonalForecastPeriod, string>;
};

const PERIOD_BY_TASK_ID: Record<PrewarmTaskId, PersonalForecastPeriod> = {
  personal_forecast_day: 'day',
  personal_forecast_week: 'week',
  personal_forecast_month: 'month',
};

function personalForecastPeriodKeys(
  input: PrewarmUserContentInput,
): Record<PersonalForecastPeriod, string> {
  const timezone = normalizeForecastTimezone(
    input.chartData.timezone || input.profile.birthTimezone,
  );
  const now = new Date();
  return {
    day: getPersonalForecastPeriodKey('day', now, timezone),
    week: getPersonalForecastPeriodKey('week', now, timezone),
    month: getPersonalForecastPeriodKey('month', now, timezone),
  };
}

async function probePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmExecutionInput,
): Promise<boolean> {
  const period = PERIOD_BY_TASK_ID[item.id];
  try {
    await loadPersonalForecast({
      profile: input.profile,
      chartData: input.chartData,
      chartId: input.chartId,
      period,
      periodKey: input.periodKeys[period],
      options: { cacheOnly: true, force: true },
    });
    return true;
  } catch (error) {
    if ((error as PersonalForecastClientError)?.status === 404) return false;
    throw error;
  }
}

async function generatePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmExecutionInput,
): Promise<void> {
  const period = PERIOD_BY_TASK_ID[item.id];
  await loadPersonalForecast({
    profile: input.profile,
    chartData: input.chartData,
    chartId: input.chartId,
    period,
    periodKey: input.periodKeys[period],
    options: { force: true },
  });
}

async function runPlan(
  plan: PrewarmPlanItem[],
  input: PrewarmExecutionInput,
  deadline: number,
): Promise<PrewarmUserContentResult> {
  const completed: PrewarmTaskResult[] = [];
  const failed: PrewarmTaskResult[] = [];
  const missingTaskIds: PrewarmTaskId[] = [];
  const cachedTaskIds: PrewarmTaskId[] = [];
  const mode = input.mode || 'cache-only';

  await Promise.all(plan.map(async (item) => {
    if (Date.now() >= deadline) {
      missingTaskIds.push(item.id);
      return;
    }
    try {
      const cached = await probePrewarmItem(item, input);
      if (cached) {
        cachedTaskIds.push(item.id);
        completed.push({ id: item.id, status: 'cached' });
      } else if (mode === 'cache-only') {
        missingTaskIds.push(item.id);
        completed.push({ id: item.id, status: 'missing' });
      } else if (Date.now() < deadline) {
        await generatePrewarmItem(item, input);
        completed.push({ id: item.id, status: 'generated' });
      } else {
        missingTaskIds.push(item.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ id: item.id, status: 'failed', error: message });
      if (mode === 'cache-only') missingTaskIds.push(item.id);
    } finally {
      input.onProgress?.((completed.length + failed.length) / Math.max(plan.length, 1));
    }
  }));

  return {
    planSize: plan.length,
    completed,
    failed,
    missingTaskIds,
    cachedTaskIds,
  };
}

export async function prewarmUserContent(
  input: PrewarmUserContentInput,
): Promise<PrewarmUserContentResult> {
  const periodKeys = personalForecastPeriodKeys(input);
  const mode = input.mode || 'cache-only';
  const scope = input.onlyTaskIds?.length
    ? [...input.onlyTaskIds].sort().join(',')
    : 'all';
  const key = [
    input.userId,
    input.chartId ?? 'primary',
    periodKeys.day,
    periodKeys.week,
    periodKeys.month,
    mode,
    scope,
  ].join(':');
  const existing = prewarmInFlight.get(key);
  if (existing) return existing;

  let plan = buildUserPrewarmPlan(input.isPremium, periodKeys);
  if (input.onlyTaskIds?.length) {
    const allowed = new Set(input.onlyTaskIds);
    plan = plan.filter((item) => allowed.has(item.id));
  }
  const budget = input.blockingBudgetMs
    ?? (mode === 'cache-only'
      ? CACHE_ONLY_DEFAULT_BUDGET_MS
      : GENERATE_MISSING_DEFAULT_BUDGET_MS);
  const request = runPlan(plan, { ...input, periodKeys }, Date.now() + budget).finally(() => {
    if (prewarmInFlight.get(key) === request) prewarmInFlight.delete(key);
  });
  prewarmInFlight.set(key, request);
  return request;
}

export function resetPrewarmSessionForTests(): void {
  prewarmInFlight.clear();
}
