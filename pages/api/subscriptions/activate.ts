import type { NextApiRequest, NextApiResponse } from 'next';
import { activatePremium } from '../../../services/premiumService';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireTelegramPaymentUser } from '../../../lib/auth/appAuth';
import { getManagedPremiumPlan } from '../../../lib/premiumPlanSettings';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/subscriptions/activate] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/subscriptions/activate] ERROR: ${msg}`, err || ''),
};

/**
 * Explicit test-only simulation. Missing provider secrets never enable grants.
 * Real activation happens via Telegram webhook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.body?.userId ?? req.query.userId) as string;
  const simMode = req.body?.simMode === true;
  const type = (req.body?.type ?? req.query.type ?? 'premium_week') as string;

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    await requireTelegramPaymentUser(req, String(userId).trim());
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  if (!simMode) {
    return res.status(400).json({
      error: 'Real payments are processed via Telegram webhook. Use create-invoice + openInvoice for production.',
    });
  }

  const simulationEnabled = process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_TEST_PREMIUM_SIMULATION === '1';
  if (!simulationEnabled) {
    return res.status(403).json({
      error: 'Premium simulation is disabled',
      code: 'PREMIUM_SIMULATION_DISABLED',
    });
  }

  const plan = await getManagedPremiumPlan(type);
  if (!plan) {
    return res.status(400).json({
      error: 'Invalid activation type',
      code: 'INVALID_ACTIVATION_TYPE',
      message: 'Unsupported premium plan.',
    });
  }

  const chargeId = `sim_${type}_${userId}_${Date.now()}`;

  try {
    const starsAmount = plan.stars;
    const result = await activatePremium(userId, chargeId, starsAmount, { paymentType: plan.id, durationDays: plan.days });

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
