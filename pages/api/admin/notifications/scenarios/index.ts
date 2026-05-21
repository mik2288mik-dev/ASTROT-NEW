import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    await notificationEngineAdminDb.ensureScenarioSeeds();
    const scenarios = await notificationEngineAdminDb.listScenarios();
    return res.status(200).json({ scenarios });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
