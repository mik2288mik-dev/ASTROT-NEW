import type { NextApiRequest, NextApiResponse } from 'next';
import { getBalance, getHistory } from '../../../../services/lumiService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.query.userId as string;
  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const balance = await getBalance(userId);
    const includeHistory = req.query.includeHistory === 'true';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const response: { lumi_balance: number; transactions?: { amount: number; reason: string; created_at: string }[] } = {
      lumi_balance: balance,
    };

    if (includeHistory) {
      response.transactions = await getHistory(userId, limit);
    }

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[API/users/lumi] Error:', error.message);
    return res.status(500).json({ error: 'Failed to get Lumi balance', message: error.message });
  }
}
