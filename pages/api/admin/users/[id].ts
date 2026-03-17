import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeAdminUserDetail } from '../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return res.status(400).json({ error: 'USER_ID_REQUIRED', message: 'User ID is required' });
  }

  try {
    await requireAdminAccess(req);
    const user = await db.admin.getUserDetail(userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return res.status(200).json({
      user: serializeAdminUserDetail(user),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
