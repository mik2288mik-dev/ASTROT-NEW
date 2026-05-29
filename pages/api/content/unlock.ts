import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { unlockContentLayer } from '../../../lib/contentArchitecture';
import { normalizeStoredAccessTier } from '../../../lib/contentAccessTier';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    chartId,
    accessTier: rawAccessTier,
    contentSurface,
    contentVariant,
    cacheKey,
    starsAmount,
    starsPaymentChargeId,
    /** @deprecated legacy alias */
    lumiCost,
  } = req.body || {};

  const accessTier = normalizeStoredAccessTier(rawAccessTier);

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
      starsAmount: starsAmount ?? lumiCost,
      starsPaymentChargeId,
    });

    return res.status(200).json({
      success: true,
      unlock: result.unlock,
      via: result.via,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
    });
  } catch (error: any) {
    const code = error?.message || 'UNLOCK_FAILED';
    const status =
      code === 'PREMIUM_REQUIRED'
        ? 403
        : code === 'STARS_AMOUNT_REQUIRED'
          ? 400
          : code === 'STARS_PAYMENT_REQUIRED'
            ? 409
            : 500;

    return res.status(status).json({
      error: 'Unlock failed',
      code,
      message: user.language === 'ru'
        ? (code === 'PREMIUM_REQUIRED'
            ? 'Для этого открытия нужен Lumia Premium.'
            : code === 'STARS_AMOUNT_REQUIRED'
              ? 'Нужно указать стоимость открытия в Stars.'
              : code === 'STARS_PAYMENT_REQUIRED'
                ? 'Для разового открытия нужна подтверждённая оплата Stars.'
                : 'Не удалось открыть этот слой контента.')
        : (code === 'PREMIUM_REQUIRED'
            ? 'Lumia Premium is required for this unlock.'
            : code === 'STARS_AMOUNT_REQUIRED'
              ? 'A Stars cost is required for this unlock.'
              : code === 'STARS_PAYMENT_REQUIRED'
                ? 'A confirmed Stars payment is required for this one-off unlock.'
                : 'Failed to unlock this content layer.'),
    });
  }
}
