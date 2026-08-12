import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  beginPasswordReset,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const result = await beginPasswordReset({
      email: String(req.body?.email || ''),
      clientKey: getAuthClientKey(req),
    });
    return res.status(202).json({ ok: true, challengeId: result.challengeId });
  } catch (error) {
    return handleAdminError(res, sanitizeEmailPasswordError(error));
  }
}
