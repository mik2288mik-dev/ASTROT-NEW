import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';

/** Промокоды. Право promo.manage. Создание/отключение логируется. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await requireAdminPermission(req, 'promo.manage');
    const pool = getPool();

    if (req.method === 'GET') {
      const rows = await pool.query(
        `SELECT code, type, value, max_uses, used_count, status, starts_at, expires_at, created_at
           FROM promo_codes ORDER BY created_at DESC LIMIT 200`
      );
      return res.status(200).json({
        promos: rows.rows.map((r: any) => ({
          code: r.code,
          type: r.type,
          value: Number(r.value),
          maxUses: Number(r.max_uses),
          usedCount: Number(r.used_count),
          status: r.status,
          startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
          expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        })),
      });
    }

    if (req.method === 'POST') {
      const code = String(req.body?.code || '').trim().toUpperCase();
      const type = String(req.body?.type || 'premium_days').trim();
      const value = Math.max(1, Math.min(Number(req.body?.value) || 30, 3650));
      const maxUses = Math.max(0, Number(req.body?.maxUses) || 0);
      const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new AdminAuthError(400, 'BAD_CODE', 'Code must be 3–40 chars A-Z 0-9 _ -');

      await pool.query(
        `INSERT INTO promo_codes (code, type, value, max_uses, status, expires_at, created_by, created_at)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (code) DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value,
           max_uses = EXCLUDED.max_uses, expires_at = EXCLUDED.expires_at, status = 'active'`,
        [code, type, value, maxUses, expiresAt, ctx.userId]
      );
      await recordAdminAction({ req, actor: ctx, action: 'settings_changed', entityType: 'promo_code', entityId: code, after: { type, value, maxUses } });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const code = String(req.body?.code || req.query.code || '').trim().toUpperCase();
      if (!code) throw new AdminAuthError(400, 'BAD_CODE', 'code is required');
      await pool.query(`UPDATE promo_codes SET status = 'disabled' WHERE code = $1`, [code]);
      await recordAdminAction({ req, actor: ctx, action: 'settings_changed', entityType: 'promo_code', entityId: code, after: { status: 'disabled' } });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
