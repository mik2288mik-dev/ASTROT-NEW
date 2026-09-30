import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { getMoscowIsoWeekKey } from '../../../../lib/date-utils';
import { normalizeZodiacKey } from '../../../../lib/horoscope/signDaily';
import { getSignWeeklyHoroscopeSnapshot } from '../../../../lib/horoscope/signWeekly';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { projectSignHoroscopeForWire } from '../../../../lib/horoscope/signWireCompatibility';

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let userId: string;
  try {
    userId = (await requireAppUser(req, { allowGuest: true })).userId;
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    throw error;
  }

  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
    });
  }

  const source = req.method === 'GET' ? req.query : req.body;
  const sign = normalizeZodiacKey(String(source?.sign || ''));
  const requestedPeriod = String(source?.periodKey || '').trim();
  const periodKey = getMoscowIsoWeekKey();
  const language: Language = source?.language === 'en' ? 'en' : 'ru';
  const userAgent = String(req.headers?.['user-agent'] || '');
  if (requestedPeriod !== periodKey) {
    return res.status(400).json({ error: 'PERIOD_NOT_CURRENT', code: 'PERIOD_NOT_CURRENT' });
  }
  if (!sign) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid zodiac sign' });

  const snapshot = await getSignWeeklyHoroscopeSnapshot(sign, periodKey, language);
  if (!snapshot) return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_WEEKLY_NOT_READY' });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    reading: projectSignHoroscopeForWire(snapshot.reading, userAgent),
    source: snapshot.stale ? 'stale' : 'cache',
    stale: snapshot.stale,
  });
}
