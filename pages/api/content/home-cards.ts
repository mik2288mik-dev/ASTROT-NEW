import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { getPublishedContent } from '../../../lib/admin/contentStore';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { selectPublishedHomeCards } from '../../../lib/homeCards';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Authorization, Cookie, x-telegram-init-data');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); }
  try {
    let userId: string | null = null;
    try { userId = (await requireAppUser(req, { allowGuest: true })).userId; }
    catch (error) {
      // Anonymous browsing is allowed. Invalid/revoked credentials still fail normally.
      if (!(error instanceof AdminAuthError) || error.code !== 'APP_AUTH_REQUIRED') throw error;
    }
    const locale = req.query.locale === 'en' ? 'en' : 'ru';
    const [rows, entitlement] = await Promise.all([
      getPublishedContent('home_card', locale), userId ? getPremiumEntitlementState(userId) : Promise.resolve(null),
    ]);
    return res.status(200).json(selectPublishedHomeCards(rows, entitlement?.isPremium === true, Date.now(), entitlement?.endsAt));
  } catch (error) { return handleAdminError(res, error); }
}
