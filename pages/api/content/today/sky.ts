import type { NextApiRequest, NextApiResponse } from 'next';
import { computeSkyToday } from '../../../../lib/horoscope/skyToday';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import type { SkyTodaySnapshot } from '../../../../lib/skyToday';

export const config = { maxDuration: 30 };

/**
 * GET /api/content/today/sky
 * Публичный snapshot Луны и Меркурия. Профиль пользователя не требуется.
 * При сбое эфемерид клиент получает null и скрывает блок, не блокируя startup.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SkyTodaySnapshot | { snapshot: null }>,
) {
  const dateKey = getMoscowTodayKey();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ snapshot: null });
  }

  try {
    const sky = await computeSkyToday(dateKey);
    // Совпадает с часовым серверным transit cache.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(sky);
  } catch (error: unknown) {
    console.error('[API/content/today/sky]', (error as { message?: string })?.message || error);
    return res.status(503).json({ snapshot: null });
  }
}
