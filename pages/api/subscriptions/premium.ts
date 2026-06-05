import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/subscriptions/premium] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/subscriptions/premium] ERROR: ${message}`, error || '');
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;
  const id = Array.isArray(userId) ? userId[0] : userId;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    requireTelegramUserId(req, id);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  log.info('Request received', {
    method: req.method,
    userId: id,
    path: req.url
  });

  try {
    if (req.method === 'POST') {
      if (process.env.BOT_TOKEN) {
        return res.status(410).json({
          error: 'Deprecated',
          message: 'Use Telegram Stars flow: create-invoice -> openInvoice -> webhook. This route is disabled when BOT_TOKEN is set.',
        });
      }

      // Legacy/sim only: direct activation when BOT_TOKEN not set.
      const { starsAmount, transactionId } = req.body;

      log.info('Activating premium (legacy/sim)', { userId: id, starsAmount, transactionId });

      const user = await db.users.get(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const existingUntil = user.premium_until ? new Date(user.premium_until) : null;
      const now = new Date();
      const baseDate = existingUntil && existingUntil > now ? existingUntil : now;
      const premiumUntil = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db.users.set(id, { premium_until: premiumUntil.toISOString() });

      const updatedUser = await db.users.get(id);
      log.info('Premium activated (legacy)', { userId: id });

      const clientUser = {
        id: updatedUser!.id,
        name: updatedUser!.name,
        birthDate: updatedUser!.birth_date,
        birthTime: updatedUser!.birth_time,
        birthPlace: updatedUser!.birth_place,
        isSetup: updatedUser!.is_setup,
        language: updatedUser!.language,
        theme: updatedUser!.theme,
        isPremium: updatedUser!.is_premium,
        isAdmin: updatedUser!.is_admin,
        loginStreak: updatedUser!.login_streak ?? 0,
      };

      return res.status(200).json({
        success: true,
        user: clientUser
      });
    }

    if (req.method === 'GET') {
      // Check premium status
      log.info('Checking premium status', { userId: id });
      
      const user = await db.users.get(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        isPremium: user.is_premium || false,
        activatedAt: user.premium_until || null,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack,
      userId: id
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
