import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeNotificationDeliveryLog } from '../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const rows = await db.notification_delivery_log.listRecent(limit);
    return res.status(200).json({ log: rows.map(serializeNotificationDeliveryLog) });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
