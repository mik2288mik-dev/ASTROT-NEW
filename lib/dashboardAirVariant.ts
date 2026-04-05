import type { DashboardAirVariant } from '../types';

export const DASHBOARD_AIR_DEFAULT: DashboardAirVariant = 'cloud-ribbon';

export const DASHBOARD_AIR_VARIANTS: DashboardAirVariant[] = [
  'cloud-ribbon',
  'aero-stack',
  'orbit-focus',
  'feather-cards',
  'pulse-air',
];

const DASHBOARD_AIR_ALIASES: Record<string, DashboardAirVariant> = {
  cloud: 'cloud-ribbon',
  ribbon: 'cloud-ribbon',
  'cloud-ribbon': 'cloud-ribbon',
  aero: 'aero-stack',
  stack: 'aero-stack',
  'aero-stack': 'aero-stack',
  orbit: 'orbit-focus',
  'orbit-focus': 'orbit-focus',
  feather: 'feather-cards',
  'feather-cards': 'feather-cards',
  pulse: 'pulse-air',
  'pulse-air': 'pulse-air',
};

export const normalizeDashboardAirVariant = (
  value?: string | null
): DashboardAirVariant | null => {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return DASHBOARD_AIR_ALIASES[key] ?? null;
};

export const resolveDashboardAirVariant = (params?: {
  profileVariant?: string | null;
  queryVariant?: string | null;
  envVariant?: string | null;
}): DashboardAirVariant => {
  const fromProfile = normalizeDashboardAirVariant(params?.profileVariant);
  if (fromProfile) return fromProfile;

  const fromQuery = normalizeDashboardAirVariant(params?.queryVariant);
  if (fromQuery) return fromQuery;

  const fromEnv = normalizeDashboardAirVariant(params?.envVariant);
  if (fromEnv) return fromEnv;

  return DASHBOARD_AIR_DEFAULT;
};
