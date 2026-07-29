import type { NatalChartData, UserProfile } from '../types';

export type FeatureTier = 'free' | 'pro';

export type FeatureKey =
  | 'daily_sign_horoscope'
  | 'weekly_sign_horoscope'
  | 'zodiac_compatibility'
  | 'moon_calendar'
  | 'retrograde_tracker'
  | 'natal_basic'
  | 'personal_daily'
  | 'personal_weekly'
  | 'natal_love'
  | 'natal_career'
  | 'natal_shadow'
  | 'natal_talents'
  | 'personal_transits'
  | 'synastry_by_charts'
  | 'blind_spot'
  | 'natal_anger'
  | 'natal_money'
  | 'natal_family'
  | 'natal_how_others_see_you'
  | 'deep_report';

export type FeatureAccessStatus =
  | 'allowed'
  | 'needs_chart'
  | 'needs_premium'
  | 'unknown_feature';

export type FeatureAccessConfig = {
  key: FeatureKey;
  tier: FeatureTier;
  needsChart: boolean;
  label: string;
};

export type ChartAccessState = {
  chartData?: NatalChartData | null;
  primaryChartId?: number | string | null;
  chartId?: number | string | null;
  hasChart?: boolean | null;
  isSetup?: boolean | null;
};

type ProfileAccessState = Partial<UserProfile> & {
  premium_until?: string | Date | null;
  is_premium?: boolean | null;
  is_admin?: boolean | null;
};

export type FeatureAccessResult = {
  allowed: boolean;
  status: FeatureAccessStatus;
  reason: FeatureAccessStatus;
  config: FeatureAccessConfig | null;
  hasPremium: boolean;
  hasChart: boolean;
};

const FEATURE_ACCESS_MATRIX: FeatureAccessConfig[] = [
  { key: 'daily_sign_horoscope', tier: 'free', needsChart: false, label: 'Daily sign horoscope' },
  { key: 'weekly_sign_horoscope', tier: 'pro', needsChart: false, label: 'Weekly and monthly sign horoscope' },
  { key: 'zodiac_compatibility', tier: 'free', needsChart: false, label: 'Zodiac compatibility' },
  { key: 'moon_calendar', tier: 'free', needsChart: false, label: 'Moon calendar' },
  { key: 'retrograde_tracker', tier: 'free', needsChart: false, label: 'Retrograde tracker' },
  { key: 'natal_basic', tier: 'free', needsChart: true, label: 'Basic natal chart' },
  { key: 'personal_daily', tier: 'free', needsChart: true, label: 'Personal daily forecast' },
  { key: 'personal_weekly', tier: 'pro', needsChart: true, label: 'Personal weekly forecast' },
  { key: 'natal_love', tier: 'pro', needsChart: true, label: 'Natal love section' },
  { key: 'natal_career', tier: 'pro', needsChart: true, label: 'Natal career section' },
  { key: 'natal_shadow', tier: 'pro', needsChart: true, label: 'Natal shadow section' },
  { key: 'natal_talents', tier: 'pro', needsChart: true, label: 'Natal talents section' },
  { key: 'personal_transits', tier: 'pro', needsChart: true, label: 'Personal transits' },
  { key: 'synastry_by_charts', tier: 'pro', needsChart: true, label: 'Synastry by charts' },
  { key: 'blind_spot', tier: 'pro', needsChart: true, label: 'Blind spot' },
  { key: 'natal_anger', tier: 'pro', needsChart: true, label: 'Natal anger section' },
  { key: 'natal_money', tier: 'pro', needsChart: true, label: 'Natal money section' },
  { key: 'natal_family', tier: 'pro', needsChart: true, label: 'Natal family section' },
  { key: 'natal_how_others_see_you', tier: 'pro', needsChart: true, label: 'How others see you section' },
  { key: 'deep_report', tier: 'pro', needsChart: true, label: 'Deep report' },
];

const FEATURE_ACCESS_INDEX = new Map<FeatureKey, FeatureAccessConfig>(
  FEATURE_ACCESS_MATRIX.map((entry) => [entry.key, entry])
);

function parseFutureDate(value: unknown, nowMs: number): boolean | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return timestamp > nowMs;
}

function toPositiveId(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function isNatalChartData(value: unknown): value is NatalChartData {
  const chart = value as NatalChartData | null;
  return !!chart && !!chart.sun && !!chart.moon && !!chart.rising;
}

function readChartData(input: unknown): NatalChartData | null {
  if (isNatalChartData(input)) return input;
  const state = input as ChartAccessState | null;
  if (isNatalChartData(state?.chartData)) return state.chartData;
  return null;
}

export function getFeatureAccessConfig(featureKey: FeatureKey): FeatureAccessConfig | null {
  return FEATURE_ACCESS_INDEX.get(featureKey) || null;
}

export function listFeatureAccessMatrix(): FeatureAccessConfig[] {
  return FEATURE_ACCESS_MATRIX.slice();
}

export function getProfilePremiumUntil(profile?: ProfileAccessState | null): string | null {
  const value = profile?.premiumUntil ?? profile?.premium_until ?? null;
  return value ? String(value) : null;
}

export function hasActivePremium(profile?: ProfileAccessState | null, nowMs = Date.now()): boolean {
  if (!profile) return false;
  if (profile.isAdmin || profile.is_admin) return true;
  if (profile.isPremium === true || profile.is_premium === true) return true;
  return parseFutureDate(getProfilePremiumUntil(profile), nowMs) === true;
}

export function hasNatalChart(
  profileOrState?: (ProfileAccessState & ChartAccessState) | NatalChartData | null,
  chartState?: ChartAccessState | NatalChartData | null
): boolean {
  const states = [chartState, profileOrState].filter(Boolean);

  for (const state of states) {
    if (isNatalChartData(state)) return true;
    if (readChartData(state)) return true;
    const chartLike = state as ChartAccessState;
    if (toPositiveId(chartLike.primaryChartId) || toPositiveId(chartLike.chartId)) return true;
  }

  return false;
}

export function canAccessFeature(
  featureKey: FeatureKey,
  profile?: ProfileAccessState | null,
  chartState?: ChartAccessState | NatalChartData | null
): FeatureAccessResult {
  const config = getFeatureAccessConfig(featureKey);
  const premium = hasActivePremium(profile);
  const chart = hasNatalChart(profile, chartState);

  if (!config) {
    return {
      allowed: false,
      status: 'unknown_feature',
      reason: 'unknown_feature',
      config: null,
      hasPremium: premium,
      hasChart: chart,
    };
  }

  if (config.needsChart && !chart) {
    return {
      allowed: false,
      status: 'needs_chart',
      reason: 'needs_chart',
      config,
      hasPremium: premium,
      hasChart: chart,
    };
  }

  if (config.tier === 'pro' && !premium) {
    return {
      allowed: false,
      status: 'needs_premium',
      reason: 'needs_premium',
      config,
      hasPremium: premium,
      hasChart: chart,
    };
  }

  return {
    allowed: true,
    status: 'allowed',
    reason: 'allowed',
    config,
    hasPremium: premium,
    hasChart: chart,
  };
}
