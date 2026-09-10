import {
  PREMIUM_ENTITLEMENT_STATES,
  type NatalChartData,
  type PremiumEntitlementState,
  type UserProfile,
} from '../types';
import { isReadableNatalChart } from './readableNatalChart';

export const ENTITLEMENT_STATES = PREMIUM_ENTITLEMENT_STATES;
export type EntitlementState = PremiumEntitlementState;
export type FeatureTier = 'free' | 'premium';

export type FeatureKey =
  | 'daily_sign_horoscope'
  | 'weekly_sign_horoscope'
  | 'zodiac_compatibility'
  | 'moon_calendar'
  | 'retrograde_tracker'
  | 'natal_basic'
  | 'natal_deep'
  | 'personality_deep'
  | 'natal_questions'
  | 'personal_daily'
  | 'personal_daily_full'
  | 'personal_weekly'
  | 'personal_monthly'
  | 'own_chart'
  | 'saved_people'
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

type EntitlementRecordLike = {
  state?: unknown;
  status?: unknown;
  source?: unknown;
  isPremium?: unknown;
  endsAt?: unknown;
  ends_at?: unknown;
  expiresAt?: unknown;
  expires_at?: unknown;
};

export type ProfileAccessState = Partial<UserProfile> & {
  premium_until?: string | Date | null;
  is_premium?: boolean | null;
  is_admin?: boolean | null;
  entitlementState?: EntitlementState | null;
  entitlement_state?: EntitlementState | null;
  entitlementStatus?: string | null;
  entitlement_status?: string | null;
  entitlementSource?: string | null;
  entitlement_source?: string | null;
  entitlementEndsAt?: string | Date | null;
  entitlement_ends_at?: string | Date | null;
  entitlement?: EntitlementRecordLike | null;
  premiumEntitlement?: EntitlementRecordLike | null;
};

export type FeatureAccessResult = {
  allowed: boolean;
  status: FeatureAccessStatus;
  reason: FeatureAccessStatus;
  config: FeatureAccessConfig | null;
  hasPremium: boolean;
  hasChart: boolean;
};

export const CANONICAL_ACCESS_CONTRACT = {
  free: {
    featureKeys: [
      'natal_basic',
      'personal_daily',
      'daily_sign_horoscope',
      'zodiac_compatibility',
      'own_chart',
      'saved_people',
      // Existing utility surfaces remain additive to the promised Free core.
      'moon_calendar',
      'retrograde_tracker',
    ] as const satisfies readonly FeatureKey[],
    ownChartLimit: 1,
    additionalSavedPeopleLimit: 1,
    todayOpenFragmentCount: { min: 1, max: 2 },
  },
  premium: {
    featureKeys: [
      'personal_daily_full',
      'personal_weekly',
      'personal_monthly',
      'natal_deep',
      'personality_deep',
      'natal_questions',
      'synastry_by_charts',
      // Existing implementation keys are aliases inside the same paid contract.
      'weekly_sign_horoscope',
      'natal_love',
      'natal_career',
      'natal_shadow',
      'natal_talents',
      'personal_transits',
      'blind_spot',
      'natal_anger',
      'natal_money',
      'natal_family',
      'natal_how_others_see_you',
      'deep_report',
    ] as const satisfies readonly FeatureKey[],
    ownChartLimit: 1,
    additionalSavedPeopleLimit: 20,
  },
} as const;

export const FREE_SAVED_PERSON_LIMIT = CANONICAL_ACCESS_CONTRACT.free.additionalSavedPeopleLimit;
export const FREE_ACTIVE_CHART_LIMIT = CANONICAL_ACCESS_CONTRACT.free.ownChartLimit + FREE_SAVED_PERSON_LIMIT;
export const PREMIUM_SAVED_PERSON_LIMIT = CANONICAL_ACCESS_CONTRACT.premium.additionalSavedPeopleLimit;
export const PREMIUM_ACTIVE_CHART_LIMIT = CANONICAL_ACCESS_CONTRACT.premium.ownChartLimit + PREMIUM_SAVED_PERSON_LIMIT;

const FEATURE_DETAILS: Record<FeatureKey, Omit<FeatureAccessConfig, 'key' | 'tier'>> = {
  daily_sign_horoscope: { needsChart: false, label: 'Daily sign horoscope' },
  weekly_sign_horoscope: { needsChart: false, label: 'Weekly and monthly sign horoscope' },
  zodiac_compatibility: { needsChart: false, label: 'Zodiac compatibility' },
  moon_calendar: { needsChart: false, label: 'Moon calendar' },
  retrograde_tracker: { needsChart: false, label: 'Retrograde tracker' },
  natal_basic: { needsChart: true, label: 'Basic natal chart' },
  natal_deep: { needsChart: true, label: 'Deep natal reading' },
  personality_deep: { needsChart: true, label: 'Deep personality reading' },
  natal_questions: { needsChart: true, label: 'Questions about the saved natal chart' },
  personal_daily: { needsChart: false, label: 'Personal daily horoscope' },
  personal_daily_full: { needsChart: false, label: 'Full personal daily horoscope' },
  personal_weekly: { needsChart: false, label: 'Personal weekly horoscope' },
  personal_monthly: { needsChart: false, label: 'Personal monthly horoscope' },
  own_chart: { needsChart: false, label: 'Own natal chart' },
  saved_people: { needsChart: true, label: 'Additional saved people' },
  natal_love: { needsChart: true, label: 'Natal love section' },
  natal_career: { needsChart: true, label: 'Natal career section' },
  natal_shadow: { needsChart: true, label: 'Natal shadow section' },
  natal_talents: { needsChart: true, label: 'Natal talents section' },
  personal_transits: { needsChart: true, label: 'Personal transits' },
  synastry_by_charts: { needsChart: true, label: 'Synastry by calculated charts' },
  blind_spot: { needsChart: true, label: 'Blind spot' },
  natal_anger: { needsChart: true, label: 'Natal anger section' },
  natal_money: { needsChart: true, label: 'Natal money section' },
  natal_family: { needsChart: true, label: 'Natal family section' },
  natal_how_others_see_you: { needsChart: true, label: 'How others see you section' },
  deep_report: { needsChart: true, label: 'Deep report' },
};

function buildTierEntries(tier: FeatureTier, keys: readonly FeatureKey[]): FeatureAccessConfig[] {
  return keys.map((key) => ({ key, tier, ...FEATURE_DETAILS[key] }));
}

const FEATURE_ACCESS_MATRIX: FeatureAccessConfig[] = [
  ...buildTierEntries('free', CANONICAL_ACCESS_CONTRACT.free.featureKeys),
  ...buildTierEntries('premium', CANONICAL_ACCESS_CONTRACT.premium.featureKeys),
];

const FEATURE_ACCESS_INDEX = new Map<FeatureKey, FeatureAccessConfig>(
  FEATURE_ACCESS_MATRIX.map((entry) => [entry.key, entry])
);
const ENTITLEMENT_STATE_SET = new Set<string>(ENTITLEMENT_STATES);
const ACTIVE_ENTITLEMENT_STATES = new Set<EntitlementState>([
  'gift',
  'store_trial',
  'paid',
  'grace',
  'cancelled_active',
]);

function parseDateMs(value: unknown): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeEntitlementState(value: unknown): EntitlementState | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ENTITLEMENT_STATE_SET.has(normalized) ? normalized as EntitlementState : null;
}

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getEntitlementRecord(profile?: ProfileAccessState | null): EntitlementRecordLike | null {
  if (profile?.premiumEntitlement && typeof profile.premiumEntitlement === 'object') {
    return profile.premiumEntitlement;
  }
  return profile?.entitlement && typeof profile.entitlement === 'object' ? profile.entitlement : null;
}

export function getProfilePremiumUntil(profile?: ProfileAccessState | null): string | null {
  const entitlement = getEntitlementRecord(profile);
  const value = profile?.entitlementEndsAt
    ?? profile?.entitlement_ends_at
    ?? entitlement?.endsAt
    ?? entitlement?.ends_at
    ?? entitlement?.expiresAt
    ?? entitlement?.expires_at
    ?? profile?.premiumUntil
    ?? profile?.premium_until
    ?? null;
  return value ? String(value) : null;
}

export function resolveEntitlementState(
  profile?: ProfileAccessState | null,
  nowMs = Date.now(),
): EntitlementState {
  if (!profile) return 'free';

  const entitlement = getEntitlementRecord(profile);
  const explicitState = normalizeEntitlementState(
    profile.entitlementState ?? profile.entitlement_state ?? entitlement?.state,
  );
  const endsAtMs = parseDateMs(getProfilePremiumUntil(profile));

  // Once a canonical entitlement object exists, malformed or unknown state
  // must fail closed. Only the legacy top-level premiumUntil field may be
  // interpreted as a gift during migration.
  if (entitlement && !explicitState) return 'free';

  if (profile.isAdmin || profile.is_admin) {
    return explicitState && ACTIVE_ENTITLEMENT_STATES.has(explicitState) ? explicitState : 'gift';
  }

  if (explicitState === 'free' || explicitState === 'expired') return explicitState;
  if (explicitState && ACTIVE_ENTITLEMENT_STATES.has(explicitState)) {
    return endsAtMs !== null && endsAtMs > nowMs ? explicitState : 'expired';
  }

  const status = normalizeToken(
    profile.entitlementStatus ?? profile.entitlement_status ?? entitlement?.status,
  );
  const source = normalizeToken(
    profile.entitlementSource ?? profile.entitlement_source ?? entitlement?.source,
  );

  if (status === 'expired') return 'expired';
  if (status === 'cancelled' || status === 'canceled' || status === 'paused') {
    return endsAtMs !== null && endsAtMs > nowMs ? 'cancelled_active' : 'expired';
  }
  if (status === 'grace' || status === 'grace_period') {
    return endsAtMs !== null && endsAtMs > nowMs ? 'grace' : 'expired';
  }
  if (status === 'active') {
    if (endsAtMs === null || endsAtMs <= nowMs) return 'expired';
    if (source.includes('gift')) return 'gift';
    if (source.includes('trial')) return 'store_trial';
    return 'paid';
  }

  // premiumUntil predates store entitlements. It represents a legacy gift,
  // regardless of the deprecated trialStartedAt or client isPremium fields.
  if (endsAtMs !== null) return endsAtMs > nowMs ? 'gift' : 'expired';
  return 'free';
}

export function hasActivePremium(profile?: ProfileAccessState | null, nowMs = Date.now()): boolean {
  if (!profile) return false;
  if (profile.isAdmin || profile.is_admin) return true;
  return ACTIVE_ENTITLEMENT_STATES.has(resolveEntitlementState(profile, nowMs));
}

function toPositiveId(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function readChartData(input: unknown): NatalChartData | null {
  if (isReadableNatalChart(input)) return input;
  const state = input as ChartAccessState | null;
  if (isReadableNatalChart(state?.chartData)) return state.chartData;
  return null;
}

export function getFeatureAccessConfig(featureKey: FeatureKey): FeatureAccessConfig | null {
  return FEATURE_ACCESS_INDEX.get(featureKey) || null;
}

export function listFeatureAccessMatrix(): FeatureAccessConfig[] {
  return FEATURE_ACCESS_MATRIX.slice();
}

export function hasNatalChart(
  profileOrState?: (ProfileAccessState & ChartAccessState) | NatalChartData | null,
  chartState?: ChartAccessState | NatalChartData | null
): boolean {
  const states = [chartState, profileOrState].filter(Boolean);

  for (const state of states) {
    if (isReadableNatalChart(state)) return true;
    if (readChartData(state)) return true;
    const chartLike = state as ChartAccessState;
    if (toPositiveId(chartLike.primaryChartId) || toPositiveId(chartLike.chartId)) return true;
  }

  return false;
}

export function canAccessFeature(
  featureKey: FeatureKey,
  profile?: ProfileAccessState | null,
  chartState?: ChartAccessState | NatalChartData | null,
  nowMs = Date.now(),
): FeatureAccessResult {
  const config = getFeatureAccessConfig(featureKey);
  const premium = hasActivePremium(profile, nowMs);
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

  if (config.tier === 'premium' && !premium) {
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
