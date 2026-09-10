import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAdminContext } from '../../../../lib/admin/rbac';

/** Кто я в админке: роль и набор прав (для построения меню/гейтов на клиенте). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await getAdminContext(req);
    return res.status(200).json({
      userId: ctx.userId,
      role: ctx.role,
      isOwner: ctx.isOwner,
      permissions: ctx.permissions,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
