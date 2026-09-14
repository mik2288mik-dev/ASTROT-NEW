import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'analytics.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'analytics.view permission required' });
    }

    const pool = getPool();

    // 1. MyTracker traffic sources
    const myTrackerRes = await pool.query(`
      SELECT
        COALESCE(traffic_source, 'Не указан') AS source,
        COALESCE(campaign_title, 'Органический / Прямой') AS campaign,
        COUNT(DISTINCT m.user_id)::int AS users_count,
        COUNT(DISTINCT m.user_id) FILTER (WHERE u.is_premium)::int AS premium_users,
        COUNT(DISTINCT m.user_id) FILTER (WHERE u.last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_7d
      FROM mytracker_users m
      LEFT JOIN users u ON u.id = m.user_id
      GROUP BY 1, 2
      ORDER BY users_count DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    // 2. Auth provider breakdown
    const providersRes = await pool.query(`
      SELECT
        COALESCE(auth_provider, 'guest') AS provider,
        COUNT(*)::int AS users_count,
        COUNT(*) FILTER (WHERE is_premium)::int AS premium_users,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_7d
      FROM users
      GROUP BY 1
      ORDER BY users_count DESC
    `);

    const sources = myTrackerRes.rows.map((r) => {
      const users = Number(r.users_count || 0);
      const premium = Number(r.premium_users || 0);
      return {
        source: r.source,
        campaign: r.campaign,
        users,
        premiumUsers: premium,
        active7d: Number(r.active_7d || 0),
        conversionPct: users > 0 ? Math.round((premium / users) * 1000) / 10 : 0,
      };
    });

    const providers = providersRes.rows.map((r) => {
      const users = Number(r.users_count || 0);
      const premium = Number(r.premium_users || 0);
      return {
        provider: r.provider,
        users,
        premiumUsers: premium,
        active7d: Number(r.active_7d || 0),
        conversionPct: users > 0 ? Math.round((premium / users) * 1000) / 10 : 0,
      };
    });

    return res.status(200).json({
      sources,
      providers,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
