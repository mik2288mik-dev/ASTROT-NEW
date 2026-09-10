import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { db, getPool } from '../../../../lib/db';
import { canonicalizeEvent, eventLabel } from '../../../../lib/admin/eventTaxonomy';

/** Ключевые метрики дашборда (реальные числа из БД). Право analytics.view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    const pool = getPool();

    const [overview, growth, charts, active, revenue, funnel, retention, events, commerceAttribution] = await Promise.all([
      db.admin.getUsersOverview(),
      pool.query(`SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::int AS d1,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS d7,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS d30
        FROM users`),
      pool.query(`SELECT COUNT(*)::int AS total FROM natal_charts`),
      pool.query(`SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '1 day')::int AS dau,
          COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days')::int AS wau,
          COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '30 days')::int AS mau
        FROM user_app_events`),
      pool.query(`SELECT
          COALESCE(SUM(stars_amount), 0)::bigint AS total_stars,
          COUNT(*)::int AS total_payments,
          COALESCE(SUM(stars_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS stars_30d
        FROM star_payments`).catch(() => ({ rows: [{ total_stars: 0, total_payments: 0, stars_30d: 0 }] })),
      pool.query(`SELECT
          COUNT(*)::int AS signups,
          COUNT(*) FILTER (WHERE birth_date IS NOT NULL)::int AS with_birth,
          (SELECT COUNT(DISTINCT user_id)::int FROM natal_charts) AS with_chart,
          (SELECT COUNT(DISTINCT user_id)::int FROM user_app_events
            WHERE event_type IN ('paywall_view','paywall_viewed','paywall_impression')) AS paywall,
          (SELECT COUNT(DISTINCT user_id)::int FROM user_app_events
            WHERE event_type IN ('checkout_start','checkout_started')) AS checkout,
          (SELECT COUNT(*)::int FROM (
            SELECT id AS user_id FROM users WHERE premium_until IS NOT NULL
            UNION
            SELECT user_id FROM user_app_events
              WHERE event_type IN (
                'purchase', 'purchase_success', 'purchase_succeeded',
                'subscription_started', 'natal_upgrade_success'
              )
          ) purchase_users) AS purchased
        FROM users`),
      // Retention D1/D7/D30: вернулся ли юзер в окно дня N после регистрации.
      // Когорта — за последние 90 дней; знаменатель = юзеры подходящего возраста.
      pool.query(`
        SELECT
          ROUND(100.0 * AVG(CASE WHEN age >= 1 THEN r1::int END))::int AS d1,
          ROUND(100.0 * AVG(CASE WHEN age >= 7 THEN r7::int END))::int AS d7,
          ROUND(100.0 * AVG(CASE WHEN age >= 30 THEN r30::int END))::int AS d30
        FROM (
          SELECT
            EXTRACT(DAY FROM NOW() - u.created_at) AS age,
            EXISTS(SELECT 1 FROM user_app_events e WHERE e.user_id = u.id AND e.occurred_at >= u.created_at + INTERVAL '1 day' AND e.occurred_at < u.created_at + INTERVAL '2 day') AS r1,
            EXISTS(SELECT 1 FROM user_app_events e WHERE e.user_id = u.id AND e.occurred_at >= u.created_at + INTERVAL '7 day' AND e.occurred_at < u.created_at + INTERVAL '8 day') AS r7,
            EXISTS(SELECT 1 FROM user_app_events e WHERE e.user_id = u.id AND e.occurred_at >= u.created_at + INTERVAL '30 day' AND e.occurred_at < u.created_at + INTERVAL '31 day') AS r30
          FROM users u
          WHERE u.created_at >= NOW() - INTERVAL '90 day' AND u.created_at <= NOW() - INTERVAL '1 day'
        ) t`).catch(() => ({ rows: [{ d1: null, d7: null, d30: null }] })),
      pool.query(`
        SELECT event_type, COUNT(*)::int AS count
          FROM user_app_events
          WHERE occurred_at >= NOW() - INTERVAL '30 days'
          GROUP BY event_type ORDER BY count DESC LIMIT 64`).catch(() => ({ rows: [] })),
      pool.query(`
        WITH attributed AS (
          SELECT
            CASE
              WHEN event_type IN ('paywall_view', 'paywall_viewed', 'paywall_impression') THEN 'paywall_view'
              WHEN event_type IN ('checkout_start', 'checkout_started') THEN 'checkout_start'
              WHEN event_type IN (
                'purchase', 'purchase_success', 'purchase_succeeded',
                'subscription_started', 'natal_upgrade_success'
              ) THEN 'purchase_success'
            END AS stage,
            NULLIF(payload_json->>'placement', '') AS placement,
            NULLIF(source, '') AS source,
            user_id
          FROM user_app_events
          WHERE occurred_at >= NOW() - INTERVAL '30 days'
            AND event_type IN (
              'paywall_view', 'paywall_viewed', 'paywall_impression',
              'checkout_start', 'checkout_started',
              'purchase', 'purchase_success', 'purchase_succeeded',
              'subscription_started', 'natal_upgrade_success'
            )
        ), grouped AS (
          SELECT
            stage,
            placement,
            source,
            COUNT(*)::int AS events,
            COUNT(DISTINCT user_id)::int AS users
          FROM attributed
          GROUP BY stage, placement, source
        ), ranked AS (
          SELECT
            grouped.*,
            ROW_NUMBER() OVER (
              PARTITION BY stage
              ORDER BY users DESC, events DESC, placement NULLS LAST, source NULLS LAST
            ) AS row_rank
          FROM grouped
        )
        SELECT stage, placement, source, events, users
        FROM ranked
        WHERE row_rank <= 8
        ORDER BY
          CASE stage
            WHEN 'paywall_view' THEN 1
            WHEN 'checkout_start' THEN 2
            WHEN 'purchase_success' THEN 3
          END,
          row_rank`).catch(() => ({ rows: [] })),
    ]);

    const g = growth.rows[0] || {};
    const a = active.rows[0] || {};
    const r = revenue.rows[0] || {};
    const f = funnel.rows[0] || {};
    const canonicalEventCounts = new Map<string, number>();
    for (const row of events.rows) {
      const type = canonicalizeEvent(String(row.event_type));
      canonicalEventCounts.set(type, (canonicalEventCounts.get(type) || 0) + Number(row.count || 0));
    }

    const funnelSteps = [
      { key: 'signup', label: 'Регистрация', users: Number(f.signups || 0) },
      { key: 'birth_data', label: 'Дата рождения', users: Number(f.with_birth || 0) },
      { key: 'natal_chart', label: 'Натальная карта', users: Number(f.with_chart || 0) },
      { key: 'paywall', label: 'Paywall', users: Number(f.paywall || 0) },
      { key: 'checkout', label: 'Начало оплаты', users: Number(f.checkout || 0) },
      { key: 'purchase', label: 'Покупка', users: Number(f.purchased || 0) },
    ];
    const start = funnelSteps[0].users || 1;
    const funnelWithPct = funnelSteps.map((s, i) => ({
      ...s,
      pctOfStart: Math.round((s.users / start) * 100),
      pctOfPrev: i === 0 ? 100 : Math.round((s.users / Math.max(funnelSteps[i - 1].users, 1)) * 100),
    }));

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      kpis: {
        totalUsers: overview.total_users,
        activePremiumUsers: overview.active_premium_users,
        usersWithoutBirthData: overview.users_without_birth_data,
        newUsers1d: Number(g.d1 || 0),
        newUsers7d: Number(g.d7 || 0),
        newUsers30d: Number(g.d30 || 0),
        totalCharts: Number(charts.rows[0]?.total || 0),
        dau: Number(a.dau || 0),
        wau: Number(a.wau || 0),
        mau: Number(a.mau || 0),
        totalStars: Number(r.total_stars || 0),
        totalPayments: Number(r.total_payments || 0),
        stars30d: Number(r.stars_30d || 0),
        premiumRate: overview.total_users > 0
          ? Math.round((overview.active_premium_users / overview.total_users) * 100)
          : 0,
      },
      funnel: funnelWithPct,
      retention: {
        d1: retention.rows[0]?.d1 ?? null,
        d7: retention.rows[0]?.d7 ?? null,
        d30: retention.rows[0]?.d30 ?? null,
      },
      events: Array.from(canonicalEventCounts.entries())
        .map(([type, count]) => ({ type, label: eventLabel(type), count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 12),
      commerceAttribution: commerceAttribution.rows.map((row: any) => ({
        stage: String(row.stage),
        placement: typeof row.placement === 'string' ? row.placement : null,
        source: typeof row.source === 'string' ? row.source : null,
        events: Number(row.events || 0),
        users: Number(row.users || 0),
      })),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
