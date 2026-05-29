import type { ContentSurface, ContentVariant } from '../types';
import { unlockContentLayer } from './contentArchitecture';
import { db } from './db';
import {
  verifyStarPaymentForUnlock,
  type VerifyStarsPaymentOptions,
} from './starsPaymentVerify';

export class StarsPaymentError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export async function verifyStarsPaymentForUnlock(
  options: VerifyStarsPaymentOptions
) {
  const chargeId = String(options.telegramPaymentChargeId || '').trim();
  if (!chargeId) {
    throw new StarsPaymentError('STARS_PAYMENT_CHARGE_ID_REQUIRED');
  }

  const payment = await db.star_payments.getByChargeId(chargeId);
  const result = verifyStarPaymentForUnlock(payment, options);
  if (!result.ok) {
    throw new StarsPaymentError(result.code);
  }

  if (result.alreadyConsumed) {
    const unlockId = result.payment.consumed_by_unlock_id;
    if (unlockId) {
      const unlock = await db.content_unlocks.getById(unlockId);
      if (unlock) {
        const sameTarget =
          unlock.contentSurface === options.contentSurface &&
          unlock.contentVariant === options.contentVariant &&
          (options.cacheKey ? unlock.cacheKey === options.cacheKey : true);
        if (sameTarget) {
          return { payment: result.payment, alreadyConsumed: true, unlock };
        }
      }
    }
    throw new StarsPaymentError('STARS_PAYMENT_ALREADY_CONSUMED');
  }

  return { payment: result.payment, alreadyConsumed: false, unlock: null };
}

export async function consumeStarsPaymentForUnlock(paymentId: number, unlockId: number) {
  const consumed = await db.star_payments.markConsumed(paymentId, unlockId);
  if (!consumed) {
    throw new StarsPaymentError('STARS_PAYMENT_ALREADY_CONSUMED');
  }
}

async function unlockContentAfterVerifiedPayment(
  verified: Awaited<ReturnType<typeof verifyStarsPaymentForUnlock>>,
  options: {
    userId: string;
    chartId?: number | null;
    contentSurface: ContentSurface;
    contentVariant: ContentVariant;
    cacheKey?: string;
    starsAmount: number;
    starsPaymentChargeId: string;
  }
) {
  if (verified.alreadyConsumed && verified.unlock) {
    return {
      unlock: verified.unlock,
      chartId: verified.unlock.chartId,
      cacheKey: verified.unlock.cacheKey || options.cacheKey || '',
      via: 'stars' as const,
    };
  }

  const existing = await db.content_unlocks.getLatestActive(options.userId, {
    accessTier: 'stars',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    chartId: options.chartId ?? null,
    cacheKey: options.cacheKey,
  });
  if (existing) {
    await consumeStarsPaymentForUnlock(verified.payment.id, existing.id);
    return {
      unlock: existing,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey || options.cacheKey || '',
      via: 'stars' as const,
    };
  }

  const unlockResult = await unlockContentLayer({
    userId: options.userId,
    chartId: options.chartId,
    accessTier: 'stars',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    cacheKey: options.cacheKey,
    starsAmount: options.starsAmount,
    starsPaymentChargeId: options.starsPaymentChargeId,
    paymentVerified: true,
  });

  if (unlockResult.unlock?.id) {
    await consumeStarsPaymentForUnlock(verified.payment.id, unlockResult.unlock.id);
  }

  return unlockResult;
}

export async function unlockContentAfterStarsPaymentNonce(options: {
  userId: string;
  chartId?: number | null;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
  starsAmount: number;
  paymentNonce: string;
  allowUnscopedCacheKey?: boolean;
}) {
  const paymentNonce = String(options.paymentNonce || '').trim();
  if (!paymentNonce) {
    throw new StarsPaymentError('STARS_PAYMENT_NONCE_REQUIRED');
  }

  const payment = await db.star_payments.findConfirmedUnconsumedForPayload({
    userId: options.userId,
    paymentType: 'content_unlock',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    starsAmount: options.starsAmount,
    nonce: paymentNonce,
    cacheKey: options.cacheKey ?? null,
  });

  if (!payment) {
    throw new StarsPaymentError('STARS_PAYMENT_PENDING');
  }

  const result = verifyStarPaymentForUnlock(payment, {
    userId: options.userId,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    starsAmount: options.starsAmount,
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    chartId: options.chartId,
    cacheKey: options.cacheKey,
    allowUnscopedCacheKey: options.allowUnscopedCacheKey,
  });

  if (!result.ok) {
    throw new StarsPaymentError(result.code);
  }

  if (result.alreadyConsumed) {
    const unlockId = result.payment.consumed_by_unlock_id;
    if (unlockId) {
      const unlock = await db.content_unlocks.getById(unlockId);
      if (unlock) {
        const sameTarget =
          unlock.contentSurface === options.contentSurface &&
          unlock.contentVariant === options.contentVariant &&
          (options.cacheKey ? unlock.cacheKey === options.cacheKey : true);
        if (sameTarget) {
          return {
            unlock,
            chartId: unlock.chartId,
            cacheKey: unlock.cacheKey || options.cacheKey || '',
            via: 'stars' as const,
          };
        }
      }
    }
    throw new StarsPaymentError('STARS_PAYMENT_ALREADY_CONSUMED');
  }

  return unlockContentAfterVerifiedPayment(
    { payment: result.payment, alreadyConsumed: false, unlock: null },
    {
      userId: options.userId,
      chartId: options.chartId,
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      cacheKey: options.cacheKey,
      starsAmount: options.starsAmount,
      starsPaymentChargeId: payment.telegram_payment_charge_id,
    }
  );
}

export async function unlockContentAfterStarsPayment(options: {
  userId: string;
  chartId?: number | null;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
  starsAmount: number;
  starsPaymentChargeId: string;
  allowUnscopedCacheKey?: boolean;
}) {
  const verified = await verifyStarsPaymentForUnlock({
    userId: options.userId,
    telegramPaymentChargeId: options.starsPaymentChargeId,
    starsAmount: options.starsAmount,
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    chartId: options.chartId,
    cacheKey: options.cacheKey,
    allowUnscopedCacheKey: options.allowUnscopedCacheKey,
  });

  return unlockContentAfterVerifiedPayment(verified, options);
}

/** @deprecated Client-supplied charge ids must never create payments. Use unlockContentAfterStarsPayment. */
export async function recordStarsPaymentIfNew() {
  throw new StarsPaymentError('STARS_PAYMENT_RECORD_FORBIDDEN');
}
