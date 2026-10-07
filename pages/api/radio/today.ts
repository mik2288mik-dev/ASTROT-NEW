import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { composeDailyRadio } from '../../../lib/dailyRadio';

export const config = { maxDuration: 60 };

/** The text of today's «Радио NEBO» issue, for reading. NEBO Premium only, built from the server's own content. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (!(await getPremiumEntitlementState(userId)).isPremium) return res.status(403).json({ code: 'RADIO_PREMIUM_REQUIRED' });
    const issue = await composeDailyRadio(userId);
    return res.status(200).json({ dayKey: issue.dayKey, text: issue.text });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    if (status >= 500) console.error('[radio/today] failed', error instanceof Error ? error.message : error);
    return res.status(status).json({ code: status >= 500 ? 'RADIO_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
