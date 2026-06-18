/**
 * Premium activation - Lumia MVP
 *
 * Handles:
 * - Idempotent premium activation from Telegram Stars payment
 * - premium_until (${PREMIUM_WEEK_DAYS} days for Premium week via Telegram Stars)
 */

import { db } from '../lib/db';
import { PREMIUM_WEEK_DAYS } from '../lib/premiumPricing';

const log = {
  info: (msg: string, data?: any) => console.log(`[PremiumService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[PremiumService] ERROR: ${msg}`, err || ''),
};

export interface ActivatePremiumResult {
  activated: boolean;
  alreadyHadPremium: boolean;
  premiumUntil: string;
}

/**
 * Activate premium for user. Idempotent - duplicate charge_id does not double-grant.
 */
export async function activatePremium(
  userId: string,
  telegramPaymentChargeId: string,
  starsAmount: number,
  options?: {
    paymentType?: string | null;
    payloadJson?: Record<string, unknown>;
    durationDays?: number;
  }
): Promise<ActivatePremiumResult> {
  if (!userId?.trim()) throw new Error('UserId is required');
  if (!telegramPaymentChargeId?.trim()) throw new Error('telegram_payment_charge_id is required');

  const id = String(userId).trim();

  const user = await db.users.get(id);
  if (!user) throw new Error('User not found');

  const days = Number.isFinite(options?.durationDays) && (options?.durationDays ?? 0) > 0
    ? Math.round(options!.durationDays!)
    : PREMIUM_WEEK_DAYS;
  const now = new Date();
  const existingUntil = user.premium_until ? new Date(user.premium_until) : null;
  const baseDate = existingUntil && existingUntil > now ? existingUntil : now;
  const premiumUntil = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  const inserted = await db.star_payments.recordFromWebhook({
    telegramPaymentChargeId,
    userId: id,
    starsAmount,
    paymentType: options?.paymentType ?? 'premium_week',
    payloadJson: options?.payloadJson ?? {},
    status: 'confirmed',
  });
  if (!inserted.inserted) {
    log.info('Duplicate payment ignored (DB race)', { telegramPaymentChargeId, userId });
    const current = await db.users.get(id);
    const pu = current?.premium_until ? new Date(current.premium_until) : null;
    return {
      activated: false,
      alreadyHadPremium: !!(pu && pu > new Date()),
      premiumUntil: pu?.toISOString() ?? '',
    };
  }

  await db.users.set(id, {
    premium_until: premiumUntil.toISOString(),
  });

  log.info('Premium activated', { userId: id, premiumUntil: premiumUntil.toISOString(), starsAmount });

  return {
    activated: true,
    alreadyHadPremium: false,
    premiumUntil: premiumUntil.toISOString(),
  };
}
