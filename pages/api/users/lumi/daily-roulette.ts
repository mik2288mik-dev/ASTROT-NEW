import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string;
  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    if (req.method === 'GET') {
      const claimed = await db.roulette_spins.hasClaimedUtcToday(userId.trim());
      const balance = await db.lumi_transactions.getBalance(userId.trim());
      return res.status(200).json({ claimedToday: claimed, lumiBalance: balance });
    }

    if (req.method === 'POST') {
      const result = await db.roulette_spins.spinDailyReward(userId.trim());
      if (!result.ok) {
        return res.status(200).json({
          ok: false,
          code: result.code,
          lumiBalance: result.newBalance,
        });
      }
      return res.status(200).json({
        ok: true,
        amount: result.amount,
        tier: result.tier,
        lumiBalance: result.newBalance,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[API/users/lumi/daily-roulette]', error?.message);
    return res.status(500).json({ error: 'ROULETTE_FAILED', message: error?.message || 'Failed' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.LUMI_ACTION);
