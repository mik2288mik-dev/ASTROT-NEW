import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getContentLayer } from '../../../../lib/contentArchitecture';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const chartId = typeof req.query.chartId === 'string' ? Number.parseInt(req.query.chartId, 10) : null;

  if (!userId) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const result = await getContentLayer({
    userId,
    chartId,
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'anchor',
  });

  if (!result.interpretation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'NATAL_ANCHOR_NOT_FOUND',
      message: user.language === 'ru'
        ? 'Базовый разбор карты пока не найден.'
        : 'Base natal reading was not found yet.',
    });
  }

  return res.status(200).json({
    interpretation: result.interpretation,
    source: result.source,
    chartId: result.chartId,
    cacheKey: result.cacheKey,
  });
}
