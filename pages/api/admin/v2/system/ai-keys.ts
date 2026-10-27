import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getAiKeysStatus } from '../../../../../lib/aiKeysStatus';

/** Whether each AI key is accepted, plus the DeepSeek balance. Free read-only checks. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'settings.manage') && !roleHasPermission(ctx.role, 'audit.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'settings.manage or audit.view permission required' });
    }
    return res.status(200).json(await getAiKeysStatus({ fresh: req.query.fresh === '1' }));
  } catch (error) {
    return handleAdminError(res, error);
  }
}
