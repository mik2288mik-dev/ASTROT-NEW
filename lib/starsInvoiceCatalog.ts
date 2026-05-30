import { PREMIUM_WEEK_DAYS, PREMIUM_WEEK_STARS } from './premiumPricing';

export { PREMIUM_WEEK_STARS, PREMIUM_WEEK_DAYS };

export type StarsInvoiceType = 'premium_week';

export type ParsedStarsInvoicePayload = {
  userId: string;
  type: StarsInvoiceType;
  starsAmount: number;
  nonce: string | null;
  raw: Record<string, unknown>;
};

const TYPE_ALIASES: Record<string, StarsInvoiceType> = {
  pw: 'premium_week',
  premium_week: 'premium_week',
};

export function getStarsAmountForInvoiceType(type: StarsInvoiceType): number {
  if (type === 'premium_week') return PREMIUM_WEEK_STARS;
  return 0;
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

    return {
      userId,
      type,
      starsAmount,
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
  const userId = String(input.userId).trim();
  const type = input.type;
  const starsAmount = getStarsAmountForInvoiceType(type);

  const payload: Record<string, unknown> = {
    u: userId,
    t: type,
    a: starsAmount,
    n: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  if (serialized.length > 128) {
    throw new Error('PAYLOAD_TOO_LONG');
  }

  const productCopy = getInvoiceCopy(type);

  return {
    payload,
    starsAmount,
    ...productCopy,
  };
}

function getInvoiceCopy(type: StarsInvoiceType) {
  switch (type) {
    case 'premium_week':
      return {
        title: 'Lumia Premium',
        description: `Full access for ${PREMIUM_WEEK_DAYS} days`,
        label: 'Premium 1 Week',
      };
    default:
      return {
        title: 'Lumia Premium',
        description: `Full access for ${PREMIUM_WEEK_DAYS} days`,
        label: 'Premium 1 Week',
      };
  }
}
