import type { NatalChartData, UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmTaskId,
} from '../lib/contentPrewarm';
import {
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
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

function personalDayKey(input: PrewarmUserContentInput): string {
  const timezone = normalizeForecastTimezone(
    input.chartData.timezone || input.profile.birthTimezone,
  );
  return getPersonalForecastPeriodKey('day', new Date(), timezone);
}

async function probePrewarmItem(
  item: PrewarmPlanItem,
  input: PrewarmUserContentInput,
): Promise<boolean> {
  if (item.id !== 'personal_forecast_day') return false;
  try {
    await loadPersonalForecast({
      profile: input.profile,
      chartData: input.chartData,
      chartId: input.chartId,
      period: 'day',
      periodKey: personalDayKey(input),
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
  input: PrewarmUserContentInput,
): Promise<void> {
  if (item.id !== 'personal_forecast_day') return;
  await loadPersonalForecast({
    profile: input.profile,
    chartData: input.chartData,
    chartId: input.chartId,
    period: 'day',
    periodKey: personalDayKey(input),
    options: { force: true },
  });
}

async function runPlan(
  plan: PrewarmPlanItem[],
  input: PrewarmUserContentInput,
  deadline: number,
): Promise<PrewarmUserContentResult> {
  const completed: PrewarmTaskResult[] = [];
  const failed: PrewarmTaskResult[] = [];
  const missingTaskIds: PrewarmTaskId[] = [];
  const cachedTaskIds: PrewarmTaskId[] = [];
  const mode = input.mode || 'cache-only';

  for (const item of plan) {
    if (Date.now() >= deadline) {
      missingTaskIds.push(item.id);
      continue;
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
  input: PrewarmUserContentInput,
): Promise<PrewarmUserContentResult> {
  const periodKey = personalDayKey(input);
  const mode = input.mode || 'cache-only';
  const scope = input.onlyTaskIds?.length
    ? [...input.onlyTaskIds].sort().join(',')
    : 'all';
  const key = [
    input.userId,
    input.chartId ?? 'primary',
    periodKey,
    mode,
    scope,
  ].join(':');
  const existing = prewarmInFlight.get(key);
  if (existing) return existing;

  let plan = buildUserPrewarmPlan(input.isPremium, periodKey);
  if (input.onlyTaskIds?.length) {
    const allowed = new Set(input.onlyTaskIds);
    plan = plan.filter((item) => allowed.has(item.id));
  }
  const budget = input.blockingBudgetMs
    ?? (mode === 'cache-only'
      ? CACHE_ONLY_DEFAULT_BUDGET_MS
      : GENERATE_MISSING_DEFAULT_BUDGET_MS);
  const request = runPlan(plan, input, Date.now() + budget).finally(() => {
    if (prewarmInFlight.get(key) === request) prewarmInFlight.delete(key);
  });
  prewarmInFlight.set(key, request);
  return request;
}

export function resetPrewarmSessionForTests(): void {
  prewarmInFlight.clear();
}
