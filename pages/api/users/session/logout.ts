import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAppSessionCookie, requireAppUser, revokeAppSession } from '../../../../lib/auth/appAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    if (auth.sessionId) await revokeAppSession(auth.sessionId, Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60);
    clearAppSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error?.code || 'LOGOUT_FAILED' });
  }
}
