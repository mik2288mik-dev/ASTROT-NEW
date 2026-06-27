import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Список натальных профилей по всем пользователям. Право charts.view. PII не отдаём. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'charts.view');

    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const offset = (page - 1) * pageSize;
    const like = `%${q}%`;

    const where = q
      ? `WHERE (COALESCE(c.name,'') ILIKE $1 OR COALESCE(u.name,'') ILIKE $1 OR CAST(c.user_id AS TEXT) ILIKE $1)`
      : '';
    const params = q ? [like, pageSize, offset] : [pageSize, offset];
    const limOff = q ? '$2 OFFSET $3' : '$1 OFFSET $2';

    const pool = getPool();
    const [countRes, rowsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM natal_charts c LEFT JOIN users u ON u.id = c.user_id ${where}`, q ? [like] : []),
      pool.query(
        `SELECT c.id, c.user_id, c.name, c.sun_sign, c.moon_sign, c.ascendant_sign,
                c.calculation_version, c.timezone, c.is_primary, c.created_at,
                (c.birth_date IS NOT NULL) AS has_birth_date,
                (c.birth_time IS NOT NULL) AS has_birth_time,
                u.name AS owner_name
           FROM natal_charts c LEFT JOIN users u ON u.id = c.user_id
           ${where}
           ORDER BY c.created_at DESC NULLS LAST, c.id DESC
           LIMIT ${limOff}`,
        params
      ),
    ]);

    const total = Number(countRes.rows[0]?.total || 0);
    return res.status(200).json({
      charts: rowsRes.rows.map((r: any) => ({
        id: Number(r.id),
        userId: String(r.user_id),
        ownerName: r.owner_name || null,
        name: r.name || 'Моя карта',
        sunSign: r.sun_sign || null,
        moonSign: r.moon_sign || null,
        ascendantSign: r.ascendant_sign || null,
        version: r.calculation_version || null,
        timezone: r.timezone || null,
        isPrimary: !!r.is_primary,
        hasBirthDate: !!r.has_birth_date,
        hasBirthTime: !!r.has_birth_time,
        // Статус расчёта: ok если три ключевые точки на месте.
        status: r.sun_sign && r.moon_sign && r.ascendant_sign ? 'ok' : 'error',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
