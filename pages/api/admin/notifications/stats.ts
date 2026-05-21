import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { notificationEngineAdminDb } from '../../../../lib/adminNotificationEngineDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const stats = await notificationEngineAdminDb.getStats();
    return res.status(200).json({ stats });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
