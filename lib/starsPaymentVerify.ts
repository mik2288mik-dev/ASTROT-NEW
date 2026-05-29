import type { ContentSurface, ContentVariant } from '../types';

export type StarPaymentRecord = {
  id: number;
  telegram_payment_charge_id: string;
  user_id: string;
  stars_amount: number;
  payment_type: string | null;
  content_surface: string | null;
  content_variant: string | null;
  chart_id: number | null;
  cache_key: string | null;
  payload_json: Record<string, unknown>;
  consumed_at: string | null;
  consumed_by_unlock_id: number | null;
  status: string;
};

export type VerifyStarsPaymentOptions = {
  userId: string;
  telegramPaymentChargeId: string;
  starsAmount: number;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  chartId?: number | null;
  cacheKey?: string;
  allowUnscopedCacheKey?: boolean;
};

export type VerifyStarsPaymentResult =
  | {
      ok: true;
      payment: StarPaymentRecord;
      alreadyConsumed: boolean;
    }
  | {
      ok: false;
      code: string;
    };

function normalizeUserId(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

export function verifyStarPaymentForUnlock(
  payment: StarPaymentRecord | null,
  options: VerifyStarsPaymentOptions
): VerifyStarsPaymentResult {
  const chargeId = String(options.telegramPaymentChargeId || '').trim();
  if (!chargeId) {
    return { ok: false, code: 'STARS_PAYMENT_CHARGE_ID_REQUIRED' };
  }

  if (!payment) {
    return { ok: false, code: 'STARS_PAYMENT_NOT_FOUND' };
  }

  if (payment.telegram_payment_charge_id !== chargeId) {
    return { ok: false, code: 'STARS_PAYMENT_NOT_FOUND' };
  }

  if (normalizeUserId(payment.user_id) !== normalizeUserId(options.userId)) {
    return { ok: false, code: 'STARS_PAYMENT_USER_MISMATCH' };
  }

  if (payment.status !== 'confirmed') {
    return { ok: false, code: 'STARS_PAYMENT_NOT_CONFIRMED' };
  }

  if (Number(payment.stars_amount) !== Number(options.starsAmount)) {
    return { ok: false, code: 'STARS_PAYMENT_AMOUNT_MISMATCH' };
  }

  if (payment.payment_type && payment.payment_type !== 'content_unlock') {
    return { ok: false, code: 'STARS_PAYMENT_TYPE_MISMATCH' };
  }

  if (payment.content_surface && payment.content_surface !== options.contentSurface) {
    return { ok: false, code: 'STARS_PAYMENT_CONTENT_MISMATCH' };
  }

  if (payment.content_variant && payment.content_variant !== options.contentVariant) {
    return { ok: false, code: 'STARS_PAYMENT_CONTENT_MISMATCH' };
  }

  if (payment.cache_key) {
    if (!options.cacheKey || payment.cache_key !== options.cacheKey) {
      return { ok: false, code: 'STARS_PAYMENT_CONTENT_MISMATCH' };
    }
  } else if (!options.allowUnscopedCacheKey && options.cacheKey) {
    return { ok: false, code: 'STARS_PAYMENT_CONTENT_MISMATCH' };
  }

  if (options.chartId != null && payment.chart_id != null && Number(payment.chart_id) !== Number(options.chartId)) {
    return { ok: false, code: 'STARS_PAYMENT_CONTENT_MISMATCH' };
  }

  const alreadyConsumed = !!payment.consumed_at;
  if (alreadyConsumed && !payment.consumed_by_unlock_id) {
    return { ok: false, code: 'STARS_PAYMENT_ALREADY_CONSUMED' };
  }

  return {
    ok: true,
    payment,
    alreadyConsumed,
  };
}
