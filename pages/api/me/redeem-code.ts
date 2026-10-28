import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { redeemCode, RedeemError } from '../../../lib/oneTimePurchases';

/** POST { code } — a Plus gift code or an admin promo code; adds Plus days to the account. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req);
    if (auth.isGuest) return res.status(403).json({ error: 'SIGN_IN_REQUIRED' });
    const result = await redeemCode(String(auth.userId), typeof req.body?.code === 'string' ? req.body.code : '');
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof RedeemError) return res.status(409).json({ error: error.code });
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ error: status >= 500 ? 'REDEEM_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
