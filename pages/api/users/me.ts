import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { handleAdminError } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const user = await db.users.get(auth.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(toPublicAppProfile(user, auth));
  } catch (error) { return handleAdminError(res, error); }
}
