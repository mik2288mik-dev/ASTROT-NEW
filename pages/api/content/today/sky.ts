import type { NextApiRequest, NextApiResponse } from 'next';
import { computeSkyToday, type SkyTodayResult } from '../../../../lib/horoscope/skyToday';
import { getMoscowTodayKey } from '../../../../lib/date-utils';

export const config = { maxDuration: 30 };

/**
 * GET /api/content/today/sky
 * Публичные астро-факты на сегодня (ретроградные планеты). Без персональных данных.
 * При сбое эфемерид возвращает пустой список — экран «Сегодня» не ломается.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SkyTodayResult>,
) {
  const dateKey = getMoscowTodayKey();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(200).json({ date: dateKey, retrograde: [] });
  }

  try {
    const sky = computeSkyToday(dateKey);
    // Кэш на час на CDN, фоновое обновление сутки.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(sky);
  } catch (error: unknown) {
    console.error('[API/content/today/sky]', (error as { message?: string })?.message || error);
    // graceful: луна на клиенте всё равно покажется
    return res.status(200).json({ date: dateKey, retrograde: [] });
  }
}
