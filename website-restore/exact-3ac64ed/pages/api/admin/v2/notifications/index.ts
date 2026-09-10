import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    await requireAdminPermission(req, 'push.send');
    await notificationEngineAdminDb.ensureScenarioSeeds();
    const [stats, scenarios, templates] = await Promise.all([
      notificationEngineAdminDb.getStats(),
      notificationEngineAdminDb.listScenarios(),
      notificationEngineAdminDb.listTemplates(),
    ]);

    return res.status(200).json({ stats, scenarios, templates });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
