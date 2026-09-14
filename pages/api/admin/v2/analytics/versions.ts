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

    // Query versions distribution from users and error rates
    const versionsRes = await pool.query(`
      SELECT
        COALESCE(u.app_version, 'web') AS version,
        COUNT(DISTINCT u.id)::int AS total_users,
        COUNT(DISTINCT u.id) FILTER (WHERE u.last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_users_7d,
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days')::int AS new_users_30d,
        COUNT(DISTINCT u.id) FILTER (WHERE u.is_premium)::int AS premium_users,
        MIN(u.created_at) AS first_seen_at,
        MAX(u.last_seen_at) AS last_seen_at
      FROM users u
      GROUP BY 1
      ORDER BY total_users DESC
      LIMIT 20
    `);

    // Query error counts per version
    const errorsPerVersion = await pool.query(`
      SELECT
        COALESCE(app_version, 'unknown') AS version,
        SUM(occurrences_count)::int AS total_errors
      FROM app_technical_errors
      GROUP BY 1
    `).catch(() => ({ rows: [] }));

    const errorMap = new Map<string, number>();
    for (const r of errorsPerVersion.rows) {
      errorMap.set(r.version, Number(r.total_errors || 0));
    }

    const versions = versionsRes.rows.map((row) => {
      const v = row.version;
      const errors = errorMap.get(v) || 0;
      const active7d = Number(row.active_users_7d || 0);
      const errorRate = active7d > 0 ? Math.round((errors / active7d) * 100) / 100 : 0;
      const premiumUsers = Number(row.premium_users || 0);
      const totalUsers = Number(row.total_users || 1);
      const conversion = Math.round((premiumUsers / totalUsers) * 1000) / 10;

      return {
        version: v,
        totalUsers,
        activeUsers7d: active7d,
        newUsers30d: Number(row.new_users_30d || 0),
        premiumUsers,
        conversionPct: conversion,
        errorsCount: errors,
        errorRate,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
      };
    });

    return res.status(200).json({
      versions,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
