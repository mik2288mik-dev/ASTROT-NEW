import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { normalizeStoredAccessTier } from '../../../lib/contentAccessTier';
import {
  StarsPaymentError,
  unlockContentAfterStarsPayment,
} from '../../../lib/starsContentUnlock';

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
    telegramPaymentChargeId,
    /** @deprecated legacy alias */
    lumiCost,
  } = req.body || {};

  const accessTier = normalizeStoredAccessTier(rawAccessTier);
  const chargeId = String(starsPaymentChargeId || telegramPaymentChargeId || '').trim();
  const amount = Number(starsAmount ?? lumiCost ?? 0);

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
    if (accessTier === 'stars') {
      const result = await unlockContentAfterStarsPayment({
        userId: String(userId),
        chartId: chartId != null ? Number(chartId) : null,
        contentSurface,
        contentVariant,
        cacheKey,
        starsAmount: amount,
        starsPaymentChargeId: chargeId,
        allowUnscopedCacheKey: contentSurface === 'question' && contentVariant === 'one_off',
      });

      return res.status(200).json({
        success: true,
        unlock: result.unlock,
        via: result.via,
        chartId: result.chartId,
        cacheKey: result.cacheKey,
      });
    }

    return res.status(400).json({
      error: 'Unlock failed',
      code: 'UNSUPPORTED_ACCESS_TIER',
      message: 'Only stars one-off unlocks are supported on this endpoint.',
    });
  } catch (error: any) {
    const code = error instanceof StarsPaymentError
      ? error.code
      : (error?.message || 'UNLOCK_FAILED');
    const status =
      code === 'PREMIUM_REQUIRED'
        ? 403
        : code === 'STARS_AMOUNT_REQUIRED'
          ? 400
          : code === 'STARS_PAYMENT_REQUIRED' ||
              code === 'STARS_PAYMENT_NOT_FOUND' ||
              code === 'STARS_PAYMENT_NOT_CONFIRMED'
            ? 409
          : code === 'STARS_PAYMENT_USER_MISMATCH' ||
              code === 'STARS_PAYMENT_AMOUNT_MISMATCH' ||
              code === 'STARS_PAYMENT_CONTENT_MISMATCH'
            ? 403
          : code === 'STARS_PAYMENT_ALREADY_CONSUMED'
            ? 409
            : 500;

    return res.status(status).json({
      error: 'Unlock failed',
      code,
      message: user.language === 'ru'
        ? (code === 'STARS_PAYMENT_NOT_FOUND'
            ? 'Оплата Stars не найдена. Сначала завершите Telegram payment.'
            : code === 'STARS_PAYMENT_ALREADY_CONSUMED'
              ? 'Эта оплата Stars уже использована.'
              : code === 'STARS_PAYMENT_USER_MISMATCH'
                ? 'Оплата Stars принадлежит другому пользователю.'
                : code === 'STARS_PAYMENT_AMOUNT_MISMATCH'
                  ? 'Сумма оплаты Stars не совпадает с ценой unlock.'
                  : code === 'STARS_PAYMENT_CONTENT_MISMATCH'
                    ? 'Оплата Stars не подходит для этого unlock.'
                    : 'Не удалось открыть этот слой контента.')
        : (code === 'STARS_PAYMENT_NOT_FOUND'
            ? 'Stars payment not found. Complete Telegram payment first.'
            : code === 'STARS_PAYMENT_ALREADY_CONSUMED'
              ? 'This Stars payment has already been used.'
              : code === 'STARS_PAYMENT_USER_MISMATCH'
                ? 'Stars payment belongs to another user.'
                : code === 'STARS_PAYMENT_AMOUNT_MISMATCH'
                  ? 'Stars payment amount does not match unlock price.'
                  : code === 'STARS_PAYMENT_CONTENT_MISMATCH'
                    ? 'Stars payment does not match this unlock.'
                    : 'Failed to unlock this content layer.'),
    });
  }
}
