import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Сводка по доходу (Telegram Stars + подписки). Право billing.view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'billing.view');
    const pool = getPool();
    const [rev, store, subs] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(stars_amount), 0)::bigint AS total_stars,
          COUNT(*)::int AS total_payments,
          COALESCE(SUM(stars_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS stars_30d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS payments_30d,
          COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunds,
          COALESCE(SUM(stars_amount) FILTER (WHERE status = 'refunded'), 0)::bigint AS refunded_stars
        FROM star_payments`).catch(() => ({ rows: [{}] })),
      pool.query(`SELECT
          COUNT(*) FILTER (WHERE status IN ('store_trial', 'paid', 'grace', 'cancelled_active'))::int AS total_purchases,
          COUNT(*) FILTER (WHERE status IN ('store_trial', 'paid', 'grace', 'cancelled_active')
            AND COALESCE(purchased_at, created_at) >= NOW() - INTERVAL '30 days')::int AS purchases_30d
        FROM store_purchases`).catch(() => ({ rows: [{}] })),
      pool.query(`
        SELECT
          COUNT(DISTINCT id)::int AS active_premium,
          COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL AND (premium_until IS NULL OR premium_until <= NOW()))::int AS trials
        FROM (
          SELECT u.id, u.trial_started_at,
                 GREATEST(u.premium_until, MAX(pe.ends_at)) AS premium_until
          FROM users u
          LEFT JOIN premium_entitlements pe ON pe.user_id = u.id
            AND pe.status = 'active' AND pe.ends_at > NOW()
          GROUP BY u.id
        ) premium_users
        `),
    ]);
    const r = rev.rows[0] || {};
    const storeRow = store.rows[0] || {};
    const s = subs.rows[0] || {};
    return res.status(200).json({
      totalStars: Number(r.total_stars || 0),
      totalPayments: Number(r.total_payments || 0) + Number(storeRow.total_purchases || 0),
      stars30d: Number(r.stars_30d || 0),
      payments30d: Number(r.payments_30d || 0) + Number(storeRow.purchases_30d || 0),
      rustorePurchases: Number(storeRow.total_purchases || 0),
      rustorePurchases30d: Number(storeRow.purchases_30d || 0),
      refunds: Number(r.refunds || 0),
      refundedStars: Number(r.refunded_stars || 0),
      activePremium: Number(s.active_premium || 0),
      trials: Number(s.trials || 0),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
