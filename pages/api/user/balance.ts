import type { NextApiRequest, NextApiResponse } from 'next';
import { queryDatabase } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/user/balance] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/user/balance] ERROR: ${message}`, error || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;
  const id = Array.isArray(userId) ? userId[0] : userId;

  if (!id) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const rows = await queryDatabase(
      'SELECT balance, is_premium, premium_expires_at FROM users WHERE id = $1',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = rows[0];
    const now = new Date();
    const expiresAt = row.premium_expires_at ? new Date(row.premium_expires_at) : null;
    const isPremium = row.is_premium || (expiresAt && expiresAt > now);

    return res.status(200).json({
      balance: row.balance ?? 0,
      is_premium: !!isPremium,
      premium_expires_at: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (error: any) {
    log.error('Error getting balance', { error: error.message, userId: id });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
