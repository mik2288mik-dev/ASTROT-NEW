import type { NextApiRequest, NextApiResponse } from 'next';
import { activatePremium } from '../../../services/premiumService';
import { db } from '../../../lib/db';
import { getStarsAmountForInvoiceType } from '../../../lib/starsInvoiceCatalog';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/subscriptions/activate] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/subscriptions/activate] ERROR: ${msg}`, err || ''),
};

/**
 * Sim-only activation when BOT_TOKEN is not set.
 * Real activation happens via Telegram webhook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.body?.userId ?? req.query.userId) as string;
  const simMode = req.body?.simMode === true;
  const type = (req.body?.type ?? req.query.type ?? 'premium_week') as string;
  const packId = (req.body?.packId ?? req.query.packId) as string | undefined;

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (simMode && process.env.BOT_TOKEN) {
    return res.status(403).json({ error: 'Sim mode not allowed when BOT_TOKEN is set' });
  }

  if (!simMode) {
    return res.status(400).json({
      error: 'Real payments are processed via Telegram webhook. Use create-invoice + openInvoice for production.',
    });
  }

  const chargeId = `sim_${type}_${userId}_${Date.now()}`;

  try {
    if (type === 'lumi_pack') {
      return res.status(410).json({
        error: 'Lumi packs deprecated',
        code: 'LUMI_PACKS_DEPRECATED',
        message: 'Lumi packs are no longer available. Use Telegram Stars one-off unlocks or Premium.',
      });
    }

    if (type === 'ask_lumia_one_off') {
      const paymentNonce = String(req.body?.paymentNonce || req.query.paymentNonce || '').trim();
      if (!paymentNonce) {
        return res.status(400).json({ error: 'paymentNonce is required for ask_lumia_one_off sim activation' });
      }

      const starsAmount = getStarsAmountForInvoiceType('ask_lumia_one_off');
      const simChargeId = `sim_ask_lumia_${userId}_${paymentNonce}`;
      await db.star_payments.recordFromWebhook({
        telegramPaymentChargeId: simChargeId,
        userId,
        starsAmount,
        paymentType: 'content_unlock',
        contentSurface: 'question',
        contentVariant: 'one_off',
        payloadJson: {
          u: userId,
          t: 'ask_lumia_one_off',
          a: starsAmount,
          n: paymentNonce,
          s: 'question',
          v: 'one_off',
        },
        status: 'confirmed',
      });

      return res.status(200).json({
        success: true,
        activated: true,
        simMode: true,
        type,
        paymentNonce,
        starsAmount,
      });
    }

    if (type === 'forecast_full_day') {
      const paymentNonce = String(req.body?.paymentNonce || req.query.paymentNonce || '').trim();
      const dateKey = String(req.body?.date || req.query.date || req.body?.cacheKey || req.query.cacheKey || '').trim();
      if (!paymentNonce) {
        return res.status(400).json({ error: 'paymentNonce is required for forecast_full_day sim activation' });
      }
      if (!dateKey) {
        return res.status(400).json({ error: 'date or cacheKey is required for forecast_full_day sim activation' });
      }

      const starsAmount = getStarsAmountForInvoiceType('forecast_full_day');
      const chartIdRaw = req.body?.chartId ?? req.query.chartId;
      const chartId = chartIdRaw != null && chartIdRaw !== '' ? Number(chartIdRaw) : null;
      const simChargeId = `sim_forecast_full_day_${userId}_${paymentNonce}`;
      await db.star_payments.recordFromWebhook({
        telegramPaymentChargeId: simChargeId,
        userId,
        starsAmount,
        paymentType: 'content_unlock',
        contentSurface: 'forecast',
        contentVariant: 'full',
        chartId: Number.isFinite(chartId as number) ? Number(chartId) : null,
        cacheKey: dateKey,
        payloadJson: {
          u: userId,
          t: 'forecast_full_day',
          a: starsAmount,
          n: paymentNonce,
          s: 'forecast',
          v: 'full',
          k: dateKey,
          ...(Number.isFinite(chartId as number) ? { i: Number(chartId) } : {}),
        },
        status: 'confirmed',
      });

      return res.status(200).json({
        success: true,
        activated: true,
        simMode: true,
        type,
        paymentNonce,
        starsAmount,
        date: dateKey,
        cacheKey: dateKey,
      });
    }

    const starsAmount = 250;
    const result = await activatePremium(userId, chargeId, starsAmount);

    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const premiumUntil = user.premium_until ? new Date(user.premium_until) : null;
    const isPremium = premiumUntil && premiumUntil > new Date();

    return res.status(200).json({
      success: true,
      activated: result.activated,
      user: {
        id: user.id,
        isPremium,
        premiumUntil: premiumUntil?.toISOString() ?? null,
        loginStreak: user.login_streak ?? 0,
      },
    });
  } catch (error: any) {
    log.error('Activation failed', { userId, error: error.message });
    return res.status(500).json({
      error: 'Activation failed',
      message: error.message,
    });
  }
}
