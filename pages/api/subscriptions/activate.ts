import type { NextApiRequest, NextApiResponse } from 'next';
import { activatePremium } from '../../../services/premiumService';
import { activateLumiPackPurchase } from '../../../services/lumiTopUpService';
import { getLumiPack } from '../../../services/lumiPacks';
import { db } from '../../../lib/db';

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
      if (!packId) {
        return res.status(400).json({ error: 'packId is required for lumi_pack' });
      }
      const pack = getLumiPack(packId);
      if (!pack) {
        return res.status(400).json({ error: 'Invalid Lumi pack' });
      }

      const lumiResult = await activateLumiPackPurchase(userId, chargeId, pack.starsAmount, pack.id);
      const user = await db.users.get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        activated: lumiResult.activated,
        user: {
          id: user.id,
          isPremium: user.is_premium || false,
          premiumUntil: user.premium_until ?? null,
          lumiBalance: user.lumi_balance ?? 0,
          loginStreak: user.login_streak ?? 0,
        },
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
        lumiBalance: user.lumi_balance ?? 0,
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
