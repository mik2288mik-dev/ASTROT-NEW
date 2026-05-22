import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError, requireAdminAccess } from '../../../../lib/adminAuth';
import {
  cancelScheduledNotification,
  listScheduledNotificationQueue,
  retryScheduledNotification,
} from '../../../../services/notificationRetentionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await requireAdminAccess(req);
    if (req.method === 'GET') {
      const limit = Number(req.query.limit || 100);
      const status = typeof req.query.status === 'string' ? req.query.status : null;
      const queue = await listScheduledNotificationQueue(Number.isFinite(limit) ? limit : 100, status);
      return res.status(200).json({ queue });
    }
    if (req.method === 'POST') {
      const id = Number(req.body?.id);
      const action = String(req.body?.action || '');
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'INVALID_ID' });
      if (action === 'cancel') return res.status(200).json({ success: await cancelScheduledNotification(id) });
      if (action === 'retry') return res.status(200).json({ success: await retryScheduledNotification(id) });
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
