import type { ContentAccessTier, ContentSurface } from '../types';
import type { PersonalForecastPeriod } from './personalForecastContract';

export type PrewarmPriority = 'high' | 'medium' | 'low';
export type PrewarmTaskId =
  | 'personal_forecast_day'
  | 'personal_forecast_week'
  | 'personal_forecast_month';

export type PersonalForecastPrewarmKeys = Record<PersonalForecastPeriod, string>;

export type PrewarmPlanItem = {
  id: PrewarmTaskId;
  priority: PrewarmPriority;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: 'daily' | 'weekly' | 'monthly';
  cacheKey: string;
};

export const FREE_STARTUP_REQUIRED_TASK_IDS = [
  'personal_forecast_day',
] as const satisfies readonly PrewarmTaskId[];

export const PREMIUM_STARTUP_REQUIRED_TASK_IDS = [
  'personal_forecast_day',
  'personal_forecast_week',
  'personal_forecast_month',
] as const satisfies readonly PrewarmTaskId[];

export function getStartupRequiredTaskIds(isPremium: boolean): PrewarmTaskId[] {
  return isPremium
    ? [...PREMIUM_STARTUP_REQUIRED_TASK_IDS]
    : [...FREE_STARTUP_REQUIRED_TASK_IDS];
}

const PRIORITY_ORDER: Record<PrewarmPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortPrewarmPlan(plan: PrewarmPlanItem[]): PrewarmPlanItem[] {
  return [...plan].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function buildFreePrewarmPlan(
  periodKeys: PersonalForecastPrewarmKeys,
): PrewarmPlanItem[] {
  return [{
    id: 'personal_forecast_day',
    priority: 'high',
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
    cacheKey: periodKeys.day,
  }];
}

export function buildPremiumPrewarmPlan(
  periodKeys: PersonalForecastPrewarmKeys,
): PrewarmPlanItem[] {
  return [
    {
      id: 'personal_forecast_day',
      priority: 'high',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: periodKeys.day,
    },
    {
      id: 'personal_forecast_week',
      priority: 'medium',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'weekly',
      cacheKey: periodKeys.week,
    },
    {
      id: 'personal_forecast_month',
      priority: 'medium',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'monthly',
      cacheKey: periodKeys.month,
    },
  ];
}

export function buildUserPrewarmPlan(
  isPremium: boolean,
  periodKeys: PersonalForecastPrewarmKeys,
): PrewarmPlanItem[] {
  return isPremium ? buildPremiumPrewarmPlan(periodKeys) : buildFreePrewarmPlan(periodKeys);
}

export function planUsesContentGenerationLock(item: PrewarmPlanItem): boolean {
  return item.id.startsWith('personal_forecast_');
}
