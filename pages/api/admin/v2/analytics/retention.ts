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

    // Query 8 weekly cohorts
    const cohortSql = `
      WITH cohorts AS (
        SELECT
          date_trunc('week', created_at) AS cohort_week,
          id AS user_id,
          created_at
        FROM users
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
      ),
      cohort_sizes AS (
        SELECT cohort_week, COUNT(user_id)::int AS cohort_size
        FROM cohorts
        GROUP BY cohort_week
      ),
      activity AS (
        SELECT
          c.cohort_week,
          c.user_id,
          e.occurred_at,
          EXTRACT(EPOCH FROM (e.occurred_at - c.created_at)) / 86400.0 AS days_since_join
        FROM cohorts c
        JOIN user_app_events e ON e.user_id = c.user_id
        WHERE e.occurred_at >= c.created_at
      )
      SELECT
        to_char(cs.cohort_week, 'YYYY-MM-DD') AS week,
        cs.cohort_size,
        ROUND(COUNT(DISTINCT a.user_id) FILTER (WHERE a.days_since_join BETWEEN 0.8 AND 2.2)::numeric / NULLIF(cs.cohort_size, 0) * 100, 1) AS d1,
        ROUND(COUNT(DISTINCT a.user_id) FILTER (WHERE a.days_since_join BETWEEN 2.5 AND 4.2)::numeric / NULLIF(cs.cohort_size, 0) * 100, 1) AS d3,
        ROUND(COUNT(DISTINCT a.user_id) FILTER (WHERE a.days_since_join BETWEEN 6.0 AND 8.5)::numeric / NULLIF(cs.cohort_size, 0) * 100, 1) AS d7,
        ROUND(COUNT(DISTINCT a.user_id) FILTER (WHERE a.days_since_join BETWEEN 13.0 AND 16.0)::numeric / NULLIF(cs.cohort_size, 0) * 100, 1) AS d14,
        ROUND(COUNT(DISTINCT a.user_id) FILTER (WHERE a.days_since_join BETWEEN 28.0 AND 33.0)::numeric / NULLIF(cs.cohort_size, 0) * 100, 1) AS d30
      FROM cohort_sizes cs
      LEFT JOIN activity a ON a.cohort_week = cs.cohort_week
      GROUP BY cs.cohort_week, cs.cohort_size
      ORDER BY cs.cohort_week DESC
    `;

    const result = await pool.query(cohortSql);

    return res.status(200).json({
      cohorts: result.rows.map((row) => ({
        week: row.week,
        cohortSize: Number(row.cohort_size),
        d1: row.d1 !== null ? Number(row.d1) : null,
        d3: row.d3 !== null ? Number(row.d3) : null,
        d7: row.d7 !== null ? Number(row.d7) : null,
        d14: row.d14 !== null ? Number(row.d14) : null,
        d30: row.d30 !== null ? Number(row.d30) : null,
      })),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
