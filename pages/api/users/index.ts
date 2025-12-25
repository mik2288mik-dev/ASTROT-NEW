import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/users] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/users] ERROR: ${message}`, error || '');
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  log.info(`Request received`, {
    method: req.method,
    path: req.url
  });

  try {
    if (req.method === 'GET') {
      // Get all users (for admin panel)
      log.info('[GET] Fetching all users');
      const users = await db.users.getAll();

      // Transform to client format
      const clientUsers = users.map((user: any) => ({
        id: user.id,
        name: user.name,
        birthDate: user.birth_date,
        birthTime: user.birth_time,
        birthPlace: user.birth_place,
        isSetup: user.is_setup,
        language: user.language,
        theme: user.theme,
        isPremium: user.is_premium,
        isAdmin: user.is_admin,
        evolution: user.evolution,
      }));

      log.info(`[GET] Found ${clientUsers.length} users`);

      return res.status(200).json(clientUsers);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
