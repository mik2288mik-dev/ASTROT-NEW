import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { buildContentGenerationLockKey, generationInProgressPayload, withContentGenerationLock } from '../../../../lib/contentGenerationLock';
import { getMoscowYearKey, isValidMoscowYearKey } from '../../../../lib/date-utils';
import { normalizeZodiacKey } from '../../../../lib/horoscope/signDaily';
import {
  buildSignYearlyCacheKey,
  getCachedSignYearlyHoroscope,
  getOrGenerateSignYearlyHoroscope,
} from '../../../../lib/horoscope/signYearly';

export const config = { maxDuration: 45 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const source = req.method === 'GET' ? req.query : req.body;
  const sign = normalizeZodiacKey(String(source?.sign || ''));
  const requestedPeriod = String(source?.periodKey || '').trim();
  const periodKey = isValidMoscowYearKey(requestedPeriod) ? requestedPeriod : getMoscowYearKey();
  const language: Language = source?.language === 'en' ? 'en' : 'ru';
  if (!sign) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid zodiac sign' });

  if (req.method === 'GET') {
    const reading = await getCachedSignYearlyHoroscope(sign, periodKey, language);
    if (!reading) return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_YEARLY_NOT_READY' });
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
    return res.status(200).json({ reading, source: 'cache' });
  }

  const cacheKey = buildSignYearlyCacheKey(sign, periodKey, language);
  const result = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: `sign-yearly:${sign}:${language}`,
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'yearly',
      cacheKey,
    }),
    operation: `sign-yearly-${cacheKey}`,
    readCached: async () => {
      const cached = await getCachedSignYearlyHoroscope(sign, periodKey, language);
      return cached ? { value: cached, source: 'cache' } : null;
    },
    generate: () => getOrGenerateSignYearlyHoroscope(sign, periodKey, language),
  });
  if (result.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(result.retryAfterMs));
  }
  res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
  return res.status(200).json({
    reading: result.value,
    source: result.fromCache ? 'cache' : 'generated',
  });
}
