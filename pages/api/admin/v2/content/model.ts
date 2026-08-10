import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';

/**
 * Kept only as a clear compatibility response for older admin clients.
 * Model selection was removed: non-Zodiac content is fixed to OpenAI Luna.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await requireAdminPermission(req, 'ai.edit');
    return res.status(410).json({
      error: 'MODEL_SELECTION_REMOVED',
      message: 'Non-Zodiac content is fixed to OpenAI Luna.',
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
