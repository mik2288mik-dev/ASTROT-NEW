import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';

/**
 * Chart identity is immutable. The authenticated account has one self chart;
 * additional charts are saved people and can never replace it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAppUser(req, { allowGuest: true });
    return res.status(410).json({
      error: 'Saved people cannot replace your own chart.',
      code: 'SELF_CHART_IMMUTABLE',
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }
}
