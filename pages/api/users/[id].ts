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
  warn: (message: string, error?: any) => {
    console.warn(`[API/users/[id]] WARN: ${message}`, error || '');
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
      
      // Проверяем доступность БД
      if (!process.env.DATABASE_URL) {
        log.warn(`[GET] DATABASE_URL not configured, returning 404`);
        return res.status(404).json({ error: 'User not found' });
      }
      
      let user;
      try {
        user = await db.users.get(userId);
      } catch (dbError: any) {
        log.error(`[GET] Database error`, { error: dbError.message });
        return res.status(500).json({ error: 'Database error', message: dbError.message });
      }
      
      if (!user) {
        log.info(`[GET] User not found: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
      }

      log.info(`[GET] User found: ${userId}`, {
        hasName: !!user.name,
        isPremium: user.is_premium,
        isSetup: user.is_setup
      });

      // Fetch generated content from interpretations (Lumia schema)
      let generatedContent: { natalIntro?: string; deepDiveAnalyses?: Record<string, string> } | null = null;
      try {
        const natalIntro = await db.interpretations.getByHash(userId, 'natal_intro', 'default');
        const deepDiveTypes = ['deep_dive_personality', 'deep_dive_love', 'deep_dive_career', 'deep_dive_weakness', 'deep_dive_karma'];
        const topics = ['personality', 'love', 'career', 'weakness', 'karma'];
        const deepDiveAnalyses: Record<string, string> = {};
        for (let i = 0; i < deepDiveTypes.length; i++) {
          const row = await db.interpretations.getByHash(userId, deepDiveTypes[i], topics[i]);
          if (row?.content) deepDiveAnalyses[topics[i]] = row.content;
        }
        if (natalIntro?.content || Object.keys(deepDiveAnalyses).length > 0) {
          generatedContent = {
            ...(natalIntro?.content ? { natalIntro: natalIntro.content } : {}),
            ...(Object.keys(deepDiveAnalyses).length > 0 ? { deepDiveAnalyses } : {}),
          };
        }
      } catch (_e) {}

      const lumiBalance = user.lumi_balance ?? 0;

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
        evolution: null,
        generatedContent,
        weatherCity: user.weather_city && user.weather_city.trim() ? user.weather_city.trim() : undefined,
        lumiBalance,
      };

      return res.status(200).json(clientUser);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Create or update user profile
      const userData = req.body;
      log.info(`[${req.method}] Saving user: ${userId}`, {
        hasName: !!userData.name,
        isPremium: userData.isPremium
      });

      // Проверяем доступность БД
      if (!process.env.DATABASE_URL) {
        log.error(`[${req.method}] DATABASE_URL not configured`);
        return res.status(500).json({ 
          error: 'Database not configured',
          message: 'DATABASE_URL is not set. Please configure the database connection.'
        });
      }

      // ВАЖНО: Получаем существующего пользователя для правильного объединения данных
      let existingUser = null;
      try {
        existingUser = await db.users.get(userId);
      } catch (e) {
        log.warn('[API/users/[id]] Failed to get existing user, will use new values', e);
      }
      
      let weatherCityToSave: string | null = undefined as any;
      if (userData.weatherCity !== undefined) {
        weatherCityToSave = (userData.weatherCity === null || userData.weatherCity === '')
          ? null
          : (String(userData.weatherCity).trim() || null);
      } else if (existingUser?.weather_city) {
        weatherCityToSave = String(existingUser.weather_city).trim() || null;
      }

      const dbUser = {
        name: userData.name,
        birth_date: userData.birthDate,
        birth_time: userData.birthTime,
        birth_place: userData.birthPlace,
        is_setup: userData.isSetup || false,
        language: userData.language || 'ru',
        theme: userData.theme || 'dark',
        is_premium: userData.isPremium || false,
        is_admin: userData.isAdmin || false,
        weather_city: weatherCityToSave,
      };

      const savedUser = await db.users.set(userId, dbUser);

      let generatedContent: { natalIntro?: string } | null = null;
      try {
        const natalIntro = await db.interpretations.getByHash(userId, 'natal_intro', 'default');
        if (natalIntro?.content) generatedContent = { natalIntro: natalIntro.content };
      } catch (_e) {}

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
        evolution: null,
        generatedContent,
        weatherCity: savedUser.weather_city && savedUser.weather_city.trim() ? savedUser.weather_city.trim() : undefined,
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
