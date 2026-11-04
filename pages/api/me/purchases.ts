import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { consumePosterCredit, consumeSpreadCredit, readPurchasesSnapshot } from '../../../lib/oneTimePurchases';

/**
 * GET — what the person bought: esoterica until, spare spreads, gift codes.
 * POST { action: 'use_spread' } — spends one bought spread.
 * POST { action: 'use_poster' } — spends one bought poster after the file is made.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (req.method === 'POST') {
      if (req.body?.action !== 'use_spread' && req.body?.action !== 'use_poster') return res.status(400).json({ error: 'UNKNOWN_ACTION' });
      const used = req.body.action === 'use_poster' ? await consumePosterCredit(userId) : await consumeSpreadCredit(userId);
      if (!used) return res.status(409).json({ error: req.body.action === 'use_poster' ? 'NO_POSTER_CREDITS' : 'NO_SPREAD_CREDITS' });
    }
    return res.status(200).json(await readPurchasesSnapshot(userId));
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ error: status >= 500 ? 'PURCHASES_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
