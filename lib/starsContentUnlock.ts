import type { ContentSurface, ContentVariant } from '../types';
import { unlockContentLayer } from './contentArchitecture';
import { db } from './db';

export async function recordStarsPaymentIfNew(
  userId: string,
  starsPaymentChargeId: string,
  starsAmount: number
) {
  const chargeId = String(starsPaymentChargeId || '').trim();
  if (!chargeId) {
    throw new Error('STARS_PAYMENT_CHARGE_ID_REQUIRED');
  }
  const alreadyUsed = await db.star_payments.exists(chargeId);
  if (alreadyUsed) {
    return { recorded: false, chargeId };
  }
  const recorded = await db.star_payments.record(chargeId, userId, starsAmount);
  return { recorded, chargeId };
}

export async function unlockContentAfterStarsPayment(options: {
  userId: string;
  chartId?: number | null;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
  starsAmount: number;
  starsPaymentChargeId: string;
}) {
  await recordStarsPaymentIfNew(options.userId, options.starsPaymentChargeId, options.starsAmount);
  return unlockContentLayer({
    userId: options.userId,
    chartId: options.chartId,
    accessTier: 'stars',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    cacheKey: options.cacheKey,
    starsAmount: options.starsAmount,
    starsPaymentChargeId: options.starsPaymentChargeId,
  });
}
