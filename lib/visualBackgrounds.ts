import type { InterpretationSectionKey } from '../types';

export type NatalReadingBackgroundKey =
  | 'portrait'
  | 'formula'
  | 'luminaries'
  | 'strengths'
  | 'growth'
  | 'relationships'
  | 'work-money'
  | 'daily';

export const NATAL_READING_BACKGROUNDS: Record<NatalReadingBackgroundKey, string> = {
  portrait: '/natal-backgrounds/portrait.webp',
  formula: '/natal-backgrounds/formula.webp',
  luminaries: '/natal-backgrounds/luminaries.webp',
  strengths: '/natal-backgrounds/strengths.webp',
  growth: '/natal-backgrounds/growth.webp',
  relationships: '/natal-backgrounds/relationships.webp',
  'work-money': '/natal-backgrounds/work-money.webp',
  daily: '/natal-backgrounds/daily.webp',
};

const NATAL_BACKGROUND_BY_SECTION: Partial<Record<InterpretationSectionKey, NatalReadingBackgroundKey>> = {
  base_portrait: 'portrait',
  main_formula: 'formula',
  sun_code: 'luminaries',
  moon_code: 'luminaries',
  ascendant_code: 'luminaries',
  how_others_see_you: 'luminaries',
  emotional_world: 'luminaries',
  strengths: 'strengths',
  growth_zones: 'growth',
  self_relationship: 'growth',
  main_advice: 'formula',
  summary: 'portrait',
  today_by_chart: 'daily',
  work_business: 'work-money',
  money_stability: 'work-money',
  goals_actions: 'work-money',
  potential_purpose: 'work-money',
  energy_recovery: 'work-money',
  personal_growth_scenario: 'growth',
  love_relationships: 'relationships',
  friendship_social: 'relationships',
  family_home: 'relationships',
  communication_conflicts: 'relationships',
  shadow_patterns: 'growth',
  daily_overview: 'daily',
  daily_work_business: 'daily',
  daily_love: 'relationships',
  daily_money: 'work-money',
  daily_goals: 'daily',
  daily_communication: 'relationships',
  daily_friendship: 'relationships',
  daily_family: 'relationships',
  daily_energy: 'daily',
  daily_risks: 'growth',
  daily_best_action: 'daily',
  daily_advice: 'daily',
};

export function getNatalReadingBackground(sectionKey?: InterpretationSectionKey | null): string {
  const key = sectionKey ? NATAL_BACKGROUND_BY_SECTION[sectionKey] : 'portrait';
  return NATAL_READING_BACKGROUNDS[key || 'portrait'];
}

export function getSynastryBackground(score?: number | null): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return '/synastry-backgrounds/bond-05.webp';
  }
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const bucket = Math.min(9, Math.floor(normalized / 10));
  return `/synastry-backgrounds/bond-${String(bucket).padStart(2, '0')}.webp`;
}
