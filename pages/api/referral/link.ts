import type { NextApiRequest, NextApiResponse } from 'next';
import { db, queryDatabase } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/referral/link] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/referral/link] ERROR: ${message}`, error || ''),
};

function generateRefCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
    const rows = await queryDatabase('SELECT ref_code FROM users WHERE id = $1', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let refCode = rows[0].ref_code;

    if (!refCode) {
      refCode = generateRefCode();
      await db.users.setRefCode(id, refCode);
      log.info('Generated ref_code', { userId: id, refCode });
    }

    const botname = process.env.BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'botname';
    const link = `https://t.me/${botname}?start=${refCode}`;

    return res.status(200).json({
      ref_code: refCode,
      link,
    });
  } catch (error: any) {
    log.error('Error getting referral link', { error: error.message, userId: id });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
