/**
 * Chart Service
 * 
 * Правильная логика работы с натальной картой:
 * 1. Сначала GET /api/charts/:userId - пробуем взять из БД
 * 2. Если нет (404) - один раз вызываем POST /api/astrology/natal-chart
 * 3. Защита от двойных вызовов через inFlight флаг
 * 
 * НИКОГДА не пересчитываем карту при каждом открытии!
 */

import { NatalChartData, UserProfile } from '../types';

// API base URL
const API_BASE_URL = typeof window !== 'undefined' ? '' : '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[ChartService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ChartService] ERROR: ${message}`, error || '');
  },
};

// Защита от двойных вызовов
const calculationInFlight = new Map<string, Promise<NatalChartData>>();

/**
 * Получить карту из БД
 * @returns chartData если найдена, null если нет
 */
export async function getChartFromDB(userId: string): Promise<NatalChartData | null> {
  log.info(`[getChartFromDB] userId=${userId}`);
  
  try {
    const url = `${API_BASE_URL}/api/charts/${userId}`;
    const response = await fetch(url);
    
    if (response.status === 404) {
      log.info(`[getChartFromDB] DB_MISS: no chart in DB`);
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const chartData = await response.json();
    
    // Валидация
    if (!chartData || !chartData.sun || !chartData.moon) {
      log.error(`[getChartFromDB] Invalid chart data structure`);
      return null;
    }
    
    log.info(`[getChartFromDB] DB_HIT: chart found`, {
      sunSign: chartData.sun?.sign,
      moonSign: chartData.moon?.sign
    });
    
    return chartData as NatalChartData;
  } catch (error: any) {
    log.error(`[getChartFromDB] Error`, error);
    throw error;
  }
}

/**
 * Рассчитать карту через API
 * API сам сохранит результат в БД
 */
async function calculateChart(profile: UserProfile): Promise<NatalChartData> {
  log.info(`[calculateChart] Calculating for userId=${profile.id}`);
  
  const url = `${API_BASE_URL}/api/astrology/natal-chart`;
  
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        birthPlace: profile.birthPlace,
        language: profile.language
      })
    });
  } catch (fetchError: any) {
    log.error(`[calculateChart] Network error`, { error: fetchError.message });
    throw new Error('Ошибка сети. Проверьте интернет-соединение и попробуйте снова.');
  }
  
  if (!response.ok) {
    let errorMessage = 'Неизвестная ошибка';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || `Ошибка сервера: ${response.status}`;
      log.error(`[calculateChart] API error`, { status: response.status, error: errorMessage });
    } catch {
      errorMessage = `Ошибка сервера: ${response.status}`;
    }
    throw new Error(errorMessage);
  }
  
  let chartData;
  try {
    chartData = await response.json();
  } catch (parseError) {
    log.error(`[calculateChart] Failed to parse response`);
    throw new Error('Ошибка обработки ответа сервера.');
  }
  
  // Валидация ответа
  if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
    log.error(`[calculateChart] Invalid chart data`, { chartData });
    throw new Error('Получены некорректные данные карты.');
  }
  
  log.info(`[calculateChart] CALCULATED: chart created`, {
    sunSign: chartData.sun?.sign,
    source: response.headers.get('X-Chart-Source')
  });
  
  return chartData as NatalChartData;
}

/**
 * Главная функция: получить или рассчитать карту
 * 
 * Логика:
 * 1. Проверяем inFlight - если уже считаем, ждём
 * 2. Пробуем GET из БД
 * 3. Если нет - один раз POST для расчёта
 */
export async function getOrCalculateChart(profile: UserProfile): Promise<NatalChartData> {
  const userId = profile.id || 'anonymous';
  
  log.info(`[getOrCalculateChart] userId=${userId}`);
  
  // Защита от двойных вызовов
  const existing = calculationInFlight.get(userId);
  if (existing) {
    log.info(`[getOrCalculateChart] Waiting for existing calculation`);
    return existing;
  }
  
  // Шаг 1: Пробуем взять из БД
  try {
    const chartFromDB = await getChartFromDB(userId);
    if (chartFromDB) {
      return chartFromDB;
    }
  } catch (error) {
    log.error(`[getOrCalculateChart] Error getting from DB`, error);
    // Продолжаем к расчёту
  }
  
  // Шаг 2: Карты нет, нужен расчёт
  log.info(`[getOrCalculateChart] No chart in DB, calculating...`);
  
  const calculationPromise = calculateChart(profile)
    .finally(() => {
      calculationInFlight.delete(userId);
    });
  
  calculationInFlight.set(userId, calculationPromise);
  
  return calculationPromise;
}

/**
 * Принудительный пересчёт карты
 * Используется только при явном запросе пользователя или изменении данных рождения
 */
export async function forceRecalculateChart(profile: UserProfile): Promise<NatalChartData> {
  const userId = profile.id || 'anonymous';
  
  log.info(`[forceRecalculateChart] Force recalculating for userId=${userId}`);
  
  const url = `${API_BASE_URL}/api/astrology/natal-chart`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      language: profile.language,
      forceRecalculate: true
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Calculation failed: ${response.status}`);
  }
  
  const chartData = await response.json();
  
  log.info(`[forceRecalculateChart] RECALCULATED: chart updated`);
  
  return chartData as NatalChartData;
}

/**
 * Проверить, нужен ли пересчёт при изменении данных
 */
export function birthDataChanged(
  oldProfile: UserProfile | null, 
  newProfile: UserProfile
): boolean {
  if (!oldProfile) return true;
  
  return (
    oldProfile.birthDate !== newProfile.birthDate ||
    oldProfile.birthTime !== newProfile.birthTime ||
    oldProfile.birthPlace !== newProfile.birthPlace
  );
}
