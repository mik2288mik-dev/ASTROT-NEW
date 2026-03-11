import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/purchase/slot] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/purchase/slot] ERROR: ${message}`, error || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, slots } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const slotsNum = parseInt(String(slots), 10);
  if (slotsNum !== 1 && slotsNum !== 5) {
    return res.status(400).json({ error: 'slots must be 1 or 5' });
  }

  try {
    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.purchases.create({
      user_id: userId,
      type: 'slot',
      item_id: `slots_${slotsNum}`,
      status: 'success',
    });

    log.info('Slot purchase logged', { userId, slots: slotsNum });

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    log.error('Error logging slot purchase', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
