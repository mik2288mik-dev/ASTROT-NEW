import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { dispatchScheduledNotifications, planRetentionNotifications } from '../../../../services/notificationRetentionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);
    const limit = Number(req.body?.limit);
    const dryRun = req.body?.dryRun !== false;
    const planner = await planRetentionNotifications('admin-campaign-runner', new Date(), {
      dryRun,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50,
    });
    const dispatcher = dryRun
      ? { ok: true, total: 0, successCount: 0, failureCount: 0, results: [] }
      : await dispatchScheduledNotifications(new Date(), Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50);
    const result = { createdBy: access.requesterId, planner, dispatcher };
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
