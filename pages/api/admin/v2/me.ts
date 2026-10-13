import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAdminContext } from '../../../../lib/admin/rbac';
import { isTelegramSourceConfigured } from '../../../../lib/admin/dataSource';
import { getPrimaryPool } from '../../../../lib/db';
import { neboServerLabel } from '../../../../lib/neboOps';

/** Кто я в админке: роль, права, имя и какие базы можно смотреть. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await getAdminContext(req);
    const user = await getPrimaryPool().query('SELECT name FROM users WHERE id = $1', [ctx.userId]).catch(() => null);
    return res.status(200).json({
      userId: ctx.userId,
      name: String(user?.rows[0]?.name || '').trim() || null,
      role: ctx.role,
      isOwner: ctx.isOwner,
      permissions: ctx.permissions,
      server: neboServerLabel(),
      sources: { telegram: isTelegramSourceConfigured() },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
