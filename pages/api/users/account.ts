import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAppSessionCookie, requireAppUser } from '../../../lib/auth/appAuth';
import { handleAdminError } from '../../../lib/adminAuth';
import { deleteAccountData } from '../../../lib/accountDeletion';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const result = await deleteAccountData(auth.userId);
    clearAppSessionCookie(res);
    return res.status(200).json(result);
  } catch (error) { return handleAdminError(res, error); }
}
