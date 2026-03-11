import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/referral/register] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/referral/register] ERROR: ${message}`, error || ''),
};

const REFERRAL_BONUS_LUMI = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, ref_code } = req.body;

  if (!userId || !ref_code) {
    return res.status(400).json({ error: 'userId and ref_code are required' });
  }

  try {
    const referrer = await db.users.getByRefCode(ref_code);
    if (!referrer) {
      return res.status(404).json({ error: 'Invalid ref_code' });
    }

    if (referrer.id === userId) {
      return res.status(400).json({ error: 'Cannot register referral for yourself' });
    }

    const existing = await db.referrals.exists(referrer.id, userId);
    if (existing) {
      return res.status(200).json({
        success: true,
        created: false,
      });
    }

    const referral = await db.referrals.create(referrer.id, userId);

    if (referral) {
      if (!(await db.users.get(userId))) {
        await db.users.set(userId, { is_setup: false });
      }
      await db.users.setReferredBy(userId, referrer.id);
      await db.users.incrementBalance(userId, REFERRAL_BONUS_LUMI);
      await db.purchases.create({
        user_id: userId,
        type: 'referral_bonus',
        amount_lumi: REFERRAL_BONUS_LUMI,
        item_id: 'referral_signup',
        status: 'success',
      });
      log.info('Referral registered, bonus given', { referrerId: referrer.id, referredId: userId });
    }

    return res.status(200).json({
      success: true,
      created: !!referral,
    });
  } catch (error: any) {
    log.error('Error registering referral', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
