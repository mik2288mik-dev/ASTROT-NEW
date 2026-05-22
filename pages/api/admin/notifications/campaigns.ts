import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError, requireAdminAccess } from '../../../../lib/adminAuth';
import { listRetentionCampaigns } from '../../../../services/notificationRetentionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminAccess(req);
    const limit = Number(req.query.limit || 100);
    const campaigns = await listRetentionCampaigns(Number.isFinite(limit) ? limit : 100);
    return res.status(200).json({ campaigns });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
