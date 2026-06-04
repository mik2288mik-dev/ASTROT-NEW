import type { ContentAccessTier, ContentSurface } from '../types';

export type PrewarmPriority = 'high' | 'medium' | 'low';

export type PrewarmTaskId =
  | 'sign_daily'
  | 'forecast_daypart_day';

export type PrewarmPlanItem = {
  id: PrewarmTaskId;
  priority: PrewarmPriority;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: string;
  cacheKey: string;
  /** forecast daypart slot */
  daypartSlot?: 'day';
};

export const FREE_STARTUP_REQUIRED_TASK_IDS = [
  'sign_daily',
] as const satisfies readonly PrewarmTaskId[];

export const PREMIUM_STARTUP_REQUIRED_TASK_IDS = [
  ...FREE_STARTUP_REQUIRED_TASK_IDS,
] as const satisfies readonly PrewarmTaskId[];

export function getStartupRequiredTaskIds(isPremium: boolean): PrewarmTaskId[] {
  return [...(isPremium ? PREMIUM_STARTUP_REQUIRED_TASK_IDS : FREE_STARTUP_REQUIRED_TASK_IDS)];
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
  return sortPrewarmPlan([
    {
      id: 'sign_daily',
      priority: 'high',
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: dateKey,
    },
  ]);
}

export function buildPremiumPrewarmPlan(dateKey: string): PrewarmPlanItem[] {
  const premiumOnly: PrewarmPlanItem[] = [
    {
      id: 'forecast_daypart_day',
      priority: 'high',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'day',
      cacheKey: `${dateKey}:day`,
      daypartSlot: 'day',
    },
  ];

  const free = buildFreePrewarmPlan(dateKey);
  const seen = new Set<string>();
  const merged: PrewarmPlanItem[] = [];

  for (const item of [...free, ...premiumOnly]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return sortPrewarmPlan(merged);
}

export function buildUserPrewarmPlan(isPremium: boolean, dateKey: string): PrewarmPlanItem[] {
  return isPremium ? buildPremiumPrewarmPlan(dateKey) : buildFreePrewarmPlan(dateKey);
}

export function planUsesContentGenerationLock(item: PrewarmPlanItem): boolean {
  return item.contentSurface === 'forecast' || item.contentVariant === 'anchor' || item.contentVariant === 'full';
}
