/**
 * Premium activation for the MVP.
 *
 * Handles:
 * - Idempotent premium activation from Telegram Stars payment
 * - premium_until (${PREMIUM_WEEK_DAYS} days for Premium week via Telegram Stars)
 */

import { getPool } from '../lib/db';
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

  const days = Number.isFinite(options?.durationDays) && (options?.durationDays ?? 0) > 0
    ? Math.round(options!.durationDays!)
    : PREMIUM_WEEK_DAYS;
  const paymentType = options?.paymentType ?? 'premium_week';
  const client = await getPool().connect();
  let inserted = false;
  let alreadyHadPremium = false;
  let premiumUntil = new Date(0);
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT premium_until FROM users WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!userResult.rows[0]) throw new Error('User not found');
    const now = new Date();
    const existingUntil = userResult.rows[0].premium_until
      ? new Date(userResult.rows[0].premium_until)
      : null;
    alreadyHadPremium = !!(existingUntil && existingUntil > now);
    const baseDate = alreadyHadPremium ? existingUntil! : now;
    const proposedUntil = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const paymentInsert = await client.query(
      `INSERT INTO star_payments (
         telegram_payment_charge_id, user_id, stars_amount, payment_type, payload_json, status
       ) VALUES ($1, $2, $3, $4, $5::jsonb, 'confirmed')
       ON CONFLICT (telegram_payment_charge_id) DO NOTHING
       RETURNING payload_json`,
      [
        telegramPaymentChargeId,
        id,
        starsAmount,
        paymentType,
        JSON.stringify({
          ...(options?.payloadJson ?? {}),
          entitlementEndsAt: proposedUntil.toISOString(),
        }),
      ],
    );
    inserted = paymentInsert.rowCount === 1;
    const payment = inserted
      ? paymentInsert.rows[0]
      : (await client.query(
          `SELECT user_id, status, refunded_at, created_at, payload_json
           FROM star_payments WHERE telegram_payment_charge_id = $1 FOR UPDATE`,
          [telegramPaymentChargeId],
        )).rows[0];
    if (!payment || String(payment.user_id || id) !== id) {
      throw new Error('Payment belongs to another user');
    }
    if (payment.refunded_at || ['failed', 'refunded'].includes(String(payment.status || '').toLowerCase())) {
      throw new Error('Payment is not eligible for Premium');
    }
    const persistedEnd = payment.payload_json?.entitlementEndsAt
      ? new Date(payment.payload_json.entitlementEndsAt)
      : null;
    const originalPaymentAt = payment.created_at ? new Date(payment.created_at) : null;
    const legacyAnchoredEnd = originalPaymentAt && Number.isFinite(originalPaymentAt.getTime())
      ? new Date(originalPaymentAt.getTime() + days * 24 * 60 * 60 * 1000)
      : null;
    if (persistedEnd && Number.isFinite(persistedEnd.getTime())) {
      premiumUntil = persistedEnd;
    } else if (!inserted && legacyAnchoredEnd) {
      // Old rows predate entitlementEndsAt. Never anchor a replay to retry-time:
      // doing so would resurrect the same payment after every expiry.
      premiumUntil = legacyAnchoredEnd;
    } else if (inserted) {
      premiumUntil = proposedUntil;
    } else {
      throw new Error('Duplicate payment has no immutable entitlement period');
    }
    const entitlementIsActive = premiumUntil > now;

    await client.query(
      `UPDATE users
       SET premium_until = CASE
         WHEN premium_until IS NULL OR premium_until < $2 THEN $2
         ELSE premium_until
       END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, premiumUntil.toISOString()],
    );
    await client.query(
      `INSERT INTO premium_entitlements (
         user_id, tier_name, status, entitlement_state, source, starts_at, ends_at, metadata
       ) VALUES ($1, 'premium', $3, $4, 'telegram_stars', CURRENT_TIMESTAMP, $2, $5::jsonb)
        ON CONFLICT (user_id, tier_name, ends_at, source) DO UPDATE
         SET status = EXCLUDED.status, entitlement_state = EXCLUDED.entitlement_state,
             metadata = EXCLUDED.metadata,
             updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        premiumUntil.toISOString(),
        entitlementIsActive ? 'active' : 'expired',
        entitlementIsActive ? 'paid' : 'expired',
        JSON.stringify({ provider: 'telegram_stars', paymentType }),
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (!inserted) {
    log.info('Duplicate payment converged to canonical entitlement', { telegramPaymentChargeId, userId });
  }

  log.info('Premium activated', { userId: id, premiumUntil: premiumUntil.toISOString(), starsAmount });

  return {
    activated: inserted,
    alreadyHadPremium,
    premiumUntil: premiumUntil.toISOString(),
  };
}
