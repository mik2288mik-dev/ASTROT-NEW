import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const chartId = typeof req.query.chartId === 'string' ? Number.parseInt(req.query.chartId, 10) : null;
  const periodKey = typeof req.query.periodKey === 'string' && req.query.periodKey.trim()
    ? req.query.periodKey.trim()
    : undefined;

  if (!userId) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: user.language === 'ru'
        ? 'Живой слой карты доступен в Lumia Premium.'
        : 'The living natal layer is available in Lumia Premium.',
    });
  }

  const result = await getContentLayer({
    userId,
    chartId,
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'living',
    cacheKey: periodKey,
  });

  if (!result.interpretation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'NATAL_LIVING_NOT_FOUND',
      message: user.language === 'ru'
        ? 'Живой слой карты пока не подготовлен.'
        : 'The living natal layer is not ready yet.',
    });
  }

  return res.status(200).json({
    interpretation: result.interpretation,
    source: result.source,
    chartId: result.chartId,
    cacheKey: result.cacheKey,
    entitlement: entitlement.entitlement,
  });
}
