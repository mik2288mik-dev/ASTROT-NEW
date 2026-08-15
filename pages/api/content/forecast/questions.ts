import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';

export const config = { maxDuration: 30 };

const RETIRED_CODE = 'PERSONAL_FORECAST_DIALOGUE_RETIRED';

/**
 * The old question/answer pipeline was tied to the removed calculated-forecast
 * package and its astrology-history memory. It is deliberately unavailable
 * until the product has a real user dialogue with its own contract and memory.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!['GET', 'POST', 'PATCH'].includes(String(req.method || ''))) {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    await requireAppUser(req, { allowGuest: true });
    return res.status(410).json({
      error: 'The legacy forecast question dialogue is retired',
      code: RETIRED_CODE,
      retired: true,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      handleAdminError(res, error);
      return;
    }
    throw error;
  }
}
