import type { NextApiRequest, NextApiResponse } from 'next';
import { processDailyLogin } from '../../../services/streakService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.body?.userId ?? req.query.userId) as string;
  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const result = await processDailyLogin(userId);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found', message: error.message });
    }
    console.error('[API/users/daily-login] Error:', error.message);
    return res.status(500).json({ error: 'Failed to process daily login', message: error.message });
  }
}
