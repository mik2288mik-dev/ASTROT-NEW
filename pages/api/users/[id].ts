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
      // Синхронизируем threeKeys: если есть в generatedContent, используем его, иначе из отдельного поля
      let generatedContent = user.generated_content;
      
      // Парсим generatedContent если это строка
      if (typeof generatedContent === 'string') {
        try {
          generatedContent = JSON.parse(generatedContent);
        } catch (e) {
          log.error('[GET] Failed to parse generated_content JSON', { error: e });
          generatedContent = {};
        }
      }
      
      const threeKeysFromGenerated = generatedContent?.threeKeys || null;
      const threeKeys = threeKeysFromGenerated || user.three_keys;
      
      log.info(`[GET] User profile loaded`, {
        userId: user.id,
        hasGeneratedContent: !!generatedContent,
        hasDailyHoroscope: !!generatedContent?.dailyHoroscope,
        dailyHoroscopeDate: generatedContent?.dailyHoroscope?.date,
        weatherCity: user.weather_city
      });
      
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
        threeKeys: threeKeys, // Синхронизированное значение
        evolution: user.evolution,
        generatedContent: generatedContent || {},
        weatherCity: user.weather_city && user.weather_city.trim() ? user.weather_city.trim() : undefined,
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
      // Синхронизируем threeKeys: если есть в generatedContent, сохраняем и там, и в отдельном поле
      const generatedContent = userData.generatedContent || {};
      const threeKeysToSave = generatedContent.threeKeys || userData.threeKeys || null;
      
      // Обновляем generatedContent.threeKeys если его нет, но есть в userData.threeKeys
      const updatedGeneratedContent = threeKeysToSave && !generatedContent.threeKeys
        ? { ...generatedContent, threeKeys: threeKeysToSave }
        : generatedContent;
      
      // Убеждаемся, что generated_content правильно сериализуется
      let generatedContentToSave = updatedGeneratedContent;
      if (Object.keys(updatedGeneratedContent).length > 0) {
        // Если есть данные, убеждаемся что это объект, а не строка
        if (typeof updatedGeneratedContent === 'string') {
          try {
            generatedContentToSave = JSON.parse(updatedGeneratedContent);
          } catch (e) {
            log.error('[POST] Failed to parse generatedContent, using as is', { error: e });
            generatedContentToSave = updatedGeneratedContent;
          }
        }
      } else {
        generatedContentToSave = null;
      }
      
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
        three_keys: threeKeysToSave, // Синхронизированное значение
        evolution: userData.evolution || null,
        generated_content: generatedContentToSave,
        weather_city: userData.weatherCity ? String(userData.weatherCity).trim() : null,
      };
      
      log.info(`[${req.method}] Saving user data`, {
        userId,
        hasGeneratedContent: !!generatedContentToSave,
        hasDailyHoroscope: !!generatedContentToSave?.dailyHoroscope,
        dailyHoroscopeDate: generatedContentToSave?.dailyHoroscope?.date,
        weatherCity: dbUser.weather_city
      });

      const savedUser = await db.users.set(userId, dbUser);
      
      log.info(`[${req.method}] User saved successfully: ${userId}`, {
        weatherCity: dbUser.weather_city,
        hasGeneratedContent: !!dbUser.generated_content,
        hasDailyHoroscope: !!JSON.parse(dbUser.generated_content || '{}')?.dailyHoroscope
      });

      // Transform back to client format
      // Синхронизируем threeKeys при возврате
      let savedGeneratedContent = savedUser.generated_content;
      if (typeof savedGeneratedContent === 'string') {
        try {
          savedGeneratedContent = JSON.parse(savedGeneratedContent);
        } catch (e) {
          log.error('[POST] Failed to parse saved generated_content JSON', { error: e });
          savedGeneratedContent = {};
        }
      }
      
      const syncedThreeKeys = savedGeneratedContent?.threeKeys || savedUser.three_keys;
      
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
        threeKeys: syncedThreeKeys, // Синхронизированное значение
        evolution: savedUser.evolution,
        generatedContent: savedGeneratedContent || {},
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
