import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission, roleHasPermission } from '../../../../../../lib/admin/rbac';
import { getUserActivityReport, parseActivityRange } from '../../../../../../lib/admin/activityAnalytics';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await requireAdminPermission(req, 'users.view');
    if (!roleHasPermission(ctx.role, 'analytics.view')) throw new AdminAuthError(403, 'FORBIDDEN', 'Недостаточно прав');
    const id = String(req.query.id || '');
    if (!/^-?\d{1,20}$/.test(id)) throw new AdminAuthError(400, 'INVALID_USER_ID', 'Неверный пользователь');
    return res.status(200).json(await getUserActivityReport(id, parseActivityRange(req.query),
      req.query.cursor == null ? undefined : String(req.query.cursor), req.query.limit == null ? 40 : Number(req.query.limit)));
  } catch (error) { return handleAdminError(res, error); }
}
