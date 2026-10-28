import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { readUserInbox } from '../../../lib/appPush';

/** GET ?sign=Pisces — the messages from NEBO for this person, newest first. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const sign = typeof req.query.sign === 'string' && /^[A-Za-z]{3,12}$/.test(req.query.sign) ? req.query.sign : null;
    return res.status(200).json({ messages: await readUserInbox(String(auth.userId), sign) });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ error: status >= 500 ? 'INBOX_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
