import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError, getConfiguredOwnerId } from '../../../../../lib/adminAuth';
import { requireAdminPermission, ADMIN_ROLES, type AdminRole } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';

/** Управление админами и их ролями. Право roles.manage (только super_admin). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await requireAdminPermission(req, 'roles.manage');
    const ownerId = getConfiguredOwnerId();

    if (req.method === 'GET') {
      const result = await getPool().query(
        `SELECT a.user_id, a.role, a.status, a.created_at, a.created_by, u.name
           FROM admin_users a LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.created_at ASC`
      );
      const admins = result.rows.map((r: any) => ({
        userId: String(r.user_id),
        name: r.name || null,
        role: r.role,
        status: r.status,
        isOwner: !!ownerId && String(r.user_id) === String(ownerId),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));
      return res.status(200).json({ admins, roles: ADMIN_ROLES });
    }

    if (req.method === 'POST') {
      const userId = String(req.body?.userId || '').trim();
      const role = String(req.body?.role || '').trim() as AdminRole;
      if (!/^-?\d+$/.test(userId)) throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'Valid userId is required');
      if (!(ADMIN_ROLES as readonly string[]).includes(role)) {
        throw new AdminAuthError(400, 'INVALID_ROLE', 'Unknown role');
      }
      // Пользователь должен существовать (admin_users.user_id → users.id).
      const exists = await getPool().query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (!exists.rows[0]) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'User must exist before becoming admin');

      const beforeRes = await getPool().query('SELECT role, status FROM admin_users WHERE user_id = $1', [userId]);
      const before = beforeRes.rows[0] || null;

      await getPool().query(
        `INSERT INTO admin_users (user_id, role, status, created_by, created_at, updated_at)
         VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [userId, role, ctx.userId]
      );
      // Совместимость со старым гейтом: держим users.is_admin в синхроне.
      await getPool().query('UPDATE users SET is_admin = TRUE WHERE id = $1', [userId]);

      await recordAdminAction({
        req, actor: ctx, action: before ? 'role_changed' : 'admin_added',
        entityType: 'admin_user', entityId: userId,
        before: before ? { role: before.role, status: before.status } : null,
        after: { role, status: 'active' },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const userId = String(req.body?.userId || req.query.userId || '').trim();
      if (!userId) throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'userId is required');
      if (ownerId && userId === String(ownerId)) {
        throw new AdminAuthError(400, 'CANNOT_REMOVE_OWNER', 'Owner cannot be removed');
      }
      await getPool().query(`UPDATE admin_users SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);
      await getPool().query('UPDATE users SET is_admin = FALSE WHERE id = $1', [userId]);
      await recordAdminAction({ req, actor: ctx, action: 'admin_removed', entityType: 'admin_user', entityId: userId });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
