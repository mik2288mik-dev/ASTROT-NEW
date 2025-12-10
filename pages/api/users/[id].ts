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
      const generatedContent = user.generated_content || {};
      const threeKeysFromGenerated = generatedContent.threeKeys || null;
      const threeKeys = threeKeysFromGenerated || user.three_keys;
      
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
        generatedContent: user.generated_content,
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

      // ВАЖНО: Получаем существующего пользователя для правильного объединения данных
      let existingUser = null;
      try {
        existingUser = await db.users.get(userId);
      } catch (e) {
        log.warn('[API/users/[id]] Failed to get existing user, will use new values', e);
      }
      
      // Transform data to match database schema
      // Синхронизируем threeKeys: если есть в generatedContent, сохраняем и там, и в отдельном поле
      
      // ВАЖНО: Проверяем, был ли generatedContent явно передан в запросе
      // Если не передан - сохраняем существующий из БД
      log.info(`[${req.method}] ===== PROCESSING GENERATED CONTENT =====`);
      log.info(`[${req.method}] userData.generatedContent !== undefined:`, userData.generatedContent !== undefined);
      log.info(`[${req.method}] userData.generatedContent !== null:`, userData.generatedContent !== null);
      log.info(`[${req.method}] existingUser?.generated_content exists:`, !!existingUser?.generated_content);
      
      let finalGeneratedContent = existingUser?.generated_content || null;
      let threeKeysToSave = null;
      
      if (userData.generatedContent !== undefined && userData.generatedContent !== null) {
        // Если generatedContent передан явно - используем его
        log.info(`[${req.method}] Using provided generatedContent`);
        const generatedContent = userData.generatedContent;
        threeKeysToSave = generatedContent.threeKeys || userData.threeKeys || null;
        
        // Обновляем generatedContent.threeKeys если его нет, но есть в userData.threeKeys
        const updatedGeneratedContent = threeKeysToSave && !generatedContent.threeKeys
          ? { ...generatedContent, threeKeys: threeKeysToSave }
          : generatedContent;
        
        // Если передан непустой объект - используем его
        if (Object.keys(updatedGeneratedContent).length > 0) {
          finalGeneratedContent = updatedGeneratedContent;
          log.info(`[${req.method}] Using provided generatedContent with`, Object.keys(updatedGeneratedContent).length, 'keys');
        } else {
          log.warn(`[${req.method}] Provided generatedContent is empty, keeping existing`);
          // Если передан пустой объект - сохраняем существующий (не перезаписываем)
        }
      } else {
        // Если generatedContent не передан - используем существующий из БД и синхронизируем threeKeys
        log.info(`[${req.method}] generatedContent not provided, using existing from DB`);
        threeKeysToSave = userData.threeKeys || finalGeneratedContent?.threeKeys || null;
        if (existingUser?.generated_content && threeKeysToSave && !finalGeneratedContent?.threeKeys) {
          // Обновляем threeKeys в существующем generatedContent если нужно
          log.info(`[${req.method}] Updating threeKeys in existing generatedContent`);
          finalGeneratedContent = {
            ...existingUser.generated_content,
            threeKeys: threeKeysToSave
          };
        } else if (finalGeneratedContent) {
          // Используем threeKeys из существующего generatedContent
          threeKeysToSave = finalGeneratedContent.threeKeys || threeKeysToSave;
        }
        
        log.info(`[${req.method}] Final generatedContent keys:`, finalGeneratedContent ? Object.keys(finalGeneratedContent) : []);
      }
      
      // ВАЖНО: Проверяем что finalGeneratedContent не потерялся
      if (!finalGeneratedContent && existingUser?.generated_content) {
        log.warn(`[${req.method}] ⚠️ WARNING: finalGeneratedContent is null but existingUser has generated_content! Restoring...`);
        finalGeneratedContent = existingUser.generated_content;
      }
      
      // ВАЖНО: Сохраняем weatherCity правильно - если передан, используем его, иначе сохраняем существующий
      log.info(`[${req.method}] ===== PROCESSING WEATHER CITY =====`);
      log.info(`[${req.method}] userData.weatherCity:`, userData.weatherCity);
      log.info(`[${req.method}] userData.weatherCity type:`, typeof userData.weatherCity);
      log.info(`[${req.method}] userData.weatherCity !== undefined:`, userData.weatherCity !== undefined);
      log.info(`[${req.method}] existingUser?.weather_city:`, existingUser?.weather_city);
      
      const weatherCityToSave = userData.weatherCity !== undefined 
        ? (userData.weatherCity ? String(userData.weatherCity).trim() : null)
        : (existingUser?.weather_city || null);
      
      log.info(`[${req.method}] weatherCityToSave (final):`, weatherCityToSave);
      log.info(`[${req.method}] weatherCityToSave type:`, typeof weatherCityToSave);
      log.info(`[${req.method}] weatherCityToSave length:`, weatherCityToSave ? weatherCityToSave.length : 0);
      
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
        generated_content: finalGeneratedContent,
        weather_city: weatherCityToSave,
      };
      
      log.info(`[${req.method}] ===== PREPARING TO SAVE USER DATA =====`);
      log.info(`[${req.method}] hasGeneratedContent:`, !!finalGeneratedContent);
      log.info(`[${req.method}] generatedContentKeys:`, finalGeneratedContent ? Object.keys(finalGeneratedContent).length : 0);
      log.info(`[${req.method}] generatedContent keys list:`, finalGeneratedContent ? Object.keys(finalGeneratedContent) : []);
      log.info(`[${req.method}] weatherCity:`, weatherCityToSave);
      log.info(`[${req.method}] dbUser.weather_city:`, dbUser.weather_city);
      log.info(`[${req.method}] dbUser.hasGeneratedContent:`, !!dbUser.generated_content);

      log.info(`[${req.method}] ===== CALLING db.users.set() =====`);
      const dbSetStartTime = Date.now();
      const savedUser = await db.users.set(userId, dbUser);
      const dbSetDuration = Date.now() - dbSetStartTime;
      
      log.info(`[${req.method}] ===== USER SAVED SUCCESSFULLY =====`);
      log.info(`[${req.method}] Save duration:`, dbSetDuration, 'ms');
      log.info(`[${req.method}] savedUser.weather_city:`, savedUser.weather_city);
      log.info(`[${req.method}] savedUser.weather_city type:`, typeof savedUser.weather_city);
      log.info(`[${req.method}] savedUser.hasGeneratedContent:`, !!savedUser.generated_content);
      log.info(`[${req.method}] savedUser.generatedContent keys:`, savedUser.generated_content ? Object.keys(savedUser.generated_content) : []);

      // Transform back to client format
      // Синхронизируем threeKeys при возврате
      const savedGeneratedContent = savedUser.generated_content || {};
      const syncedThreeKeys = savedGeneratedContent.threeKeys || savedUser.three_keys;
      
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
        generatedContent: savedUser.generated_content,
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
