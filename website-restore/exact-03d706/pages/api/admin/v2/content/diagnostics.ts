import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getAiContentHealth, pingAiGeneration } from '../../../../../lib/aiHealth';

/** Returns health and a real Luna Responses API ping for non-Zodiac generation. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'analytics.view');
      const health = await getAiContentHealth();
      return res.status(200).json({ ok: true, healthy: health.problems.length === 0, ...health });
    }

    if (req.method === 'POST') {
      await requireAdminPermission(req, 'analytics.view');
      const result = await pingAiGeneration();
      return res.status(200).json({ ok: true, result });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
