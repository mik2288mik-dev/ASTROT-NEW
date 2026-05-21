import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT', 'PATCH'].includes(req.method || '')) {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const id = Number(req.query.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid scenario id' });
    }

    if (req.method === 'GET') {
      const scenario = await notificationEngineAdminDb.getScenario(id);
      if (!scenario) return res.status(404).json({ error: 'NOT_FOUND', message: 'Scenario not found' });
      return res.status(200).json({ scenario });
    }

    const scenario = await notificationEngineAdminDb.updateScenario(id, req.body || {});
    if (!scenario) return res.status(404).json({ error: 'NOT_FOUND', message: 'Scenario not found' });
    return res.status(200).json({ scenario });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
