import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/users/[id]] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/users/[id]] ERROR: ${message}`, error || '');
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  log.info(`Request received`, {
    method: req.method,
    userId,
    path: req.url
  });

  try {
    if (req.method === 'GET') {
      // Get user profile
      log.info(`[GET] Fetching user: ${userId}`);
      const user = await db.users.get(userId);
      
      if (!user) {
        log.info(`[GET] User not found: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
      }

      log.info(`[GET] User found: ${userId}`, {
        hasName: !!user.name,
        isPremium: user.is_premium,
        isSetup: user.is_setup
      });

      // Transform database format (snake_case) to client format (camelCase)
      const clientUser = {
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
        threeKeys: user.three_keys,
        evolution: user.evolution,
        generatedContent: user.generated_content,
      };

      return res.status(200).json(clientUser);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Create or update user profile
      const userData = req.body;
      log.info(`[${req.method}] Saving user: ${userId}`, {
        hasName: !!userData.name,
        isPremium: userData.is_premium
      });

      // Transform data to match database schema
      const dbUser = {
        id: userId,
        name: userData.name,
        birth_date: userData.birthDate,
        birth_time: userData.birthTime,
        birth_place: userData.birthPlace,
        is_setup: userData.isSetup || false,
        language: userData.language || 'ru',
        theme: userData.theme || 'dark',
        is_premium: userData.isPremium || false,
        is_admin: userData.isAdmin || false,
        three_keys: userData.threeKeys || null,
        evolution: userData.evolution || null,
        generated_content: userData.generatedContent || null,
      };

      const savedUser = await db.users.set(userId, dbUser);
      
      log.info(`[${req.method}] User saved successfully: ${userId}`);

      // Transform back to client format
      const clientUser = {
        id: savedUser.id,
        name: savedUser.name,
        birthDate: savedUser.birth_date,
        birthTime: savedUser.birth_time,
        birthPlace: savedUser.birth_place,
        isSetup: savedUser.is_setup,
        language: savedUser.language,
        theme: savedUser.theme,
        isPremium: savedUser.is_premium,
        isAdmin: savedUser.is_admin,
        threeKeys: savedUser.three_keys,
        evolution: savedUser.evolution,
        generatedContent: savedUser.generated_content,
      };

      return res.status(200).json(clientUser);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
