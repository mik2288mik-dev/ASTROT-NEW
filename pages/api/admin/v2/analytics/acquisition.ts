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

    // 1. First-touch acquisition: MyTracker when available, otherwise the
    // first observed runtime/distribution channel. This keeps Telegram/web
    // users visible instead of silently dropping everyone without an SDK callback.
    const myTrackerRes = await pool.query(`
      WITH first_login AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          NULLIF(payload_json->>'distributionChannel', '') AS distribution_channel,
          NULLIF(payload_json->>'runtime', '') AS runtime
        FROM nebo_ops_outbox
        WHERE event_type = 'login' AND user_id IS NOT NULL
        ORDER BY user_id, occurred_at ASC, id ASC
      ), premium AS (
        SELECT user_id, MAX(ends_at) AS active_until
        FROM premium_entitlements
        WHERE status = 'active' AND ends_at > NOW()
        GROUP BY user_id
      ), attributed AS (
        SELECT u.id AS user_id,
          COALESCE(
            NULLIF(m.traffic_source, ''),
            CASE COALESCE(fl.distribution_channel, fl.runtime, u.platform, u.auth_provider)
              WHEN 'rustore' THEN 'RuStore'
              WHEN 'google_play' THEN 'Google Play'
              WHEN 'telegram' THEN 'Telegram'
              WHEN 'native' THEN 'Приложение · прямой вход'
              WHEN 'web' THEN 'Веб · прямой вход'
              ELSE 'Не определён'
            END
          ) AS source,
          COALESCE(NULLIF(m.campaign_title, ''), NULLIF(ak.campaign_key, ''), 'Органический / Прямой') AS campaign,
          (GREATEST(u.premium_until, p.active_until) > NOW()) AS is_premium,
          u.last_login
        FROM users u
        LEFT JOIN mytracker_users m ON m.user_id = u.id
        LEFT JOIN user_acquisition_keys ak ON ak.user_id = u.id
        LEFT JOIN first_login fl ON fl.user_id = u.id
        LEFT JOIN premium p ON p.user_id = u.id
      )
      SELECT source, campaign,
        COUNT(*)::int AS users_count,
        COUNT(*) FILTER (WHERE is_premium)::int AS premium_users,
        COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days')::int AS active_7d
      FROM attributed
      GROUP BY 1, 2
      ORDER BY users_count DESC
      LIMIT 50
    `);

    // 2. Auth provider breakdown
    const providersRes = await pool.query(`WITH premium AS (
        SELECT user_id, MAX(ends_at) AS active_until
        FROM premium_entitlements
        WHERE status = 'active' AND ends_at > NOW()
        GROUP BY user_id
      )
      SELECT
        COALESCE(auth_provider, 'guest') AS provider,
        COUNT(*)::int AS users_count,
        COUNT(*) FILTER (WHERE GREATEST(u.premium_until, premium.active_until) > NOW())::int AS premium_users,
        COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days')::int AS active_7d
      FROM users u
      LEFT JOIN premium ON premium.user_id = u.id
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
