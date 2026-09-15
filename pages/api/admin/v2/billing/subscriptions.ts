import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Подписки/триалы из users и канонических entitlement-записей. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'billing.view');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const pool = getPool();
    const base = `WITH subscriptions AS (
      SELECT u.id, u.name, u.trial_started_at,
             GREATEST(u.premium_until, MAX(pe.ends_at)) AS premium_until,
             COALESCE(
               (ARRAY_AGG(pe.source ORDER BY pe.ends_at DESC) FILTER (WHERE pe.ends_at IS NOT NULL))[1],
               CASE WHEN u.premium_until IS NOT NULL THEN 'users.premium_until' END
             ) AS premium_source,
             COALESCE(u.platform, 'telegram') AS platform,
             COALESCE(u.auth_provider, 'telegram') AS auth_provider
      FROM users u
      LEFT JOIN premium_entitlements pe ON pe.user_id = u.id
        AND pe.status = 'active' AND pe.ends_at > NOW()
      GROUP BY u.id
    )`;
    const where = `WHERE premium_until IS NOT NULL OR trial_started_at IS NOT NULL`;
    const [countRes, rowsRes] = await Promise.all([
      pool.query(`${base} SELECT COUNT(*)::int AS total FROM subscriptions ${where}`),
      pool.query(
        `${base} SELECT * FROM subscriptions ${where}
           ORDER BY premium_until DESC NULLS LAST, trial_started_at DESC NULLS LAST
           LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ]);

    const now = Date.now();
    const total = Number(countRes.rows[0]?.total || 0);
    return res.status(200).json({
      subscriptions: rowsRes.rows.map((r: any) => {
        const until = r.premium_until ? new Date(r.premium_until).getTime() : 0;
        const status = until > now ? 'active' : (r.trial_started_at && !r.premium_until ? 'trial' : 'expired');
        return {
          userId: String(r.id),
          name: r.name || null,
          plan: 'premium',
          status,
          provider: r.premium_source === 'rustore'
            ? 'rustore'
            : (r.auth_provider === 'telegram' ? 'telegram_stars' : r.auth_provider),
          platform: r.platform,
          premiumUntil: r.premium_until ? new Date(r.premium_until).toISOString() : null,
          trialStartedAt: r.trial_started_at ? new Date(r.trial_started_at).toISOString() : null,
        };
      }),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
