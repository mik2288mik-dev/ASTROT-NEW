import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { getPool } from '../../../../lib/db';

/**
 * Продуктовая аналитика для админки — всё считается из РЕАЛЬНЫХ таблиц
 * (users, user_sessions, natal_charts, user_app_events). Никаких заглушек:
 * если данных нет, цифра честно равна 0.
 *
 * Главный вопрос, на который отвечает эндпойнт: «до какого шага доходит
 * пользователь и где он отваливается» (воронка) + кто активен сейчас.
 */

type FunnelStep = {
  key: string;
  users: number;
  /** Доля от первого шага (0–100). */
  pctOfStart: number;
  /** Конверсия из предыдущего шага (0–100). */
  pctOfPrev: number;
  /** Сколько людей потеряно по сравнению с предыдущим шагом. */
  droppedFromPrev: number;
};

async function scalar(sql: string): Promise<number> {
  try {
    const pool = getPool();
    const result = await pool.query(sql);
    const raw = result.rows?.[0] ? Object.values(result.rows[0])[0] : 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // Таблица может отсутствовать в редких окружениях — не валим всю страницу.
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const pool = getPool();

    const [
      totalUsers,
      withBirth,
      withChart,
      returningUsers,
      paywallUsers,
      premiumUsers,
    ] = await Promise.all([
      scalar('SELECT COUNT(*) FROM users'),
      scalar('SELECT COUNT(*) FROM users WHERE birth_date IS NOT NULL'),
      scalar('SELECT COUNT(DISTINCT user_id) FROM natal_charts'),
      scalar('SELECT COUNT(*) FROM (SELECT user_id FROM user_sessions GROUP BY user_id HAVING COUNT(*) >= 2) t'),
      scalar("SELECT COUNT(DISTINCT user_id) FROM user_app_events WHERE event_type = 'paywall_view'"),
      scalar('SELECT COUNT(*) FROM users WHERE premium_until IS NOT NULL AND premium_until > NOW()'),
    ]);

    const rawSteps: Array<{ key: string; users: number }> = [
      { key: 'opened', users: totalUsers },
      { key: 'birth_data', users: withBirth },
      { key: 'chart', users: withChart },
      { key: 'returned', users: returningUsers },
      { key: 'paywall', users: paywallUsers },
      { key: 'premium', users: premiumUsers },
    ];

    const start = rawSteps[0].users || 0;
    const funnel: FunnelStep[] = rawSteps.map((step, i) => {
      const prev = i === 0 ? step.users : rawSteps[i - 1].users;
      return {
        key: step.key,
        users: step.users,
        pctOfStart: start > 0 ? Math.round((step.users / start) * 1000) / 10 : 0,
        pctOfPrev: prev > 0 ? Math.round((step.users / prev) * 1000) / 10 : 0,
        droppedFromPrev: i === 0 ? 0 : Math.max(prev - step.users, 0),
      };
    });

    // «Где дожимать» = переход (после первого шага) с худшей конверсией из предыдущего.
    let bottleneckKey: string | null = null;
    let worstPct = Infinity;
    for (let i = 1; i < funnel.length; i += 1) {
      if (funnel[i - 1].users <= 0) continue;
      if (funnel[i].pctOfPrev < worstPct) {
        worstPct = funnel[i].pctOfPrev;
        bottleneckKey = funnel[i].key;
      }
    }

    // Активность по уникальным пользователям (последний визит из сессий).
    const activeRow = await pool
      .query(
        `SELECT
           COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '1 day')   AS dau,
           COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '7 days')  AS wau,
           COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '30 days') AS mau
         FROM (SELECT user_id, MAX(last_seen_at) AS last_seen FROM user_sessions GROUP BY user_id) s`
      )
      .then((r) => r.rows?.[0] || {})
      .catch(() => ({}));
    const active = {
      dau: Number(activeRow.dau) || 0,
      wau: Number(activeRow.wau) || 0,
      mau: Number(activeRow.mau) || 0,
    };

    // Новые пользователи за 14 дней — ровный ряд без пропусков (для графика).
    const newUsersRows = await pool
      .query(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS date, COALESCE(c.cnt, 0)::int AS count
         FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN (
           SELECT created_at::date AS dd, COUNT(*) AS cnt
           FROM users
           WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
           GROUP BY 1
         ) c ON c.dd = d::date
         ORDER BY date ASC`
      )
      .then((r) => r.rows as Array<{ date: string; count: number }>)
      .catch(() => [] as Array<{ date: string; count: number }>);

    // Топ событий в приложении за 30 дней (что вообще нажимают).
    const eventsRows = await pool
      .query(
        `SELECT event_type AS type, COUNT(*)::int AS count
         FROM user_app_events
         WHERE occurred_at >= NOW() - INTERVAL '30 days'
         GROUP BY event_type
         ORDER BY count DESC
         LIMIT 14`
      )
      .then((r) => r.rows as Array<{ type: string; count: number }>)
      .catch(() => [] as Array<{ type: string; count: number }>);

    const newUsers14d = newUsersRows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    const premiumRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        premium: premiumUsers,
        premiumRate,
        withBirth,
        withChart,
        returning: returningUsers,
        newUsers14d,
      },
      active,
      funnel,
      bottleneckKey,
      newUsers: newUsersRows,
      events: eventsRows,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
