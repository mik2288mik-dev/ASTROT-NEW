import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { INTERACTIVE_EVENT_TYPES } from '../../../../../lib/admin/activityAnalytics';
import { getPool } from '../../../../../lib/db';

/** Daily operational series backed only by production event/payment/error ledgers. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const result = await getPool().query(`
      WITH dates AS (
        SELECT generate_series(
          (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::date - ($1::int - 1),
          (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Moscow')::date,
          INTERVAL '1 day'
        )::date AS day
      ), activity AS (
        SELECT ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date AS day,
               COUNT(DISTINCT user_id)::int AS active_users
        FROM user_app_events
        WHERE event_type = ANY($2::text[])
          AND occurred_at >= (NOW() AT TIME ZONE 'UTC') - ($1::int * INTERVAL '1 day')
        GROUP BY 1
      ), stars AS (
        SELECT ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date AS day,
               COALESCE(SUM(stars_amount), 0)::bigint AS stars,
               COUNT(*)::int AS star_purchases
        FROM star_payments
        WHERE created_at >= (NOW() AT TIME ZONE 'UTC') - ($1::int * INTERVAL '1 day')
          AND COALESCE(status, 'completed') <> 'refunded'
        GROUP BY 1
      ), rustore AS (
        SELECT (COALESCE(purchased_at, created_at) AT TIME ZONE 'Europe/Moscow')::date AS day,
               COUNT(*)::int AS rustore_purchases
        FROM store_purchases
        WHERE COALESCE(purchased_at, created_at) >= NOW() - ($1::int * INTERVAL '1 day')
          AND status IN ('store_trial', 'paid', 'grace', 'cancelled_active')
        GROUP BY 1
      ), errors AS (
        SELECT (last_seen_at AT TIME ZONE 'Europe/Moscow')::date AS day,
               COALESCE(SUM(occurrences_count), 0)::int AS errors
        FROM app_technical_errors
        WHERE last_seen_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY 1
      )
      SELECT dates.day,
             COALESCE(activity.active_users, 0)::int AS active_users,
             COALESCE(stars.stars, 0)::int AS stars,
             COALESCE(stars.star_purchases, 0)::int AS star_purchases,
             COALESCE(rustore.rustore_purchases, 0)::int AS rustore_purchases,
             COALESCE(errors.errors, 0)::int AS errors
      FROM dates
      LEFT JOIN activity USING (day)
      LEFT JOIN stars USING (day)
      LEFT JOIN rustore USING (day)
      LEFT JOIN errors USING (day)
      ORDER BY dates.day ASC
    `, [days, INTERACTIVE_EVENT_TYPES]);
    return res.status(200).json({
      days,
      timezone: 'Europe/Moscow',
      points: result.rows.map((row) => ({
        date: new Date(`${row.day.toISOString?.().slice(0, 10) || String(row.day).slice(0, 10)}T00:00:00+03:00`).toISOString(),
        activeUsers: Number(row.active_users || 0),
        stars: Number(row.stars || 0),
        starPurchases: Number(row.star_purchases || 0),
        rustorePurchases: Number(row.rustore_purchases || 0),
        errors: Number(row.errors || 0),
      })),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
