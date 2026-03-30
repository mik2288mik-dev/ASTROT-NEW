import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';

const ALLOWED_SLOTS = new Set(['morning', 'day', 'evening']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const chartId = typeof req.query.chartId === 'string' ? Number.parseInt(req.query.chartId, 10) : null;
  const slot = typeof req.query.slot === 'string' ? req.query.slot.trim() : '';
  const dateKey = typeof req.query.date === 'string' && req.query.date.trim()
    ? req.query.date.trim()
    : '';

  if (!userId || !slot) {
    return res.status(400).json({ error: 'Bad request', message: 'userId and slot are required' });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return res.status(400).json({ error: 'Bad request', message: 'slot must be one of morning, day, evening' });
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
        ? 'Расширенный ритм дня доступен в Lumia Premium.'
        : 'The expanded day rhythm is available in Lumia Premium.',
    });
  }

  const cacheKey = dateKey ? `${dateKey}:${slot}` : undefined;
  const result = await getContentLayer({
    userId,
    chartId,
    accessTier: 'premium',
    contentSurface: 'forecast',
    contentVariant: slot as 'morning' | 'day' | 'evening',
    cacheKey,
  });

  if (!result.interpretation) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'FORECAST_DAYPART_NOT_FOUND',
      message: user.language === 'ru'
        ? 'Прогноз на этот ритм дня пока не подготовлен.'
        : 'The forecast for this part of the day is not ready yet.',
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
