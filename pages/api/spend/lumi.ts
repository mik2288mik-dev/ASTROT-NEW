import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/spend/lumi] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/spend/lumi] ERROR: ${message}`, error || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, card_id, item, cost } = req.body;

  if (!userId || !card_id || !item || cost === undefined) {
    return res.status(400).json({ error: 'userId, card_id, item, and cost are required' });
  }

  const costNum = parseInt(String(cost), 10);
  if (isNaN(costNum) || costNum < 0) {
    return res.status(400).json({ error: 'cost must be a non-negative number' });
  }

  try {
    const balance = await db.users.getBalance(userId);
    if (balance < costNum) {
      return res.status(400).json({
        error: 'Insufficient balance',
        balance,
        required: costNum,
      });
    }

    const { balance: newBalance } = await db.users.decrementBalance(userId, costNum);

    await db.purchases.create({
      user_id: userId,
      type: 'spend',
      amount_lumi: -costNum,
      item_id: item,
      status: 'success',
    });

    if (item === 'full_report') {
      await db.cards.markFullPurchased(parseInt(String(card_id), 10), userId);
    } else if (item === 'pro_report') {
      await db.cards.markProPurchased(parseInt(String(card_id), 10), userId);
    }

    log.info('Lumi spent', { userId, card_id, item, cost: costNum, newBalance });

    return res.status(200).json({
      success: true,
      balance: newBalance,
    });
  } catch (error: any) {
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    log.error('Error spending lumi', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
