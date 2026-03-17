import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeNotificationHistoryItem } from '../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
    const history = await db.notifications.getRecentCampaigns(Math.min(Math.max(limit, 1), 30));

    return res.status(200).json({
      history: history.map(serializeNotificationHistoryItem),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
