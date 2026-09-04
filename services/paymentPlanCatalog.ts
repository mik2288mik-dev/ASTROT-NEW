import type { PremiumPlanId } from '../lib/premiumPricing';
import { apiFetch } from './apiClient';

export type TelegramPremiumCatalogPlan = {
  id: PremiumPlanId;
  days: number;
  stars: number;
};

const PREMIUM_PLAN_IDS = new Set<PremiumPlanId>([
  'premium_week',
  'premium_month',
  'premium_quarter',
  'premium_year',
]);

export const TELEGRAM_PLAN_CATALOG_TIMEOUT_MS = 9_000;

export async function loadTelegramPremiumPlans(): Promise<TelegramPremiumCatalogPlan[]> {
  const response = await apiFetch(
    '/api/subscriptions/plans',
    { method: 'GET' },
    TELEGRAM_PLAN_CATALOG_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error('TELEGRAM_PLAN_CATALOG_UNAVAILABLE');
  const payload = await response.json().catch(() => ({}));
  if (!Array.isArray(payload?.plans)) throw new Error('TELEGRAM_PLAN_CATALOG_INVALID');

  return payload.plans.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const value = raw as Record<string, unknown>;
    const id = String(value.id || '') as PremiumPlanId;
    const days = Number(value.days);
    const stars = Number(value.stars);
    if (!PREMIUM_PLAN_IDS.has(id)
      || !Number.isInteger(days)
      || days <= 0
      || !Number.isInteger(stars)
      || stars <= 0) return [];
    return [{ id, days, stars }];
  });
}
