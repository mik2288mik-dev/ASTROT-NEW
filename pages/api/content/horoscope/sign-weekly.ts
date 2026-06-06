import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { getMoscowIsoWeekKey, isValidMoscowIsoWeekKey } from '../../../../lib/date-utils';
import { normalizeZodiacKey } from '../../../../lib/horoscope/signDaily';
import { getCachedSignWeeklyHoroscope, getOrGenerateSignWeeklyHoroscope } from '../../../../lib/horoscope/signWeekly';
import { buildContentGenerationLockKey, generationInProgressPayload, withContentGenerationLock } from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 45 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const source = req.method === 'GET' ? req.query : req.body;
  const sign = normalizeZodiacKey(String(source?.sign || ''));
  const requestedPeriod = String(source?.periodKey || '').trim();
  const periodKey = isValidMoscowIsoWeekKey(requestedPeriod) ? requestedPeriod : getMoscowIsoWeekKey();
  const language: Language = source?.language === 'en' ? 'en' : 'ru';
  if (!sign) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid zodiac sign' });

  if (req.method === 'GET') {
    const reading = await getCachedSignWeeklyHoroscope(sign, periodKey, language);
    if (!reading) return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_WEEKLY_NOT_READY' });
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).json({ reading, source: 'cache' });
  }

  const result = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: `sign-weekly:${sign}:${language}`,
      accessTier: 'free', contentSurface: 'forecast', contentVariant: 'weekly', cacheKey: periodKey,
    }),
    operation: `sign-weekly-${sign}-${language}-${periodKey}`,
    readCached: async () => {
      const cached = await getCachedSignWeeklyHoroscope(sign, periodKey, language);
      return cached ? { value: cached, source: 'cache' } : null;
    },
    generate: () => getOrGenerateSignWeeklyHoroscope(sign, periodKey, language),
  });
  if (result.status === 'in_progress') return res.status(202).json(generationInProgressPayload(result.retryAfterMs));
  res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
  return res.status(200).json({ reading: result.value, source: result.fromCache ? 'cache' : 'generated' });
}
