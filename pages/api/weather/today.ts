import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/weather/today] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/weather/today] ERROR: ${message}`, error || '');
  },
};

const WEATHER_API_KEY = process.env.WEATHER_API;

/**
 * API для получения текущей погоды
 * 
 * GET /api/weather/today?userId=xxx
 *   1. Читает настройки пользователя из БД
 *   2. Если города нет - 400 "сначала выберите город"
 *   3. Если есть - запрашивает погоду и возвращает
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ 
      error: 'userId is required',
      message: 'Please provide userId query parameter'
    });
  }

  log.info(`[GET] Fetching weather for userId=${userId}`);

  try {
    // ШАГ 1: Получаем пользователя из БД (weather_city в users)
    const user = await db.users.get(userId);
    
    if (!user || !user.weather_city) {
      log.info(`[GET] CITY_MISSING: no city set for userId=${userId}`);
      return res.status(400).json({
        error: 'City not set',
        message: 'Please select a city first',
        code: 'CITY_NOT_SET'
      });
    }

    const city = user.weather_city;
    log.info(`[GET] City found: ${city}`);

    // ШАГ 2: Проверяем API ключ
    if (!WEATHER_API_KEY) {
      log.error('WEATHER_API key not configured');
      return res.status(500).json({
        error: 'Weather service not configured',
        message: 'Weather API key is missing'
      });
    }

    // ШАГ 3: Запрашиваем погоду
    const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=1&aqi=no`;
    
    log.info(`[GET] Fetching weather from provider for city=${city}`);
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text().catch(() => 'Unknown error');
      log.error('Weather provider error', {
        status: weatherResponse.status,
        error: errorText
      });
      
      if (weatherResponse.status === 400) {
        return res.status(400).json({
          error: 'Invalid city',
          message: 'City not found. Please check the spelling.',
          code: 'INVALID_CITY'
        });
      }
      
      return res.status(502).json({
        error: 'Weather provider error',
        message: 'Could not fetch weather data. Please try again later.'
      });
    }

    const weatherData = await weatherResponse.json();

    log.info(`[GET] PROVIDER_OK: weather fetched for city=${city}`);

    // Форматируем ответ
    const result = {
      city: weatherData.location?.name || city,
      country: weatherData.location?.country,
      temp: weatherData.current?.temp_c,
      condition: weatherData.current?.condition?.text,
      conditionIcon: weatherData.current?.condition?.icon,
      humidity: weatherData.current?.humidity,
      windKph: weatherData.current?.wind_kph,
      feelsLike: weatherData.current?.feelslike_c,
      uv: weatherData.current?.uv,
      moonPhase: weatherData.forecast?.forecastday?.[0]?.astro ? {
        phase: weatherData.forecast.forecastday[0].astro.moon_phase,
        illumination: weatherData.forecast.forecastday[0].astro.moon_illumination,
        sunrise: weatherData.forecast.forecastday[0].astro.sunrise,
        sunset: weatherData.forecast.forecastday[0].astro.sunset
      } : null,
      updatedAt: new Date().toISOString()
    };

    // Кэшируем на 30 минут
    res.setHeader('Cache-Control', 'private, max-age=1800');
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    log.error('Error fetching weather', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch weather data'
    });
  }
}
