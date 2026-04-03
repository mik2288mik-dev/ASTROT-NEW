/**
 * Premium activation - Lumia MVP
 *
 * Handles:
 * - Idempotent premium activation from Telegram Stars payment
 * - premium_until (7 days for 250 Stars)
 * - Optional premium_bonus Lumi (not defined in current spec - skipped)
 */

import { db } from '../lib/db';
import { addLumi } from './lumiService';
import { LUMI_REASONS } from './lumiService';

const log = {
  info: (msg: string, data?: any) => console.log(`[PremiumService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[PremiumService] ERROR: ${msg}`, err || ''),
};

const PREMIUM_DAYS = 7;

/** Premium bonus Lumi - not in spec, set to 0 to skip */
const PREMIUM_BONUS_LUMI = 0;

export interface ActivatePremiumResult {
  activated: boolean;
  alreadyHadPremium: boolean;
  premiumUntil: string;
  lumiBalance: number;
}

/**
 * Activate premium for user. Idempotent - duplicate charge_id does not double-grant.
 */
export async function activatePremium(
  userId: string,
  telegramPaymentChargeId: string,
  starsAmount: number
): Promise<ActivatePremiumResult> {
  if (!userId?.trim()) throw new Error('UserId is required');
  if (!telegramPaymentChargeId?.trim()) throw new Error('telegram_payment_charge_id is required');

  const id = String(userId).trim();

  const user = await db.users.get(id);
  if (!user) throw new Error('User not found');

  const now = new Date();
  const existingUntil = user.premium_until ? new Date(user.premium_until) : null;
  const baseDate = existingUntil && existingUntil > now ? existingUntil : now;
  const premiumUntil = new Date(baseDate.getTime() + PREMIUM_DAYS * 24 * 60 * 60 * 1000);

  const inserted = await db.star_payments.record(telegramPaymentChargeId, id, starsAmount);
  if (!inserted) {
    log.info('Duplicate payment ignored (DB race)', { telegramPaymentChargeId, userId });
    const current = await db.users.get(id);
    const pu = current?.premium_until ? new Date(current.premium_until) : null;
    return {
      activated: false,
      alreadyHadPremium: !!(pu && pu > new Date()),
      premiumUntil: pu?.toISOString() ?? '',
      lumiBalance: current?.lumi_balance ?? 0,
    };
  }

  await db.users.set(id, {
    premium_until: premiumUntil.toISOString(),
  });

  let lumiBalance = user.lumi_balance ?? 0;
  if (PREMIUM_BONUS_LUMI > 0) {
    const result = await addLumi(id, PREMIUM_BONUS_LUMI, LUMI_REASONS.premium_bonus);
    lumiBalance = result.balance;
    log.info('Premium bonus Lumi granted', { userId: id, amount: PREMIUM_BONUS_LUMI });
  }

  log.info('Premium activated', { userId: id, premiumUntil: premiumUntil.toISOString(), starsAmount });

  return {
    activated: true,
    alreadyHadPremium: false,
    premiumUntil: premiumUntil.toISOString(),
    lumiBalance,
  };
}
