import type { ContentAccessTier, ContentSurface } from '../types';
import {
  HUMAN_BASE_CACHE_KEY,
  HUMAN_PAID_SECTION_KEYS,
  humanDailyCacheKey,
  humanPaidCacheKey,
  type HumanDailySectionKey,
  type HumanPaidSectionKey,
} from './natalHumanShared';

export type PrewarmPriority = 'high' | 'medium' | 'low';

export type PrewarmTaskId =
  | 'sign_daily'
  | 'forecast_daily'
  | 'human_base'
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
  | 'human_paid_work_business'
  | 'human_paid_love_relationships'
  | 'human_paid_money_stability'
  | 'human_paid_family_home'
  | 'human_paid_communication_conflicts'
  | 'human_paid_energy_recovery'
  | 'human_paid_friendship_social'
  | 'human_paid_goals_actions'
  | 'human_paid_shadow_patterns'
  | 'human_paid_potential_purpose'
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
  /** human paid natal section key when applicable */
  paidSectionKey?: HumanPaidSectionKey;
  /** forecast daypart slot */
  daypartSlot?: 'morning' | 'day' | 'evening';
};

export const PREMIUM_DAILY_READINESS_SECTION_KEYS = [
  'daily_love',
  'daily_work_business',
  'daily_money',
  'daily_goals',
] as const satisfies readonly HumanDailySectionKey[];

export type PremiumDailyReadinessSectionKey = (typeof PREMIUM_DAILY_READINESS_SECTION_KEYS)[number];

export const PREMIUM_DAILY_READINESS_TASK_BY_SECTION = {
  daily_love: 'human_daily_love',
  daily_work_business: 'human_daily_work_business',
  daily_money: 'human_daily_money',
  daily_goals: 'human_daily_goals',
} as const satisfies Record<PremiumDailyReadinessSectionKey, PrewarmTaskId>;

export const PREMIUM_DAILY_READINESS_TASK_IDS = [
  'human_daily_love',
  'human_daily_work_business',
  'human_daily_money',
  'human_daily_goals',
] as const satisfies readonly PrewarmTaskId[];

export type PremiumDailyReadinessTaskId = (typeof PREMIUM_DAILY_READINESS_TASK_IDS)[number];
export type PremiumDailyReadinessStatus = 'ready' | 'preparing' | 'failed';
export type PremiumDailyReadinessMap = Partial<
  Record<PremiumDailyReadinessSectionKey, PremiumDailyReadinessStatus>
>;

export function filterPremiumDailyReadinessTaskIds(taskIds: readonly PrewarmTaskId[]): PremiumDailyReadinessTaskId[] {
  const available = new Set<PrewarmTaskId>(taskIds);
  return PREMIUM_DAILY_READINESS_TASK_IDS.filter((id) => available.has(id));
}

export function buildPremiumDailyReadinessMap(
  taskIds: readonly PrewarmTaskId[],
  status: PremiumDailyReadinessStatus
): PremiumDailyReadinessMap {
  const available = new Set<PrewarmTaskId>(taskIds);
  const next: PremiumDailyReadinessMap = {};

  for (const sectionKey of PREMIUM_DAILY_READINESS_SECTION_KEYS) {
    if (available.has(PREMIUM_DAILY_READINESS_TASK_BY_SECTION[sectionKey])) {
      next[sectionKey] = status;
    }
  }

  return next;
}

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

export const HUMAN_PAID_TASK_IDS: Record<HumanPaidSectionKey, PrewarmTaskId> = {
  work_business: 'human_paid_work_business',
  love_relationships: 'human_paid_love_relationships',
  money_stability: 'human_paid_money_stability',
  family_home: 'human_paid_family_home',
  communication_conflicts: 'human_paid_communication_conflicts',
  energy_recovery: 'human_paid_energy_recovery',
  friendship_social: 'human_paid_friendship_social',
  goals_actions: 'human_paid_goals_actions',
  shadow_patterns: 'human_paid_shadow_patterns',
  potential_purpose: 'human_paid_potential_purpose',
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

function paidItem(sectionKey: HumanPaidSectionKey, priority: PrewarmPriority): PrewarmPlanItem {
  return {
    id: HUMAN_PAID_TASK_IDS[sectionKey],
    priority,
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'full',
    cacheKey: humanPaidCacheKey(sectionKey),
    paidSectionKey: sectionKey,
  };
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
    {
      id: 'forecast_daily',
      priority: 'high',
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
      cacheKey: dateKey,
    },
    {
      id: 'human_base',
      priority: 'high',
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
      cacheKey: HUMAN_BASE_CACHE_KEY,
    },
    dailyItem('daily_overview', 'high', dateKey, 'free'),
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
    dailyItem('daily_love', 'high', dateKey, 'premium'),
    dailyItem('daily_work_business', 'high', dateKey, 'premium'),
    dailyItem('daily_money', 'medium', dateKey, 'premium'),
    dailyItem('daily_goals', 'medium', dateKey, 'premium'),
    ...HUMAN_PAID_SECTION_KEYS.map((sectionKey) => paidItem(sectionKey, 'medium')),
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
