import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { unlockContentLayer } from '../../../lib/contentArchitecture';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    chartId,
    accessTier,
    contentSurface,
    contentVariant,
    cacheKey,
    lumiCost,
  } = req.body || {};

  if (!userId || !accessTier || !contentSurface || !contentVariant) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'userId, accessTier, contentSurface and contentVariant are required',
    });
  }

  const user = await db.users.get(String(userId));
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  try {
    const result = await unlockContentLayer({
      userId: String(userId),
      chartId: chartId != null ? Number(chartId) : null,
      accessTier,
      contentSurface,
      contentVariant,
      cacheKey,
      lumiCost,
    });

    const balance = await db.lumi_transactions.getBalance(String(userId));

    return res.status(200).json({
      success: true,
      unlock: result.unlock,
      via: result.via,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
      lumiBalance: balance,
    });
  } catch (error: any) {
    const code = error?.message || 'UNLOCK_FAILED';
    const status = code === 'PREMIUM_REQUIRED' ? 403 : code === 'LUMI_COST_REQUIRED' ? 400 : code.includes('Insufficient Lumi balance') ? 402 : 500;

    return res.status(status).json({
      error: 'Unlock failed',
      code,
      message: user.language === 'ru'
        ? (code === 'PREMIUM_REQUIRED'
            ? 'Для этого открытия нужен Lumia Premium.'
            : code === 'LUMI_COST_REQUIRED'
              ? 'Нужно указать стоимость открытия в Lumi.'
              : code.includes('Insufficient Lumi balance')
                ? 'Недостаточно Lumi для этого открытия.'
                : 'Не удалось открыть этот слой контента.')
        : (code === 'PREMIUM_REQUIRED'
            ? 'Lumia Premium is required for this unlock.'
            : code === 'LUMI_COST_REQUIRED'
              ? 'A Lumi cost is required for this unlock.'
              : code.includes('Insufficient Lumi balance')
                ? 'Not enough Lumi for this unlock.'
                : 'Failed to unlock this content layer.'),
    });
  }
}
