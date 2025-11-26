import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

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

  log.info('Request received', {
    method: req.method,
    userId: id,
    path: req.url
  });

  try {
    if (req.method === 'POST') {
      // Activate premium subscription
      const { starsAmount, transactionId } = req.body;

      log.info('Activating premium subscription', {
        userId: id,
        starsAmount,
        transactionId
      });

      // Get current user
      const user = await db.users.get(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user to premium
      const updatedUser = {
        ...user,
        is_premium: true,
        premium_activated_at: new Date().toISOString(),
        premium_stars_amount: starsAmount,
        premium_transaction_id: transactionId,
      };

      await db.users.set(id, updatedUser);

      log.info('Premium subscription activated successfully', {
        userId: id
      });

      // Transform to client format
      const clientUser = {
        id: updatedUser.id,
        name: updatedUser.name,
        birthDate: updatedUser.birth_date,
        birthTime: updatedUser.birth_time,
        birthPlace: updatedUser.birth_place,
        isSetup: updatedUser.is_setup,
        language: updatedUser.language,
        theme: updatedUser.theme,
        isPremium: updatedUser.is_premium,
        isAdmin: updatedUser.is_admin,
        threeKeys: updatedUser.three_keys,
        evolution: updatedUser.evolution,
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
        activatedAt: user.premium_activated_at || null,
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
