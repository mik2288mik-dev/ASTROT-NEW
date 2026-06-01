import type { ContentAccessTier, ContentSurface } from '../types';
import { getMoscowIsoWeekKey, getMoscowMonthKey } from './date-utils';
import { NATAL_ANCHOR_CACHE_KEY, NATAL_FULL_CACHE_KEY } from './natalReadings';
import { humanDailyCacheKey, type HumanDailySectionKey } from './natalHumanShared';

export type PrewarmPriority = 'high' | 'medium' | 'low';

export type PrewarmTaskId =
  | 'forecast_daily'
  | 'natal_anchor'
  | 'human_daily_overview'
  | 'forecast_daypart_morning'
  | 'forecast_daypart_day'
  | 'forecast_daypart_evening'
  | 'human_daily_love'
  | 'human_daily_work_business'
  | 'human_daily_money'
  | 'human_daily_goals'
  | 'human_daily_best_action'
  | 'human_daily_advice'
  | 'natal_full'
  | 'forecast_weekly'
  | 'forecast_monthly';

export type PrewarmPlanItem = {
  id: PrewarmTaskId;
  priority: PrewarmPriority;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: string;
  cacheKey: string;
  /** human-daily section key when applicable */
  sectionKey?: HumanDailySectionKey;
  /** forecast daypart slot */
  daypartSlot?: 'morning' | 'day' | 'evening';
};

const PRIORITY_ORDER: Record<PrewarmPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortPrewarmPlan(plan: PrewarmPlanItem[]): PrewarmPlanItem[] {
  return [...plan].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

const HUMAN_DAILY_TASK_IDS: Record<HumanDailySectionKey, PrewarmTaskId> = {
  daily_overview: 'human_daily_overview',
  daily_work_business: 'human_daily_work_business',
  daily_love: 'human_daily_love',
  daily_money: 'human_daily_money',
  daily_goals: 'human_daily_goals',
  daily_communication: 'human_daily_advice',
  daily_friendship: 'human_daily_advice',
  daily_family: 'human_daily_advice',
  daily_energy: 'human_daily_advice',
  daily_risks: 'human_daily_advice',
  daily_best_action: 'human_daily_best_action',
  daily_advice: 'human_daily_advice',
};

function dailyItem(
  sectionKey: HumanDailySectionKey,
  priority: PrewarmPriority,
  dateKey: string,
  accessTier: ContentAccessTier
): PrewarmPlanItem {
  return {
    id: HUMAN_DAILY_TASK_IDS[sectionKey],
    priority,
    accessTier,
    contentSurface: 'natal',
    contentVariant: 'living',
    cacheKey: humanDailyCacheKey(dateKey, sectionKey),
    sectionKey,
  };
}

export function buildFreePrewarmPlan(dateKey: string): PrewarmPlanItem[] {
  return sortPrewarmPlan([
    {
      id: 'forecast_daily',
      priority: 'high',
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: dateKey,
    },
    {
      id: 'natal_anchor',
      priority: 'high',
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
      cacheKey: NATAL_ANCHOR_CACHE_KEY,
    },
    dailyItem('daily_overview', 'high', dateKey, 'free'),
  ]);
}

function moscowDateFromKey(dateKey: string): Date {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function buildPremiumPrewarmPlan(dateKey: string): PrewarmPlanItem[] {
  const moscowDate = moscowDateFromKey(dateKey);
  const weekKey = getMoscowIsoWeekKey(moscowDate);
  const monthKey = getMoscowMonthKey(moscowDate);

  const premiumOnly: PrewarmPlanItem[] = [
    {
      id: 'forecast_daypart_morning',
      priority: 'high',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'morning',
      cacheKey: `${dateKey}:morning`,
      daypartSlot: 'morning',
    },
    {
      id: 'forecast_daypart_day',
      priority: 'high',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'day',
      cacheKey: `${dateKey}:day`,
      daypartSlot: 'day',
    },
    dailyItem('daily_love', 'high', dateKey, 'premium'),
    dailyItem('daily_work_business', 'high', dateKey, 'premium'),
    {
      id: 'forecast_daypart_evening',
      priority: 'medium',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'evening',
      cacheKey: `${dateKey}:evening`,
      daypartSlot: 'evening',
    },
    dailyItem('daily_money', 'medium', dateKey, 'premium'),
    dailyItem('daily_goals', 'medium', dateKey, 'premium'),
    {
      id: 'natal_full',
      priority: 'medium',
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
      cacheKey: NATAL_FULL_CACHE_KEY,
    },
    dailyItem('daily_best_action', 'medium', dateKey, 'premium'),
    dailyItem('daily_advice', 'medium', dateKey, 'premium'),
    {
      id: 'forecast_weekly',
      priority: 'low',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'weekly',
      cacheKey: weekKey,
    },
    {
      id: 'forecast_monthly',
      priority: 'low',
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'monthly',
      cacheKey: monthKey,
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
