import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';

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
    await requireAppUser(req, { expectedUserId: id, allowGuest: false });
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
      return res.status(410).json({
        error: 'PREMIUM_ACTIVATION_ROUTE_RETIRED',
        message: 'Use the verified store or Telegram payment flow.',
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
