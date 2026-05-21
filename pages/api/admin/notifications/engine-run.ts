import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { runNotificationEngineCron } from '../../../../services/notificationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);
    const limit = Number(req.body?.limit);
    const result = await runNotificationEngineCron(access.requesterId, new Date(), {
      dryRun: req.body?.dryRun !== false,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50,
    });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
