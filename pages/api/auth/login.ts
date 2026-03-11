import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyTelegramInitData, parseTelegramUserFromInitData } from '../../../lib/auth';
import { db, queryDatabase } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/auth/login] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/auth/login] ERROR: ${message}`, error || ''),
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData } = req.body;

  if (!initData || typeof initData !== 'string') {
    return res.status(401).json({ error: 'Invalid initData' });
  }

  if (!verifyTelegramInitData(initData)) {
    return res.status(401).json({ error: 'Invalid Telegram initData signature' });
  }

  const tgUser = parseTelegramUserFromInitData(initData);
  if (!tgUser) {
    return res.status(401).json({ error: 'Could not parse user from initData' });
  }

  const userId = tgUser.id;

  try {
    let user = await db.users.get(userId);
    const isNewUser = !user;

    if (isNewUser) {
      await db.users.set(userId, {
        name: tgUser.first_name || null,
        birth_date: null,
        birth_time: null,
        birth_place: null,
        is_setup: false,
        language: 'ru',
        theme: 'dark',
        is_premium: false,
        is_admin: false,
        evolution: null,
        generated_content: null,
        weather_city: null,
      });
      await db.users.incrementBalance(userId, 50);
      log.info('New user created', { userId, first_name: tgUser.first_name });
    }

    const rows = await queryDatabase(
      'SELECT id, name, balance, is_premium, premium_expires_at, ref_code FROM users WHERE id = $1',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(500).json({ error: 'Failed to load user' });
    }

    let refCode = rows[0].ref_code;
    if (!refCode) {
      refCode = generateRefCode();
      await db.users.setRefCode(userId, refCode);
    }

    const now = new Date();
    const expiresAt = rows[0].premium_expires_at ? new Date(rows[0].premium_expires_at) : null;
    const isPremium = rows[0].is_premium || (expiresAt && expiresAt > now);

    return res.status(200).json({
      success: true,
      user: {
        id: rows[0].id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? rows[0].name ?? null,
        balance: rows[0].balance ?? 0,
        is_premium: !!isPremium,
        premium_expires_at: expiresAt ? expiresAt.toISOString() : null,
        ref_code: refCode,
      },
    });
  } catch (error: any) {
    log.error('Login failed', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
