import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/purchase/lumi] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/purchase/lumi] ERROR: ${message}`, error || ''),
};

const LUMI_PACKAGES: Record<string, number> = {
  lumi_100: 100,
  lumi_500: 500,
  lumi_1200: 1200,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, package: pkg } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const amount = LUMI_PACKAGES[pkg];
  if (!amount) {
    return res.status(400).json({ error: 'Invalid package. Use lumi_100, lumi_500, or lumi_1200' });
  }

  try {
    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { balance } = await db.users.incrementBalance(userId, amount);

    await db.purchases.create({
      user_id: userId,
      type: 'lumi',
      amount_lumi: amount,
      item_id: pkg,
      status: 'success',
    });

    log.info('Lumi purchased', { userId, pkg, amount, balance });

    return res.status(200).json({
      success: true,
      balance,
      amount,
    });
  } catch (error: any) {
    log.error('Error purchasing lumi', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
