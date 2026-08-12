import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  beginEmailPasswordRegistration,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const link = req.body?.purpose === 'link';
    const currentAuth = link
      ? await requireAppUser(req, { allowGuest: true, allowTelegramProof: false })
      : null;
    const result = await beginEmailPasswordRegistration({
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
      passwordConfirmation: String(req.body?.passwordConfirmation || ''),
      clientKey: getAuthClientKey(req),
      currentUserId: currentAuth?.userId || null,
    });
    return res.status(202).json({ ok: true, challengeId: result.challengeId });
  } catch (error) {
    return handleAdminError(res, sanitizeEmailPasswordError(error));
  }
}
