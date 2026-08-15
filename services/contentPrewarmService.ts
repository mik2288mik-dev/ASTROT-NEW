import type { UserProfile } from '../types';
import {
  buildUserPrewarmPlan,
  type PrewarmPlanItem,
  type PrewarmTaskId,
} from '../lib/contentPrewarm';
import {
  getAiPersonalHoroscopePeriodKey,
  normalizeAiPersonalHoroscopeTimezone,
  type AiPersonalHoroscopePeriod,
} from '../lib/aiPersonalHoroscope';
import {
  loadPersonalForecast,
  type PersonalForecastClientError,
} from './personalForecastService';

export type PrewarmMode = 'cache-only' | 'generate-missing';

export type PrewarmUserContentInput = {
  userId: string;
  profile: UserProfile;
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
  periodKeys: Record<AiPersonalHoroscopePeriod, string>;
};

const PERIOD_BY_TASK_ID: Record<PrewarmTaskId, AiPersonalHoroscopePeriod> = {
  personal_forecast_day: 'day',
  personal_forecast_week: 'week',
  personal_forecast_month: 'month',
};

function personalHoroscopePeriodKeys(
  input: PrewarmUserContentInput,
): Record<AiPersonalHoroscopePeriod, string> {
  const timezone = normalizeAiPersonalHoroscopeTimezone(
    input.profile.birthTimezone || 'Europe/Moscow',
  );
  const now = new Date();
  return {
    day: getAiPersonalHoroscopePeriodKey('day', now, timezone),
    week: getAiPersonalHoroscopePeriodKey('week', now, timezone),
    month: getAiPersonalHoroscopePeriodKey('month', now, timezone),
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

/**
 * Personal horoscope prewarm depends only on the saved user profile and access
 * tier. The generic keeps older callers source-compatible even if their wider
 * startup object still contains unrelated natal-chart fields; those fields are
 * neither part of this contract nor read here.
 */
export async function prewarmUserContent<T extends PrewarmUserContentInput>(
  input: T,
): Promise<PrewarmUserContentResult> {
  const periodKeys = personalHoroscopePeriodKeys(input);
  const mode = input.mode || 'cache-only';
  const scope = input.onlyTaskIds?.length
    ? [...input.onlyTaskIds].sort().join(',')
    : 'all';
  const key = [
    input.userId,
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
