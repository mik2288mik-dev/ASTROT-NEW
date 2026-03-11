import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/purchase/premium] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/purchase/premium] ERROR: ${message}`, error || ''),
};

const PLAN_MONTHS: Record<string, number> = {
  month: 1,
  '3months': 3,
  '6months': 6,
  year: 12,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, plan } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const months = PLAN_MONTHS[plan];
  if (!months) {
    return res.status(400).json({ error: 'Invalid plan. Use month, 3months, 6months, or year' });
  }

  try {
    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + months);

    await db.users.set(userId, { ...user, is_premium: true });
    await db.users.setPremiumExpiry(userId, expiresAt);

    await db.purchases.create({
      user_id: userId,
      type: 'premium',
      item_id: plan,
      status: 'success',
    });

    log.info('Premium purchased', { userId, plan, months, expiresAt });

    return res.status(200).json({
      success: true,
      premium_expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    log.error('Error purchasing premium', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
