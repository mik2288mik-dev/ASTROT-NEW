/**
 * Weather Service
 * 
 * Работает только с БД - никакого localStorage.
 * Все данные города сохраняются и читаются из БД.
 */
import { getTelegramInitDataHeaders } from './sessionService';

// API base URL
const API_BASE_URL = typeof window !== 'undefined' ? '' : '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[WeatherService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[WeatherService] ERROR: ${message}`, error || '');
  },
};

// Защита от двойных запросов на клиенте
let settingsSaveInFlight = false;
let weatherFetchInFlight = false;

export interface WeatherSettings {
  userId: string;
  city: string | null;
  lat?: number;
  lon?: number;
  updatedAt?: string;
}

export interface WeatherData {
  city: string;
  country?: string;
  temp: number;
  condition: string;
  conditionIcon?: string;
  humidity?: number;
  windKph?: number;
  feelsLike?: number;
  uv?: number;
  moonPhase?: {
    phase: string;
    illumination: string;
    sunrise: string;
    sunset: string;
  };
  updatedAt: string;
}

/**
 * Получить настройки погоды из БД
 */
export async function getWeatherSettings(userId: string): Promise<WeatherSettings> {
  log.info(`[getWeatherSettings] userId=${userId}`);
  
  try {
    const url = `${API_BASE_URL}/api/weather/settings?userId=${encodeURIComponent(userId)}`;
    const response = await fetch(url, { headers: getTelegramInitDataHeaders() });
    
    if (!response.ok) {
      throw new Error(`Failed to get settings: ${response.status}`);
    }
    
    const data = await response.json();
    log.info(`[getWeatherSettings] Success: city=${data.city}`);
    
    return {
      userId: data.userId || userId,
      city: data.city || null,
      lat: data.lat,
      lon: data.lon,
      updatedAt: data.updatedAt
    };
  } catch (error: any) {
    log.error(`[getWeatherSettings] Error`, error);
    return { userId, city: null };
  }
}

/**
 * Сохранить город в БД
 */
export async function saveWeatherCity(userId: string, city: string | null): Promise<WeatherSettings> {
  log.info(`[saveWeatherCity] userId=${userId}, city=${city}`);
  
  // Защита от двойных запросов
  if (settingsSaveInFlight) {
    log.info(`[saveWeatherCity] Request already in flight, skipping`);
    throw new Error('Save already in progress');
  }
  
  settingsSaveInFlight = true;
  
  try {
    const url = `${API_BASE_URL}/api/weather/settings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ userId, city })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `Failed to save: ${response.status}`);
    }
    
    const data = await response.json();
    log.info(`[saveWeatherCity] Saved successfully: city=${data.city}`);
    
    return {
      userId: data.userId || userId,
      city: data.city || null,
      updatedAt: data.updatedAt
    };
  } catch (error: any) {
    log.error(`[saveWeatherCity] Error`, error);
    throw error;
  } finally {
    settingsSaveInFlight = false;
  }
}

/**
 * Получить текущую погоду
 * Читает город из БД, затем запрашивает погоду
 */
export async function getTodayWeather(userId: string): Promise<WeatherData | null> {
  log.info(`[getTodayWeather] userId=${userId}`);
  
  // Защита от двойных запросов
  if (weatherFetchInFlight) {
    log.info(`[getTodayWeather] Request already in flight, skipping`);
    return null;
  }
  
  weatherFetchInFlight = true;
  
  try {
    const url = `${API_BASE_URL}/api/weather/today?userId=${encodeURIComponent(userId)}`;
    const response = await fetch(url, { headers: getTelegramInitDataHeaders() });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ code: 'UNKNOWN' }));
      
      if (error.code === 'CITY_NOT_SET') {
        log.info(`[getTodayWeather] City not set`);
        return null;
      }
      
      throw new Error(error.message || `Failed to get weather: ${response.status}`);
    }
    
    const data = await response.json();
    log.info(`[getTodayWeather] Success: ${data.city}, ${data.temp}°C`);
    
    return data as WeatherData;
  } catch (error: any) {
    log.error(`[getTodayWeather] Error`, error);
    return null;
  } finally {
    weatherFetchInFlight = false;
  }
}

/**
 * Проверить, настроен ли город
 */
export async function hasWeatherCity(userId: string): Promise<boolean> {
  const settings = await getWeatherSettings(userId);
  return settings.city !== null && settings.city.length > 0;
}
