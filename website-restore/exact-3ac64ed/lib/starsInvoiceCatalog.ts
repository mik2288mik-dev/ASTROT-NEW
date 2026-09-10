import { PREMIUM_WEEK_DAYS, PREMIUM_WEEK_STARS, PREMIUM_PLANS, getPremiumPlan, type PremiumPlan, type PremiumPlanId } from './premiumPricing';

export { PREMIUM_WEEK_STARS, PREMIUM_WEEK_DAYS };

export type StarsInvoiceType = PremiumPlanId;

export type ParsedStarsInvoicePayload = {
  userId: string;
  type: StarsInvoiceType;
  starsAmount: number;
  durationDays: number | null;
  nonce: string | null;
  raw: Record<string, unknown>;
};

const TYPE_ALIASES: Record<string, StarsInvoiceType> = {
  pw: 'premium_week',
  premium_week: 'premium_week',
  premium_month: 'premium_month',
  premium_quarter: 'premium_quarter',
  premium_year: 'premium_year',
};

export function getStarsAmountForInvoiceType(type: StarsInvoiceType): number {
  return getPremiumPlan(type)?.stars ?? 0;
}

export function parseInvoicePayload(rawPayload: string): ParsedStarsInvoicePayload | null {
  try {
    const raw = JSON.parse(rawPayload) as Record<string, unknown>;
    const userId = String(raw.u ?? raw.userId ?? '').trim();
    const typeRaw = String(raw.t ?? raw.type ?? '').trim();
    const type = TYPE_ALIASES[typeRaw];
    if (!userId || !type) return null;

    const amountRaw = raw.a ?? raw.starsAmount;
    const starsAmount = Number(amountRaw ?? getStarsAmountForInvoiceType(type));
    const durationDaysRaw = raw.d ?? raw.durationDays;
    const parsedDurationDays = durationDaysRaw != null ? Number(durationDaysRaw) : NaN;

    return {
      userId,
      type,
      starsAmount,
      durationDays: Number.isFinite(parsedDurationDays) && parsedDurationDays > 0 ? Math.round(parsedDurationDays) : null,
      nonce: raw.n != null ? String(raw.n) : raw.nonce != null ? String(raw.nonce) : null,
      raw,
    };
  } catch {
    return null;
  }
}

export type BuildInvoiceInput = {
  userId: string;
  type: StarsInvoiceType;
};

export function buildInvoicePayload(input: BuildInvoiceInput): {
  payload: Record<string, unknown>;
  starsAmount: number;
  title: string;
  description: string;
  label: string;
} {
  const plan = getPremiumPlan(input.type) || PREMIUM_PLANS.premium_week;
  return buildInvoicePayloadForPlan(input, plan);
}

export function buildInvoicePayloadForPlan(input: BuildInvoiceInput, plan: PremiumPlan): {
  payload: Record<string, unknown>;
  starsAmount: number;
  title: string;
  description: string;
  label: string;
} {
  const userId = String(input.userId).trim();
  const type = input.type;
  const starsAmount = plan.stars;

  const payload: Record<string, unknown> = {
    u: userId,
    t: type,
    a: starsAmount,
    d: plan.days,
    n: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  if (serialized.length > 128) {
    throw new Error('PAYLOAD_TOO_LONG');
  }

  const productCopy = getInvoiceCopy(plan);

  return {
    payload,
    starsAmount,
    ...productCopy,
  };
}

function getInvoiceCopy(plan: PremiumPlan) {
  return {
    title: 'Premium',
    description: `Full access for ${plan.days} days`,
    label: plan.label,
  };
}
