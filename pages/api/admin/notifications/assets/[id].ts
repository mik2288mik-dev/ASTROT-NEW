import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';
import { deleteNotificationAssetFile } from '../../../../../services/notificationAssetService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid asset id' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const asset = await notificationEngineAdminDb.updateAsset(id, req.body || {});
      if (!asset) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Asset not found' });
      }
      return res.status(200).json({ asset });
    }

    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }

    const row = await db.notification_assets.deleteIfUnused(id);
    if (!row) {
      return res.status(400).json({ error: 'ASSET_IN_USE_OR_MISSING', message: 'Asset in use or not found' });
    }
    await deleteNotificationAssetFile(row.storage_path);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'ASSET_IN_USE') {
      return res.status(400).json({ error: 'ASSET_IN_USE', message: 'Cannot delete: asset is linked to a template' });
    }
    return handleAdminError(res, error);
  }
}
