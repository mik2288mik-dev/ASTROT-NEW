import type { NextApiRequest, NextApiResponse } from 'next';
import { addLumi } from '../../../../services/lumiService';

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
    const result = await addLumi(userId, numAmount, reason.trim());
    return res.status(200).json({
      success: true,
      balance: result.balance,
      added: numAmount,
    });
  } catch (error: any) {
    console.error('[API/users/lumi/add] Error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to add Lumi' });
  }
}
