/**
 * Chart Service
 *
 * Startup policy:
 * 1. Read primary chart from the database.
 * 2. Only calculate when the chart is truly missing (404).
 * 3. Never treat storage/read errors as cache misses.
 */

import { NatalChartData, UserProfile } from '../types';

const API_BASE_URL = typeof window !== 'undefined' ? '' : '';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[ChartService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ChartService] ERROR: ${message}`, error || '');
  },
};

const calculationInFlight = new Map<string, Promise<NatalChartData>>();

/**
 * Load primary chart from DB.
 * Returns null only for a real 404. Any other failure is treated as a storage error.
 */
export async function getChartFromDB(userId: string): Promise<NatalChartData | null> {
  log.info(`[getChartFromDB] userId=${userId}`);

  const url = `${API_BASE_URL}/api/charts/${userId}`;
  const response = await fetch(url);

  if (response.status === 404) {
    log.info('[getChartFromDB] DB_MISS: no chart in DB');
    return null;
  }

  if (!response.ok) {
    let message = `Server error: ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
    } catch {
      // Ignore parsing errors and use the status-based message.
    }
    throw new Error(message);
  }

  const chartData = await response.json();

  if (!chartData || !chartData.sun || !chartData.moon) {
    log.error('[getChartFromDB] Invalid chart data structure', {
      hasData: !!chartData,
      hasSun: !!chartData?.sun,
      hasMoon: !!chartData?.moon,
    });
    return null;
  }

  log.info('[getChartFromDB] DB_HIT: chart found', {
    sunSign: chartData.sun?.sign,
    moonSign: chartData.moon?.sign,
  });

  return chartData as NatalChartData;
}

/**
 * Calculate chart through the idempotent API.
 * The API is responsible for cache validation and persistence.
 */
async function calculateChart(profile: UserProfile): Promise<NatalChartData> {
  log.info(`[calculateChart] Calculating for userId=${profile.id}`);

  const url = `${API_BASE_URL}/api/astrology/natal-chart`;

  let response: Response;
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
        language: profile.language,
      }),
    });
  } catch (fetchError: any) {
    log.error('[calculateChart] Network error', { error: fetchError.message });
    throw new Error('Ошибка сети. Проверьте интернет-соединение и попробуйте снова.');
  }

  if (!response.ok) {
    let errorMessage = 'Неизвестная ошибка';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || `Ошибка сервера: ${response.status}`;
      log.error('[calculateChart] API error', { status: response.status, error: errorMessage });
    } catch {
      errorMessage = `Ошибка сервера: ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  let chartData: NatalChartData;
  try {
    chartData = await response.json();
  } catch {
    log.error('[calculateChart] Failed to parse response');
    throw new Error('Ошибка обработки ответа сервера.');
  }

  if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
    log.error('[calculateChart] Invalid chart data', { chartData });
    throw new Error('Получены некорректные данные карты.');
  }

  log.info('[calculateChart] CALCULATED: chart created', {
    sunSign: chartData.sun?.sign,
    source: response.headers.get('X-Chart-Source'),
  });

  return chartData;
}

/**
 * Main startup function.
 * Only falls back to calculation when the chart is genuinely absent.
 */
export async function getOrCalculateChart(profile: UserProfile): Promise<NatalChartData> {
  const userId = profile.id || 'anonymous';

  log.info(`[getOrCalculateChart] userId=${userId}`);

  const existing = calculationInFlight.get(userId);
  if (existing) {
    log.info('[getOrCalculateChart] Waiting for existing calculation');
    return existing;
  }

  const chartFromDB = await getChartFromDB(userId);
  if (chartFromDB) {
    return chartFromDB;
  }

  log.info('[getOrCalculateChart] No chart in DB, calculating...');

  const calculationPromise = calculateChart(profile).finally(() => {
    calculationInFlight.delete(userId);
  });

  calculationInFlight.set(userId, calculationPromise);

  return calculationPromise;
}

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
      forceRecalculate: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Calculation failed: ${response.status}`);
  }

  const chartData = await response.json();

  log.info('[forceRecalculateChart] RECALCULATED: chart updated');

  return chartData as NatalChartData;
}

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
