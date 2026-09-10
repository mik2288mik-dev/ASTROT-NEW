import { db } from './db';
import { PREMIUM_PLANS, type PremiumPlan, type PremiumPlanId } from './premiumPricing';

export const PREMIUM_PLANS_SETTING_KEY = 'premium_plans_config';

export type ManagedPremiumPlan = PremiumPlan & {
  isActive: boolean;
  sortOrder: number;
  badge: string | null;
};

type RawPlanPatch = Partial<ManagedPremiumPlan> & Record<string, unknown>;

const PLAN_IDS: PremiumPlanId[] = ['premium_week', 'premium_month', 'premium_quarter', 'premium_year'];

const DEFAULT_SORT_ORDER: Record<PremiumPlanId, number> = {
  premium_week: 10,
  premium_month: 20,
  premium_quarter: 30,
  premium_year: 40,
};

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(1, Math.round(n)), max);
}

function nonNegativeNumber(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

function cleanText(value: unknown, fallback: string, max = 120): string {
  const s = String(value ?? '').trim();
  return (s || fallback).slice(0, max);
}

function cleanNullableText(value: unknown, max = 60): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

function parseStoredConfig(raw: string | null | undefined): Partial<Record<PremiumPlanId, RawPlanPatch>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed
          .filter((item) => item && typeof item === 'object' && PLAN_IDS.includes((item as any).id))
          .map((item) => [(item as any).id, item])
      ) as Partial<Record<PremiumPlanId, RawPlanPatch>>;
    }
    return parsed as Partial<Record<PremiumPlanId, RawPlanPatch>>;
  } catch {
    return {};
  }
}

export function normalizeManagedPremiumPlan(id: PremiumPlanId, patch?: RawPlanPatch | null): ManagedPremiumPlan {
  const fallback = PREMIUM_PLANS[id];
  const p = patch || {};
  return {
    id,
    days: positiveInt(p.days, fallback.days, 3650),
    stars: positiveInt(p.stars, fallback.stars, 1000000),
    priceRub: nonNegativeNumber(p.priceRub, fallback.priceRub, 10000000),
    priceUsd: nonNegativeNumber(p.priceUsd, fallback.priceUsd, 100000),
    label: cleanText(p.label, fallback.label, 120),
    isActive: p.isActive !== false,
    sortOrder: positiveInt(p.sortOrder, DEFAULT_SORT_ORDER[id], 10000),
    badge: cleanNullableText(p.badge, 60),
  };
}

export function defaultManagedPremiumPlans(): ManagedPremiumPlan[] {
  return PLAN_IDS.map((id) => normalizeManagedPremiumPlan(id));
}

export async function getManagedPremiumPlans(): Promise<ManagedPremiumPlan[]> {
  let stored: Partial<Record<PremiumPlanId, RawPlanPatch>> = {};
  try {
    const row = await db.app_settings.get(PREMIUM_PLANS_SETTING_KEY);
    stored = parseStoredConfig(row?.value);
  } catch {
    stored = {};
  }

  return PLAN_IDS
    .map((id) => normalizeManagedPremiumPlan(id, stored[id]))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getManagedPremiumPlan(id: string, options?: { includeInactive?: boolean }): Promise<ManagedPremiumPlan | null> {
  if (!PLAN_IDS.includes(id as PremiumPlanId)) return null;
  const plans = await getManagedPremiumPlans();
  const plan = plans.find((item) => item.id === id) || null;
  if (!plan) return null;
  if (!options?.includeInactive && !plan.isActive) return null;
  return plan;
}

export async function saveManagedPremiumPlans(input: unknown): Promise<ManagedPremiumPlan[]> {
  const raw = Array.isArray(input)
    ? Object.fromEntries(input.filter((item) => item && typeof item === 'object').map((item) => [(item as any).id, item]))
    : input && typeof input === 'object'
      ? input as Record<string, RawPlanPatch>
      : {};

  const normalized = PLAN_IDS.map((id) => normalizeManagedPremiumPlan(id, raw[id]));
  const stored = Object.fromEntries(normalized.map((plan) => [plan.id, plan]));
  await db.app_settings.set(PREMIUM_PLANS_SETTING_KEY, JSON.stringify(stored));
  return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
}
