import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { buildContentGenerationLockKey, generationInProgressPayload, withContentGenerationLock } from '../../../../lib/contentGenerationLock';
import { getCachedSignCompatibility, getOrGenerateSignCompatibility, normalizeSignPair } from '../../../../lib/synastry/signCompatibility';

export const config = { maxDuration: 45 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const source = req.method === 'GET' ? req.query : req.body;
  const language: Language = source?.language === 'en' ? 'en' : 'ru';
  const pair = normalizeSignPair(String(source?.signA || ''), String(source?.signB || ''));
  if (!pair) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Choose two zodiac signs' });

  if (req.method === 'GET') {
    const result = await getCachedSignCompatibility(pair[0], pair[1], language);
    if (!result) return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_COMPATIBILITY_NOT_READY' });
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, stale-while-revalidate=86400');
    return res.status(200).json({ result, source: 'cache' });
  }

  const generated = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({ userId: `sign-pair:${pair.join(':')}:${language}`, accessTier: 'free', contentSurface: 'synastry', contentVariant: 'brief', cacheKey: pair.join(':') }),
    operation: `sign-compatibility-${pair.join('-')}-${language}`,
    readCached: async () => {
      const cached = await getCachedSignCompatibility(pair[0], pair[1], language);
      return cached ? { value: cached, source: 'cache' } : null;
    },
    generate: () => getOrGenerateSignCompatibility(pair[0], pair[1], language),
  });
  if (generated.status === 'in_progress') return res.status(202).json(generationInProgressPayload(generated.retryAfterMs));
  res.setHeader('Cache-Control', 'public, s-maxage=31536000, stale-while-revalidate=86400');
  return res.status(200).json({ result: generated.value, source: generated.fromCache ? 'cache' : 'generated' });
}
