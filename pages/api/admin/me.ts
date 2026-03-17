import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminAccessState, handleAdminError } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await getAdminAccessState(req);
    return res.status(200).json({
      requesterId: access.requesterId,
      isAdmin: access.isAdmin,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
