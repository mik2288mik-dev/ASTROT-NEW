import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';
import { invalidateFlagCache } from '../../../../../lib/admin/featureFlags';

/** Feature flags / настройки. Право settings.manage (только super_admin). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await requireAdminPermission(req, 'settings.manage');
    const pool = getPool();

    if (req.method === 'GET') {
      const rows = await pool.query(`SELECT key, value, description, updated_at FROM feature_flags ORDER BY key ASC`);
      return res.status(200).json({
        flags: rows.rows.map((r: any) => ({
          key: r.key, value: r.value, description: r.description || null,
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        })),
      });
    }

    if (req.method === 'PUT') {
      const key = String(req.body?.key || '').trim();
      if (!/^[a-z0-9_]{2,60}$/.test(key)) throw new AdminAuthError(400, 'BAD_KEY', 'key must be 2–60 chars a-z 0-9 _');
      // value приходит как JSON-значение (bool/number/string/object)
      const value = req.body?.value;
      if (value === undefined) throw new AdminAuthError(400, 'BAD_VALUE', 'value is required');
      const description = req.body?.description != null ? String(req.body.description) : null;
      const before = await pool.query(`SELECT value FROM feature_flags WHERE key = $1`, [key]);
      await pool.query(
        `INSERT INTO feature_flags (key, value, description, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
           description = COALESCE(EXCLUDED.description, feature_flags.description),
           updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value), description, ctx.userId]
      );
      invalidateFlagCache();
      await recordAdminAction({ req, actor: ctx, action: 'feature_flag_changed', entityType: 'feature_flag', entityId: key, before: before.rows[0]?.value ?? null, after: value });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const key = String(req.body?.key || req.query.key || '').trim();
      if (!key) throw new AdminAuthError(400, 'BAD_KEY', 'key is required');
      await pool.query(`DELETE FROM feature_flags WHERE key = $1`, [key]);
      invalidateFlagCache();
      await recordAdminAction({ req, actor: ctx, action: 'feature_flag_changed', entityType: 'feature_flag', entityId: key, after: { deleted: true } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
