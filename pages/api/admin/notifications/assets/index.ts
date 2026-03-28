import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeNotificationAsset } from '../../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const rows = await db.notification_assets.getAll();
    return res.status(200).json({ assets: rows.map(serializeNotificationAsset) });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
