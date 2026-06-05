import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/weather/settings] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/weather/settings] ERROR: ${message}`, error || '');
  },
};

/**
 * API для настроек погоды
 * 
 * GET /api/weather/settings?userId=xxx - получить настройки
 *   - Если есть: 200 + { city, ... }
 *   - Если нет: 200 + { city: null }
 * 
 * POST /api/weather/settings - сохранить настройки
 *   - Body: { userId, city }
 *   - Валидация: city 2-64 символа или null
 *   - 200 + сохранённые настройки
 *   - 400 при ошибке валидации
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  log.info(`Request: ${req.method}`);

  try {
    // ============ GET: Получить настройки ============
    if (req.method === 'GET') {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ 
          error: 'userId is required',
          message: 'Please provide userId query parameter'
        });
      }
      requireTelegramUserId(req, userId);

      log.info(`[GET] Fetching settings for userId=${userId}`);
      
      const user = await db.users.get(userId);
      const primaryChart = await db.natal_charts.getPrimary(userId);
      
      if (!user) {
        log.info(`[GET] DB_MISS: no user for userId=${userId}`);
        return res.status(200).json({ 
          userId,
          city: null,
          message: 'No settings found'
        });
      }

      log.info(`[GET] DB_HIT: settings found`, {
        city: user.weather_city
      });

      return res.status(200).json({
        userId: user.id,
        city: user.weather_city || null,
        lat: primaryChart?.latitude ?? null,
        lon: primaryChart?.longitude ?? null,
        units: null,
        updatedAt: null
      });
    }

    // ============ POST: Сохранить настройки ============
    if (req.method === 'POST') {
      const { userId, city } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          error: 'userId is required',
          message: 'Please provide userId in request body'
        });
      }
      requireTelegramUserId(req, userId);

      // Валидация города
      let validatedCity: string | null = null;
      
      if (city !== null && city !== undefined && city !== '') {
        const trimmed = String(city).trim();
        
        if (trimmed.length < 2) {
          return res.status(400).json({
            error: 'Invalid city',
            message: 'City name must be at least 2 characters'
          });
        }
        
        if (trimmed.length > 64) {
          return res.status(400).json({
            error: 'Invalid city',
            message: 'City name must be 64 characters or less'
          });
        }
        
        validatedCity = trimmed;
      }

      log.info(`[POST] Saving settings for userId=${userId}`, {
        city: validatedCity
      });

      // Защита от двойных запросов
      const lockKey = LockKeys.weatherSettings(userId);
      
      if (!tryAcquireLock(lockKey, 'weather-settings-save')) {
        log.info(`[POST] LOCK_DENIED: save already in progress`);
        return res.status(409).json({
          error: 'Save in progress',
          message: 'Settings are being saved. Please wait.'
        });
      }

      try {
        await db.users.set(userId, { weather_city: validatedCity });
        
        releaseLock(lockKey);

        log.info(`[POST] SAVED: city=${validatedCity}`);

        return res.status(200).json({
          success: true,
          userId,
          city: validatedCity,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        releaseLock(lockKey);
        throw error;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
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
