import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { getActivityReport, parseActivityRange } from '../../../../lib/admin/activityAnalytics';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    return res.status(200).json(await getActivityReport(parseActivityRange(req.query)));
  } catch (error) { return handleAdminError(res, error); }
}
