import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { requestEmailCode, type AuthPurpose } from '../../../../lib/auth/accountIdentity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const purpose: AuthPurpose = req.body?.purpose === 'link' ? 'link' : 'login';
    let currentUserId: string | null = null;
    if (purpose === 'link') {
      currentUserId = (await requireAppUser(req, { allowGuest: true })).userId;
    }
    const result = await requestEmailCode({
      email: String(req.body?.email || ''),
      purpose,
      currentUserId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
