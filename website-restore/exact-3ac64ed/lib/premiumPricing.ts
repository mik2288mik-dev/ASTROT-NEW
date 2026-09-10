function readPremiumWeekStars() {
  const raw =
    process.env.PREMIUM_WEEK_STARS ||
    process.env.NEXT_PUBLIC_PREMIUM_WEEK_STARS;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

/** Telegram Stars price for one week of Premium. */
export const PREMIUM_WEEK_STARS = readPremiumWeekStars();
export const PREMIUM_WEEK_DAYS = 7;

export type PremiumPlanId = 'premium_week' | 'premium_month' | 'premium_quarter' | 'premium_year';

export type PremiumPlan = {
  id: PremiumPlanId;
  days: number;
  /** Charge in Telegram Stars (XTR) — the real pay rail. */
  stars: number;
  /** Display price for RU. */
  priceRub: number;
  /** Display price for EN ($). */
  priceUsd: number;
  /** Invoice label. */
  label: string;
};

/**
 * Тарифы. Оплата в Telegram Stars (XTR). Цены ₽/$ — для показа, реально списываются звёзды.
 * Звёздные суммы можно переопределить через env (PREMIUM_*_STARS).
 */
function starsFor(envKey: string, fallback: number): number {
  const parsed = Number.parseInt(String(process.env[envKey] || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const PREMIUM_PLANS: Record<PremiumPlanId, PremiumPlan> = {
  premium_week: { id: 'premium_week', days: PREMIUM_WEEK_DAYS, stars: PREMIUM_WEEK_STARS, priceRub: 149, priceUsd: 1.99, label: 'Premium · 1 week' },
  premium_month: { id: 'premium_month', days: 30, stars: starsFor('PREMIUM_MONTH_STARS', 299), priceRub: 399, priceUsd: 4.99, label: 'Premium · 1 month' },
  premium_quarter: { id: 'premium_quarter', days: 90, stars: starsFor('PREMIUM_QUARTER_STARS', 599), priceRub: 899, priceUsd: 9.99, label: 'Premium · 3 months' },
  premium_year: { id: 'premium_year', days: 365, stars: starsFor('PREMIUM_YEAR_STARS', 1990), priceRub: 2999, priceUsd: 32.99, label: 'Premium · 1 year' },
};

export function getPremiumPlan(id: string): PremiumPlan | null {
  return (PREMIUM_PLANS as Record<string, PremiumPlan>)[id] || null;
}
