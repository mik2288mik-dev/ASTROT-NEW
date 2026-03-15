import type { NextApiRequest, NextApiResponse } from 'next';
import { spendLumi } from '../../../../services/lumiService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, amount, reason } = req.body || {};

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: 'amount is required' });
  }
  const numAmount = Math.floor(Number(amount));
  if (!Number.isInteger(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive integer' });
  }
  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    const result = await spendLumi(userId, numAmount, reason.trim());
    return res.status(200).json({
      success: true,
      balance: result.balance,
      spent: numAmount,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to spend Lumi';
    const isInsufficient = msg.toLowerCase().includes('insufficient');
    console.error('[API/users/lumi/spend] Error:', msg);
    return res.status(isInsufficient ? 402 : 400).json({ error: msg });
  }
}
