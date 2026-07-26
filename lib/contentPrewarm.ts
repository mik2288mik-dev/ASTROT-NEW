import type { ContentAccessTier, ContentSurface } from '../types';

export type PrewarmPriority = 'high' | 'medium' | 'low';
export type PrewarmTaskId = 'personal_forecast_day';

export type PrewarmPlanItem = {
  id: PrewarmTaskId;
  priority: PrewarmPriority;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: 'daily';
  cacheKey: string;
};

export const FREE_STARTUP_REQUIRED_TASK_IDS = [
  'personal_forecast_day',
] as const satisfies readonly PrewarmTaskId[];

export const PREMIUM_STARTUP_REQUIRED_TASK_IDS = [
  ...FREE_STARTUP_REQUIRED_TASK_IDS,
] as const satisfies readonly PrewarmTaskId[];

export function getStartupRequiredTaskIds(_isPremium: boolean): PrewarmTaskId[] {
  return [...FREE_STARTUP_REQUIRED_TASK_IDS];
}

const PRIORITY_ORDER: Record<PrewarmPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortPrewarmPlan(plan: PrewarmPlanItem[]): PrewarmPlanItem[] {
  return [...plan].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function buildFreePrewarmPlan(dateKey: string): PrewarmPlanItem[] {
  return [{
    id: 'personal_forecast_day',
    priority: 'high',
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
    cacheKey: dateKey,
  }];
}

export function buildPremiumPrewarmPlan(dateKey: string): PrewarmPlanItem[] {
  return buildFreePrewarmPlan(dateKey).map((item) => ({
    ...item,
    accessTier: 'premium',
  }));
}

export function buildUserPrewarmPlan(isPremium: boolean, dateKey: string): PrewarmPlanItem[] {
  return isPremium ? buildPremiumPrewarmPlan(dateKey) : buildFreePrewarmPlan(dateKey);
}

export function planUsesContentGenerationLock(item: PrewarmPlanItem): boolean {
  return item.id === 'personal_forecast_day';
}
