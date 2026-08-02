/**
 * Chart Service
 *
 * Startup policy:
 * 1. Read primary chart from the database.
 * 2. Only calculate when the chart is truly missing (404).
 * 3. Never treat storage/read errors as cache misses.
 */

import { NatalChartData, UserProfile } from '../types';
import { assertValidUserId } from '../lib/userId';
import { writeLocalNatalChart } from '../lib/localNatalChartCache';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';

const CHART_FETCH_TIMEOUT_MS = 25_000;

const log = {
  info: (message: string, data?: any) => {
    console.log(`[ChartService] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ChartService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ChartService] ERROR: ${message}`, error || '');
  },
};

const calculationInFlight = new Map<string, Promise<NatalChartData>>();

function selectSelfChart(payload: any): any | null {
  const charts = Array.isArray(payload?.charts) ? payload.charts : [];
  return charts.find((row: { subject_type?: string }) => row.subject_type === 'self')
    || charts.find((row: { is_primary?: boolean }) => row.is_primary === true)
    || null;
}

/**
 * Load primary chart from DB.
 * Returns null only for a real 404. Any other failure is treated as a storage error.
 */
export async function getPrimaryChartId(userId: string): Promise<number | null> {
  assertValidUserId(userId);
  const url = '/api/charts';

  try {
    const response = await apiFetch(
      url,
      { method: 'GET', credentials: 'include', headers: { ...getTelegramInitDataHeaders() } },
      8_000
    );
    if (!response.ok) {
      log.warn('[getPrimaryChartId] Non-OK response', { status: response.status });
      return null;
    }
    const payload = await response.json();
    const id = selectSelfChart(payload)?.id;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  } catch (error: any) {
    log.warn('[getPrimaryChartId] Failed', { error: error?.message || error });
    return null;
  }
}

export async function getChartFromDB(userId: string): Promise<NatalChartData | null> {
  assertValidUserId(userId);
  log.info(`[getChartFromDB] userId=${userId}`);

  const url = '/api/charts';
  let response: Response;
  try {
    response = await apiFetch(
      url,
      { method: 'GET', credentials: 'include', headers: { ...getTelegramInitDataHeaders() } },
      CHART_FETCH_TIMEOUT_MS
    );
  } catch (err: any) {
    log.error('[getChartFromDB] Fetch failed (network/timeout)', {
      error: err?.message || err,
    });
    throw new Error('Не удалось загрузить сохранённую карту из базы.');
  }

  if (!response.ok) {
    log.error('[getChartFromDB] Non-OK response', { status: response.status });
    throw new Error(`Не удалось загрузить карту из базы: ${response.status}`);
  }

  let payload: any;
  let chartData: NatalChartData;
  try {
    payload = await response.json();
    const selfChart = selectSelfChart(payload);
    if (!selfChart) {
      log.info('[getChartFromDB] DB_MISS: no self chart in DB');
      return null;
    }
    chartData = (selfChart.chart_data || selfChart.chartData) as NatalChartData;
  } catch {
    log.error('[getChartFromDB] Invalid JSON from storage');
    throw new Error('Хранилище карты вернуло некорректный ответ.');
  }

  if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
    log.error('[getChartFromDB] Invalid chart payload from storage', {
      hasData: !!chartData,
      hasSun: !!chartData?.sun,
      hasMoon: !!chartData?.moon,
      hasRising: !!chartData?.rising,
    });
    throw new Error('Сохранённая карта неполная.');
  }

  log.info('[getChartFromDB] DB_HIT: chart found', {
    sunSign: chartData.sun?.sign,
    moonSign: chartData.moon?.sign,
  });

  return chartData as NatalChartData;
}

/**
 * Calculate or repair the primary chart through the canonical charts API.
 * The API is responsible for cache validation, locking, and persistence.
 */
async function calculateChart(profile: UserProfile): Promise<NatalChartData> {
  const safeUserId = assertValidUserId(profile.id);
  log.info(`[calculateChart] Calculating for userId=${safeUserId}`);

  const url = '/api/charts';

  let response: Response;
  try {
    response = await apiFetch(
      url,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
        body: JSON.stringify({
          name: profile.name,
          birthDate: profile.birthDate,
          birthTime: profile.birthTime,
          birthPlace: profile.birthPlace,
          // Координаты, разрешённые на клиенте — сервер использует их напрямую и не
          // геокодит место заново (главная причина прежних сбоев у новых юзеров).
          latitude: profile.birthLatitude ?? undefined,
          longitude: profile.birthLongitude ?? undefined,
          timezone: profile.birthTimezone ?? undefined,
          language: profile.language,
          primary: true,
        }),
      },
      CHART_FETCH_TIMEOUT_MS
    );
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

  let payload: any;
  let chartData: NatalChartData;
  try {
    payload = await response.json();
    chartData = (payload?.chart_data || payload?.chartData || payload) as NatalChartData;
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
  const userId = assertValidUserId(profile.id);

  log.info(`[getOrCalculateChart] userId=${userId}`);

  const existing = calculationInFlight.get(userId);
  if (existing) {
    log.info('[getOrCalculateChart] Waiting for existing calculation');
    return existing;
  }

  const chartFromDB = await getChartFromDB(userId);
  if (chartFromDB) {
    writeLocalNatalChart(profile, chartFromDB);
    return chartFromDB;
  }

  log.info('[getOrCalculateChart] No chart in DB, calculating...');

  const CALC_HARD_CAP_MS = 70_000;
  const calculationPromise = Promise.race([
    calculateChart(profile),
    new Promise<NatalChartData>((_, reject) =>
      setTimeout(
        () => reject(new Error('Превышено время ожидания расчёта карты.')),
        CALC_HARD_CAP_MS
      )
    ),
  ]).finally(() => {
    calculationInFlight.delete(userId);
  });

  calculationInFlight.set(userId, calculationPromise);

  const chart = await calculationPromise;
  writeLocalNatalChart(profile, chart);
  return chart;
}

export async function forceRecalculateChart(profile: UserProfile): Promise<NatalChartData> {
  const userId = assertValidUserId(profile.id);

  log.info(`[forceRecalculateChart] Force recalculating for userId=${userId}`);

  const url = '/api/charts';

  const response = await apiFetch(
    url,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        birthPlace: profile.birthPlace,
        latitude: profile.birthLatitude ?? undefined,
        longitude: profile.birthLongitude ?? undefined,
        timezone: profile.birthTimezone ?? undefined,
        language: profile.language,
        primary: true,
        forceRecalculate: true,
      }),
    },
    CHART_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Calculation failed: ${response.status}`);
  }

  const payload = await response.json();
  const chartData = (payload?.chart_data || payload?.chartData || payload) as NatalChartData;

  log.info('[forceRecalculateChart] RECALCULATED: chart updated');

  writeLocalNatalChart(profile, chartData);
  return chartData;
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
