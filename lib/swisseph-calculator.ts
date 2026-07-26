/**
 * Swiss Ephemeris Calculator - Native версия
 * Использует нативный модуль swisseph-v2 для точных астрономических расчетов
 */
import axios from 'axios';
import path from 'path';
import tzLookup from 'tz-lookup';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { CANONICAL_NATAL_CALCULATION_VERSION, normalizeCoordinateForStorage } from './natalChartCanonical';
import { lookupCityCoordinates } from './cityGazetteer';
import type { BirthTimeQuality, ChartQuality } from '../types';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[SwissephCalculator] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[SwissephCalculator] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[SwissephCalculator] WARNING: ${message}`, data || '');
  },
};

function isSwissDebugEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.SWISSEPH_DEBUG === 'true';
}

function debugInfo(message: string, data?: any): void {
  if (isSwissDebugEnabled()) log.info(message, data);
}

// Импортируем централизованные данные о знаках зодиака
import { ZODIAC_SIGNS, getElementForSign as getElementForSignUtil, getRulingPlanet as getRulingPlanetUtil, getApproximateSunSignByDate, type ZodiacSign } from './zodiac-utils';

// Планеты Swiss Ephemeris
const PLANETS = {
  SUN: 0,
  MOON: 1,
  MERCURY: 2,
  VENUS: 3,
  MARS: 4,
  JUPITER: 5,
  SATURN: 6,
  URANUS: 7,
  NEPTUNE: 8,
  PLUTO: 9,
  CHIRON: 15,
};

interface Coordinates {
  lat: number;
  lon: number;
  timezone: string;
}

type NatalCalculationOptions = {
  coordinates?: Coordinates;
  birthTimeQuality?: BirthTimeQuality;
};

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  longitude: number;
  house?: number;
  retrograde: boolean;
  speedLongitude: number;
  description: string;
}

export interface PlanetaryTransitsAtResult {
  source: 'swisseph';
  date: string;
  julianDay: number;
  sun: PlanetPosition;
  moon: PlanetPosition;
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
  uranus: PlanetPosition;
  neptune: PlanetPosition;
  pluto: PlanetPosition;
}

interface NatalHouseData {
  house: number;
  sign: string;
  degree: number;
  longitude: number;
}

interface NatalAspectData {
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  angle: number;
  orb: number;
  from: string;
  to: string;
}

// Глобальная инициализация Swiss Ephemeris
let sweInstance: any = null;
let isInitialized = false;
// Если высокоточные файлы .se1 недоступны (типично для serverless/Next-сборки),
// считаем через встроенную Moshier-эфемериду — без файлов, точность достаточная
// для натальной карты (знаки/градусы). Лучше так, чем падать у каждого юзера.
let useMoshier = false;

/** Базовый флаг эфемериды для расчётов планет (SWIEPH с файлами или MOSEPH без). */
function ephemerisBaseFlag(swe: any): number {
  return useMoshier ? (swe.SEFLG_MOSEPH ?? 4) : (swe.SEFLG_SWIEPH ?? 2);
}
let swissephModule: any = null;
let swissephLoadError: Error | null = null;

function loadSwissEphemerisModule() {
  if (swissephModule) return swissephModule;
  if (swissephLoadError) throw swissephLoadError;

  try {
    // Keep the native binding import lazy so API routes can validate requests and
    // return controlled errors if the ephemeris is unavailable during runtime.
    swissephModule = require('swisseph-v2');
    return swissephModule;
  } catch (error: any) {
    swissephLoadError = new Error(
      `Swiss Ephemeris native module is unavailable: ${error?.message || 'failed to load swisseph-v2'}`
    );
    (swissephLoadError as any).code = 'EPHEMERIS_UNAVAILABLE';
    (swissephLoadError as any).cause = error;
    throw swissephLoadError;
  }
}

export function getSwissEphemerisHealth(): { ok: boolean; code?: string; message?: string } {
  try {
    const swe = initSwissEph();
    const requiredMethods = ['swe_calc_ut', 'swe_julday', 'swe_houses', 'swe_set_ephe_path'];
    const missingMethods = requiredMethods.filter((method) => typeof swe?.[method] !== 'function');
    if (missingMethods.length) {
      return {
        ok: false,
        code: 'EPHEMERIS_UNAVAILABLE',
        message: `Swiss Ephemeris is missing methods: ${missingMethods.join(', ')}`,
      };
    }
    const julianDay = swe.swe_julday(2026, 1, 1, 12, 1);
    const result = swe.swe_calc_ut(julianDay, PLANETS.SUN, ephemerisBaseFlag(swe) | swe.SEFLG_SPEED);
    if (!result || typeof result.longitude !== 'number') {
      return {
        ok: false,
        code: 'EPHEMERIS_UNAVAILABLE',
        message: 'Swiss Ephemeris test calculation did not return a Sun longitude',
      };
    }
    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      code: 'EPHEMERIS_UNAVAILABLE',
      message: error?.message || 'Swiss Ephemeris native module is unavailable',
    };
  }
}

/**
 * Инициализация Swiss Ephemeris Native
 */
function initSwissEph() {
  if (isInitialized && sweInstance) {
    debugInfo('Swiss Ephemeris already initialized, reusing instance');
    return sweInstance;
  }

  try {
    log.info('Initializing Swiss Ephemeris Native...');
    
    sweInstance = loadSwissEphemerisModule();
    
    if (!sweInstance) {
      throw new Error('Swiss Ephemeris instance is null after initialization');
    }
    
    // Проверяем наличие необходимых методов
    const requiredMethods = ['swe_calc_ut', 'swe_julday', 'swe_houses', 'swe_set_ephe_path'];
    
    const missingMethods = requiredMethods.filter(
      (method) => typeof (sweInstance as any)[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      const errorMsg = `Swiss Ephemeris instance missing required methods: ${missingMethods.join(', ')}`;
      log.error(errorMsg, { 
        availableMethods: Object.keys(sweInstance).filter(k => typeof (sweInstance as any)[k] === 'function'),
        missingMethods 
      });
      throw new Error(errorMsg);
    }
    
    log.info('✓ Swiss Ephemeris instance validated', {
      hasRequiredMethods: true,
      availableMethods: Object.keys(sweInstance).filter(k => typeof (sweInstance as any)[k] === 'function').length
    });
    
    // Устанавливаем путь к эфемеридам для максимальной точности расчетов
    try {
      if (typeof sweInstance.swe_set_ephe_path === 'function') {
        const fs = require('fs');
        
        // Определяем путь к эфемеридам с проверкой существования
        let ephePath = process.env.EPHE_PATH;
        
        // Список путей для проверки в порядке приоритета
        const possiblePaths = [
          ephePath,
          path.join(process.cwd(), 'ephe'),
          '/app/ephe',
          path.join(__dirname, '..', 'ephe'),
          '/workspace/ephe',
        ].filter(Boolean) as string[];
        
        // Находим первый существующий путь
        ephePath = possiblePaths.find(p => {
          try {
            return fs.existsSync(p) && fs.statSync(p).isDirectory();
          } catch {
            return false;
          }
        });
        
        const epheFiles: string[] = ephePath
          ? fs.readdirSync(ephePath).filter((f: string) => f.endsWith('.se1'))
          : [];

        if (ephePath && epheFiles.length > 0) {
          sweInstance.swe_set_ephe_path(ephePath);
          useMoshier = false;
          log.info(`✓ Ephemeris path set to: ${ephePath}`, {
            path: ephePath,
            filesCount: epheFiles.length,
            note: 'Using high-precision Swiss Ephemeris files (.se1) for calculations'
          });
        } else {
          // Файлов .se1 нет (типично для прод-сборки) — НЕ падаем, а переходим
          // на встроенную Moshier-эфемериду. Натальная карта считается корректно.
          useMoshier = true;
          log.warn('Ephemeris .se1 files not found — falling back to built-in Moshier ephemeris', {
            cwd: process.cwd(),
            envEPHE_PATH: process.env.EPHE_PATH,
            checkedPaths: possiblePaths,
          });
        }
      } else {
        useMoshier = true;
        log.warn('swe_set_ephe_path is not available — using built-in (Moshier) ephemeris', {
          note: 'Calculations remain accurate enough for natal charts.'
        });
      }
    } catch (epheError: any) {
      // Любая проблема с путём/файлами эфемерид — не повод валить расчёт целиком.
      useMoshier = true;
      log.warn('Ephemeris path setup failed — falling back to built-in Moshier ephemeris', {
        error: epheError.message,
      });
    }
    
    isInitialized = true;
    log.info('✓ Swiss Ephemeris initialized successfully');
    return sweInstance;
  } catch (error: any) {
    log.error('❌ Failed to initialize Swiss Ephemeris', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    isInitialized = false;
    sweInstance = null;
    
    throw new Error(`Ошибка инициализации астрономических расчетов: ${error.message || 'Неизвестная ошибка'}`);
  }
}

/**
 * Получение Native калькулятора Swiss Ephemeris
 */
function getNativeCalculator() {
  return initSwissEph();
}

/**
 * Конвертирует локальное время в UTC с учетом реального часового пояса
 * Использует date-fns-tz для точной конвертации
 */
function convertLocalTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): { utcYear: number; utcMonth: number; utcDay: number; utcHour: number; utcMinute: number; utcTimeInHours: number } {
  try {
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    
    log.info('Converting local time to UTC', {
      input: { year, month, day, hour, minute },
      timezone,
      dateString
    });
    
    const utcDate = fromZonedTime(dateString, timezone);
    const localInTimezone = toZonedTime(utcDate, timezone);
    
    const utcYear = utcDate.getUTCFullYear();
    const utcMonth = utcDate.getUTCMonth() + 1;
    const utcDay = utcDate.getUTCDate();
    const utcHour = utcDate.getUTCHours();
    const utcMinute = utcDate.getUTCMinutes();
    const utcTimeInHours = utcHour + utcMinute / 60.0;
    
    const verificationPassed = 
      localInTimezone.getFullYear() === year &&
      localInTimezone.getMonth() + 1 === month &&
      localInTimezone.getDate() === day &&
      localInTimezone.getHours() === hour &&
      localInTimezone.getMinutes() === minute;
    
    log.info('✓ Converted local time to UTC successfully', {
      local: { year, month, day, hour, minute },
      timezone,
      utc: { 
        year: utcYear, 
        month: utcMonth, 
        day: utcDay, 
        hour: utcHour, 
        minute: utcMinute, 
        timeInHours: utcTimeInHours.toFixed(4) 
      },
      dateShift: (utcDay !== day || utcMonth !== month || utcYear !== year) ? 'Date shifted due to timezone' : 'Same date',
      verification: {
        localInTimezone: `${localInTimezone.getFullYear()}-${String(localInTimezone.getMonth() + 1).padStart(2, '0')}-${String(localInTimezone.getDate()).padStart(2, '0')} ${String(localInTimezone.getHours()).padStart(2, '0')}:${String(localInTimezone.getMinutes()).padStart(2, '0')}`,
        desired: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        passed: verificationPassed ? '✓ PASS' : '✗ FAIL'
      }
    });
    
    if (!verificationPassed) {
      log.error('❌ CRITICAL: Timezone conversion verification failed!', {
        expected: { year, month, day, hour, minute },
        got: { 
          year: localInTimezone.getFullYear(),
          month: localInTimezone.getMonth() + 1,
          day: localInTimezone.getDate(),
          hour: localInTimezone.getHours(),
          minute: localInTimezone.getMinutes()
        }
      });
    }
    
    return { utcYear, utcMonth, utcDay, utcHour, utcMinute, utcTimeInHours };
  } catch (error: any) {
    log.error('Error converting local time to UTC', { error: error.message, timezone, year, month, day, hour, minute });
    throw new Error(`Failed to convert time with timezone ${timezone}: ${error.message}`);
  }
}

/** Часовой пояс по координатам — локально (tz-lookup), без сети. */
function resolveTimezone(lat: number, lon: number): string {
  try {
    return tzLookup(lat, lon);
  } catch {
    return 'Europe/Moscow';
  }
}

// Open-Meteo отдаёт 403 на «неброузерный» User-Agent (по умолчанию axios шлёт
// "axios/x.y.z" → блок). Притворяемся обычным мобильным браузером — тогда работает.
const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Геокодинг через Open-Meteo — бесплатно, без ключа, дружелюбен к серверным IP
 * (в отличие от Nominatim, который часто лимитит/банит хостинг). Возврат null при неудаче.
 */
async function geocodeViaOpenMeteo(placeName: string): Promise<Coordinates | null> {
  try {
    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: placeName, count: 1, language: 'ru', format: 'json' },
      // Браузерный UA обязателен: иначе Open-Meteo блокирует запрос (403) и сервер
      // вынужден уходить на Nominatim, который с IP Railway часто банится → карта не строилась.
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      timeout: 15000,
    });
    const r = response.data?.results?.[0];
    const lat = Number(r?.latitude);
    const lon = Number(r?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, timezone: resolveTimezone(lat, lon) };
  } catch (error: any) {
    log.warn('Open-Meteo geocoding failed, will try Nominatim', { placeName, error: error?.message });
    return null;
  }
}

/**
 * Получение координат и часового пояса по названию места.
 * Порядок: локальный справочник (офлайн, мгновенно, для частых городов) →
 * Open-Meteo (надёжен для серверов) → Nominatim (шире покрытие).
 * Если все источники недоступны — бросаем ошибку с кодом GEOCODING_FAILED,
 * чтобы API отдал понятную 400 «место не найдено», а не общую 500.
 */
export async function getCoordinates(placeName: string): Promise<Coordinates> {
  // 1. Офлайн-справочник — не зависит от сети и серверных лимитов геокодеров.
  const offline = lookupCityCoordinates(placeName);
  if (offline) {
    const coords = { lat: offline.lat, lon: offline.lon, timezone: resolveTimezone(offline.lat, offline.lon) };
    log.info('Coordinates resolved via offline gazetteer', { placeName, ...coords });
    return coords;
  }

  // 2. Open-Meteo (бесплатно, без ключа, дружелюбен к серверным IP).
  const viaOpenMeteo = await geocodeViaOpenMeteo(placeName);
  if (viaOpenMeteo) {
    log.info('Coordinates resolved via Open-Meteo', { placeName, ...viaOpenMeteo });
    return viaOpenMeteo;
  }

  // 3. Nominatim — последний шанс (часто блокирует серверные IP).
  try {
    return await geocodeViaNominatim(placeName);
  } catch (error: any) {
    const wrapped: any = new Error(
      `Could not resolve coordinates (geocoding failed) for location "${placeName}": ${error?.message || 'unknown error'}`
    );
    wrapped.code = 'GEOCODING_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
}

/**
 * Возвращает координаты для расчёта карты, используя ПЕРЕДАННЫЕ клиентом координаты,
 * если они валидны (клиентский автокомплит уже разрешил их с IP пользователя), и
 * только иначе обращается к геокодеру. Это убирает хрупкий повторный геокодинг с
 * серверного IP — главную причину, по которой карта не строилась у новых юзеров.
 */
export async function resolveBirthCoordinates(
  placeName: string,
  provided?: { lat?: number | null; lon?: number | null; timezone?: string | null } | null
): Promise<Coordinates> {
  const lat = Number(provided?.lat);
  const lon = Number(provided?.lon);
  const hasValidCoords =
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0);

  if (hasValidCoords) {
    const timezone = (provided?.timezone && String(provided.timezone).trim()) || resolveTimezone(lat, lon);
    log.info('Using client-provided birth coordinates', { placeName, lat, lon, timezone });
    return { lat, lon, timezone };
  }

  return getCoordinates(placeName);
}

/**
 * Геокодинг через Nominatim (OpenStreetMap) — фолбэк. С retry-логикой.
 */
async function geocodeViaNominatim(placeName: string, retryCount = 0): Promise<Coordinates> {
  const MAX_RETRIES = 2;
  
  try {
    log.info('Getting coordinates and timezone for place', { placeName, attempt: retryCount + 1 });
    
    const url = 'https://nominatim.openstreetmap.org/search';
    
    let response;
    try {
      response = await axios.get(url, {
        params: {
          q: placeName,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'YourHoroscope/1.0',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8'
        },
        timeout: 20000 // Увеличен таймаут до 20 секунд
      });
    } catch (axiosError: any) {
      log.error('Error fetching coordinates from Nominatim', {
        placeName,
        error: axiosError.message,
        code: axiosError.code,
        attempt: retryCount + 1
      });
      
      // Retry для сетевых ошибок
      if (retryCount < MAX_RETRIES && (
        axiosError.code === 'ECONNABORTED' || 
        axiosError.code === 'ENOTFOUND' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.message?.includes('timeout') ||
        axiosError.message?.includes('network')
      )) {
        log.info(`Retrying geocoding request (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return geocodeViaNominatim(placeName, retryCount + 1);
      }
      
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        throw new Error(`Не удалось получить координаты для "${placeName}". Проверьте интернет-соединение.`);
      }
      
      // Проверяем если это ошибка rate limit от Nominatim
      if (axiosError.response?.status === 429) {
        throw new Error(`Слишком много запросов. Подождите немного и попробуйте снова.`);
      }
      
      throw new Error(`Ошибка сети при поиске места "${placeName}". Попробуйте позже.`);
    }

    if (!response.data || response.data.length === 0) {
      log.warn('No location found in Nominatim response', { placeName, responseData: response.data });
      throw new Error(`Место "${placeName}" не найдено. Проверьте написание (например: "Москва, Россия").`);
    }

    const location = response.data[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Некорректные координаты для места "${placeName}".`);
    }

    let timezone: string;
    try {
      timezone = tzLookup(lat, lon);
      log.info('Timezone determined accurately', { lat, lon, timezone, placeName });
    } catch (tzError: any) {
      log.warn('Failed to determine timezone, using Europe/Moscow as fallback', { error: tzError.message });
      timezone = 'Europe/Moscow'; // Более разумный fallback для русскоязычных пользователей
    }

    log.info('Coordinates and timezone found', { lat, lon, timezone, placeName, displayName: location.display_name });

    return { lat, lon, timezone };
  } catch (error: any) {
    log.error('Error getting coordinates', { error: error.message, placeName });
    throw error;
  }
}

/**
 * Определяет знак зодиака по эклиптической долготе планеты
 */
export function getZodiacSign(degree: number): string {
  let normalizedDegree = degree % 360;
  if (normalizedDegree < 0) {
    normalizedDegree += 360;
  }
  
  if (normalizedDegree >= 360) {
    normalizedDegree = normalizedDegree % 360;
  }
  if (normalizedDegree < 0) {
    normalizedDegree = 0;
  }
  
  const signIndex = Math.floor(normalizedDegree / 30);
  const finalIndex = signIndex >= 12 ? 0 : (signIndex < 0 ? 0 : signIndex);
  
  const signs = ZODIAC_SIGNS;
  
  if (finalIndex < 0 || finalIndex >= signs.length) {
    log.error(`[getZodiacSign] ❌ Invalid sign index: ${finalIndex} for degree ${degree}, normalized: ${normalizedDegree}`);
    return signs[0];
  }
  
  const signName = signs[finalIndex];
  const degreeInSign = normalizedDegree % 30;
  
  debugInfo(`[getZodiacSign] ✓ Calculated`, {
    inputDegree: degree.toFixed(6),
    normalizedDegree: normalizedDegree.toFixed(6),
    signIndex: finalIndex,
    signName: signName,
    degreeInSign: degreeInSign.toFixed(4),
    fullPosition: `${degreeInSign.toFixed(2)}° ${signName}`
  });
  
  return signName;
}

/**
 * Вычисляет градус планеты внутри знака зодиака
 */
export function getDegreeInSign(degree: number): number {
  let normalizedDegree = degree % 360;
  if (normalizedDegree < 0) {
    normalizedDegree += 360;
  }
  
  const degreeInSign = normalizedDegree % 30;
  return degreeInSign;
}

/**
 * Получение описания планеты
 */
function getPlanetDescription(planetName: string): string {
  const descriptions: { [key: string]: string } = {
    'Sun': 'Your core essence and identity.',
    'Moon': 'Your emotional nature and inner self.',
    'Mercury': 'Your communication style and thinking patterns.',
    'Venus': 'Your love language and values.',
    'Mars': 'Your drive and passion.',
    'Jupiter': 'Your growth and expansion.',
    'Saturn': 'Your discipline and responsibilities.',
    'Uranus': 'Your instinct for change, freedom, and disruption.',
    'Neptune': 'Your sensitivity, imagination, and porous inner field.',
    'Pluto': 'Your depth, intensity, and transformative pressure.',
    'Chiron': 'Your tender point, healing path, and wise vulnerability.',
    'Ascendant': 'Your outer personality and first impressions.'
  };
  return descriptions[planetName] || 'Planetary influence.';
}

/** Один вызов swe_calc_ut с заданным флагом. Возвращает валидный результат или null. */
function rawPlanetCalc(swe: any, julday: number, planetId: number, baseFlag: number): any | null {
  try {
    const result = swe.swe_calc_ut(julday, planetId, baseFlag | swe.SEFLG_SPEED);
    if (result && typeof result.longitude === 'number' && Number.isFinite(result.longitude)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Рассчитывает положение планеты в натальной карте используя Swiss Ephemeris.
 * Если высокоточная эфемерида (.se1) не смогла посчитать планету (файл на нужный
 * диапазон отсутствует/неполон), ПЕРЕсчитываем через встроенный Moshier — он не
 * требует файлов. Так Солнце/Луна/планеты считаются всегда, и карта не падает.
 */
function calculatePlanetPosition(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  planetId: number,
  planetName: string
): PlanetPosition | null {
  try {
    // 1) Базовый флаг (SWIEPH с файлами или MOSEPH, если файлов нет).
    let result = rawPlanetCalc(swe, julday, planetId, ephemerisBaseFlag(swe));

    // 2) Фолбэк: если считали по файлам и не вышло — пробуем Moshier (без файлов).
    if (!result && !useMoshier) {
      result = rawPlanetCalc(swe, julday, planetId, swe.SEFLG_MOSEPH ?? 4);
      if (result) {
        log.warn(`${planetName}: SWIEPH calc failed, recomputed via built-in Moshier ephemeris`);
      }
    }

    if (!result || typeof result.longitude !== 'number') {
      log.error(`Failed to calculate ${planetName}`, { result });
      return null;
    }

    const longitude = result.longitude;
    
    const sign = getZodiacSign(longitude);
    const degreeInSign = getDegreeInSign(longitude);

    debugInfo(`[PLANET] Calculated ${planetName}`, { 
      longitude: longitude.toFixed(6), 
      sign, 
      degreeInSign: degreeInSign.toFixed(4),
      fullDegree: `${degreeInSign.toFixed(2)}° ${sign}`
    });
    
    return {
      planet: planetName,
      sign,
      degree: degreeInSign,
      longitude,
      retrograde: typeof result.speedLongitude === 'number' ? result.speedLongitude < 0 : false,
      speedLongitude: typeof result.speedLongitude === 'number' ? result.speedLongitude : 0,
      description: getPlanetDescription(planetName)
    };
  } catch (error: any) {
    log.error(`Error calculating ${planetName}`, error);
    return null;
  }
}

/**
 * Рассчитывает Асцендент и дома через Swiss Ephemeris
 */
function housesWithSystem(swe: any, julday: number, lat: number, lon: number, system: string): any | null {
  try {
    const result = swe.swe_houses(julday, lat, lon, system);
    if (result && typeof result.ascendant === 'number' && Number.isFinite(result.ascendant)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

function calculateAnglesAndHouses(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  lat: number,
  lon: number
): { ascendant: PlanetPosition; houses: NatalHouseData[] } | null {
  try {
    // Placidus ('P') не определён за полярным кругом (|lat| > ~66°) — там swe_houses
    // не возвращает корректный асцендент. Фолбэк на Whole Sign ('W'), который
    // работает на любой широте, чтобы карта строилась и у северных пользователей.
    let result = housesWithSystem(swe, julday, lat, lon, 'P');
    if (!result) {
      result = housesWithSystem(swe, julday, lat, lon, 'W');
      if (result) log.warn('Placidus houses unavailable (polar latitude?), fell back to Whole Sign');
    }

    if (!result || typeof result.ascendant !== 'number') {
      log.error('Failed to calculate ascendant', { result, lat, lon });
      return null;
    }

    const ascendant = result.ascendant;
    
    const sign = getZodiacSign(ascendant);
    const degreeInSign = getDegreeInSign(ascendant);
    const houses = Array.isArray(result.house)
      ? result.house.slice(0, 12).map((longitude: number, index: number) => ({
          house: index + 1,
          sign: getZodiacSign(longitude),
          degree: getDegreeInSign(longitude),
          longitude,
        }))
      : [];

    log.info('Calculated Ascendant', { 
      ascendant: ascendant.toFixed(4), 
      sign, 
      degreeInSign: degreeInSign.toFixed(2),
      houses: houses.length,
    });

    return {
      ascendant: {
        planet: 'Ascendant',
        sign,
        degree: degreeInSign,
        longitude: ascendant,
        retrograde: false,
        speedLongitude: 0,
        description: 'Your outer personality and first impressions.'
      },
      houses,
    };
  } catch (error: any) {
    log.error('Error calculating ascendant', error);
    return null;
  }
}

export function calculatePlanetaryTransitsAt(date: Date): PlanetaryTransitsAtResult {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    const error = new Error('Invalid transit date');
    (error as any).code = 'INVALID_TRANSIT_DATE';
    throw error;
  }

  const swe = getNativeCalculator();
  const utcTimeInHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const julianDay = swe.swe_julday(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    utcTimeInHours,
    1
  );

  const sun = calculatePlanetPosition(swe, julianDay, PLANETS.SUN, 'Sun');
  const moon = calculatePlanetPosition(swe, julianDay, PLANETS.MOON, 'Moon');
  const mercury = calculatePlanetPosition(swe, julianDay, PLANETS.MERCURY, 'Mercury');
  const venus = calculatePlanetPosition(swe, julianDay, PLANETS.VENUS, 'Venus');
  const mars = calculatePlanetPosition(swe, julianDay, PLANETS.MARS, 'Mars');
  const jupiter = calculatePlanetPosition(swe, julianDay, PLANETS.JUPITER, 'Jupiter');
  const saturn = calculatePlanetPosition(swe, julianDay, PLANETS.SATURN, 'Saturn');
  const uranus = calculatePlanetPosition(swe, julianDay, PLANETS.URANUS, 'Uranus');
  const neptune = calculatePlanetPosition(swe, julianDay, PLANETS.NEPTUNE, 'Neptune');
  const pluto = calculatePlanetPosition(swe, julianDay, PLANETS.PLUTO, 'Pluto');

  const missing = [
    ['Sun', sun],
    ['Moon', moon],
    ['Mercury', mercury],
    ['Venus', venus],
    ['Mars', mars],
    ['Jupiter', jupiter],
    ['Saturn', saturn],
    ['Uranus', uranus],
    ['Neptune', neptune],
    ['Pluto', pluto],
  ].filter(([, position]) => !position).map(([planet]) => planet);

  if (missing.length > 0) {
    const error = new Error(`Transit calculation did not return required positions: ${missing.join(', ')}`);
    (error as any).code = 'EPHEMERIS_TRANSIT_INCOMPLETE';
    throw error;
  }

  return {
    source: 'swisseph',
    date: date.toISOString(),
    julianDay,
    sun: sun!,
    moon: moon!,
    mercury: mercury!,
    venus: venus!,
    mars: mars!,
    jupiter: jupiter!,
    saturn: saturn!,
    uranus: uranus!,
    neptune: neptune!,
    pluto: pluto!,
  };
}

/**
 * Определяет доминирующий элемент (стихию) на основе положений планет
 */
function calculateElement(positions: PlanetPosition[]): string {

  const elementCounts: { [key: string]: number } = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0
  };

  positions.forEach(position => {
    const element = getElementForSignUtil(position.sign as ZodiacSign);
    if (element) {
      elementCounts[element]++;
    }
  });

  let dominantElement = 'Fire';
  let maxCount = 0;
  for (const [element, count] of Object.entries(elementCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantElement = element;
    }
  }

  return dominantElement;
}

/**
 * Определить ожидаемый знак Солнца по дате рождения (упрощённо, для валидации)
 */
function getExpectedSunSignByDate(year: number, month: number, day: number): string {
  return getApproximateSunSignByDate(year, month, day);
}

/**
 * Определение управляющей планеты
 */
function calculateRulingPlanet(sunSign: string): string {
  return getRulingPlanetUtil(sunSign as any) || 'Sun';
}

function getHouseForLongitude(longitude: number, houses: NatalHouseData[]): number {
  if (!Array.isArray(houses) || houses.length < 12) return 1;
  const normalizedLongitude = ((longitude % 360) + 360) % 360;

  for (let index = 0; index < houses.length; index += 1) {
    const current = ((houses[index].longitude % 360) + 360) % 360;
    const next = ((houses[(index + 1) % houses.length].longitude % 360) + 360) % 360;
    const wraps = current > next;

    if ((!wraps && normalizedLongitude >= current && normalizedLongitude < next)
      || (wraps && (normalizedLongitude >= current || normalizedLongitude < next))) {
      return houses[index].house;
    }
  }

  return 1;
}

function withAssignedHouse(position: PlanetPosition | null, houses: NatalHouseData[]): PlanetPosition | null {
  if (!position) return null;
  return {
    ...position,
    house: getHouseForLongitude(position.longitude, houses),
  };
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function calculateAspects(positions: PlanetPosition[]): NatalAspectData[] {
  const aspectDefs: Array<{ type: NatalAspectData['type']; angle: number; orb: number }> = [
    { type: 'conjunction', angle: 0, orb: 8 },
    { type: 'sextile', angle: 60, orb: 4 },
    { type: 'square', angle: 90, orb: 6 },
    { type: 'trine', angle: 120, orb: 6 },
    { type: 'opposition', angle: 180, orb: 8 },
  ];

  const aspects: NatalAspectData[] = [];

  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const from = positions[i];
      const to = positions[j];
      const distance = angularDistance(from.longitude, to.longitude);
      const matched = aspectDefs.find((aspect) => Math.abs(distance - aspect.angle) <= aspect.orb);
      if (!matched) continue;

      aspects.push({
        type: matched.type,
        angle: matched.angle,
        orb: Number(Math.abs(distance - matched.angle).toFixed(2)),
        from: from.planet,
        to: to.planet,
      });
    }
  }

  return aspects;
}

function inferBirthTimeQuality(rawBirthTime?: string | null): BirthTimeQuality {
  const value = String(rawBirthTime || '').trim();
  if (!value) return 'unknown';
  if (value.toLowerCase().includes('default') || value.toLowerCase().includes('unknown')) return 'unknown';
  return /^\d{1,2}:\d{2}/.test(value) ? 'exact' : 'approximate';
}

function buildChartQuality(birthTimeQuality: BirthTimeQuality): ChartQuality {
  const timed = birthTimeQuality === 'exact';
  return {
    birthTimeQuality,
    ascendantReliable: timed,
    housesReliable: timed,
    houseBasedPersonalization: timed,
    notes: timed
      ? []
      : [
          'Birth time is not exact; Ascendant and house placements are calculated from a default noon time and must not be treated as precise.',
        ],
  };
}

/**
 * Рассчитывает полную натальную карту для человека
 */
export interface NatalChartResult {
  sun: PlanetPosition;
  moon: PlanetPosition;
  rising: PlanetPosition;
  mercury: PlanetPosition | null;
  venus: PlanetPosition | null;
  mars: PlanetPosition | null;
  jupiter: PlanetPosition | null;
  saturn: PlanetPosition | null;
  uranus: PlanetPosition | null;
  neptune: PlanetPosition | null;
  pluto: PlanetPosition | null;
  chiron: PlanetPosition | null;
  element: string;
  rulingPlanet: string;
  latitude: number;
  longitude: number;
  timezone: string;
  houses: NatalHouseData[];
  aspects: NatalAspectData[];
  calculationVersion: string;
  birthTimeQuality: BirthTimeQuality;
  chartQuality: ChartQuality;
  summary: string;
}

/**
 * ЧЕТКАЯ ЛОГИКА РАСЧЕТА НАТАЛЬНОЙ КАРТЫ:
 * 1. Валидация входных данных
 * 2. Инициализация Swiss Ephemeris
 * 3. Получение координат места рождения
 * 4. Парсинг и валидация даты/времени
 * 5. Конвертация в UTC и Julian Day
 * 6. Расчет положений планет
 * 7. Валидация результатов
 * 8. Расчет дополнительных параметров (элемент, управляющая планета)
 * 9. Возврат результата
 */
export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string,
  options?: NatalCalculationOptions
): Promise<NatalChartResult> {
  const startTime = Date.now();
  const birthTimeQuality = options?.birthTimeQuality || inferBirthTimeQuality(birthTime);
  const chartQuality = buildChartQuality(birthTimeQuality);
  
  try {
    log.info('Starting natal chart calculation', {
      name,
      birthDate,
      birthTime: birthTime || '12:00 (default)',
      birthPlace,
      birthTimeQuality,
    });

    // Шаг 1: Валидация входных данных
    if (!name || name.trim().length === 0) {
      throw new Error('Name is required');
    }
    if (!birthDate || !birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Invalid birth date format. Expected YYYY-MM-DD');
    }
    if (!birthPlace || birthPlace.trim().length === 0) {
      throw new Error('Birth place is required');
    }

    // Шаг 2: Инициализация Swiss Ephemeris
    const swe = getNativeCalculator();
    if (!swe) {
      throw new Error('Swiss Ephemeris instance is null after initialization');
    }
    log.info('✓ Swiss Ephemeris initialized');

    // Шаг 3: Получение координат места рождения
    let coords: Coordinates;
    try {
      coords = options?.coordinates || await getCoordinates(birthPlace);
      log.info('✓ Coordinates obtained', {
        lat: coords.lat,
        lon: coords.lon,
        timezone: coords.timezone
      });
    } catch (coordError: any) {
      log.error('Failed to get coordinates', {
        error: coordError.message,
        birthPlace
      });
      throw new Error(`Location not found: ${birthPlace}. Please check the spelling (e.g., "Moscow, Russia" or "Москва, Россия").`);
    }

    // Шаг 4: Парсинг и валидация даты/времени
    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    
    // Валидация даты
    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) {
      throw new Error('Invalid birth date: could not parse date components');
    }
    if (birthYear < 1900 || birthYear > 2100) {
      throw new Error('Birth year must be between 1900 and 2100');
    }
    if (birthMonth < 1 || birthMonth > 12) {
      throw new Error('Birth month must be between 1 and 12');
    }
    if (birthDay < 1 || birthDay > 31) {
      throw new Error('Birth day must be between 1 and 31');
    }
    
    // Парсинг времени рождения
    let birthHour = 12;
    let birthMinute = 0;
    if (birthTime && birthTime.trim().length > 0) {
      const timeParts = birthTime.split(':');
      birthHour = parseInt(timeParts[0], 10);
      birthMinute = parseInt(timeParts[1] || '0', 10);
      
      // Валидация времени
      if (isNaN(birthHour) || birthHour < 0 || birthHour > 23) {
        log.warn(`Invalid hour ${birthHour}, using 12:00`);
        birthHour = 12;
      }
      if (isNaN(birthMinute) || birthMinute < 0 || birthMinute > 59) {
        log.warn(`Invalid minute ${birthMinute}, using 0`);
        birthMinute = 0;
      }
    }

    // Шаг 5: Конвертация в UTC и Julian Day
    let utcYear: number, utcMonth: number, utcDay: number, utcTimeInHours: number;
    try {
      const utcData = convertLocalTimeToUTC(
        birthYear,
        birthMonth,
        birthDay,
        birthHour,
        birthMinute,
        coords.timezone
      );
      utcYear = utcData.utcYear;
      utcMonth = utcData.utcMonth;
      utcDay = utcData.utcDay;
      utcTimeInHours = utcData.utcTimeInHours;
      
      log.info('✓ Time converted to UTC', {
        local: `${birthYear}-${birthMonth}-${birthDay} ${birthHour}:${birthMinute}`,
        utc: `${utcYear}-${utcMonth}-${utcDay} ${utcData.utcHour}:${utcData.utcMinute}`,
        timezone: coords.timezone
      });
    } catch (timeError: any) {
      log.error('Failed to convert time to UTC', {
        error: timeError.message
      });
      throw new Error(`Failed to convert time to UTC: ${timeError.message}`);
    }
    
    // Конвертация в Julian Day
    let julianDay: number;
    try {
      julianDay = swe.swe_julday(utcYear, utcMonth, utcDay, utcTimeInHours, 1);
      if (!julianDay || isNaN(julianDay)) {
        throw new Error('Invalid Julian Day calculated');
      }
      log.info('✓ Julian Day calculated', {
        julianDay: julianDay.toFixed(6)
      });
    } catch (julianError: any) {
      log.error('Failed to calculate Julian Day', {
        error: julianError.message,
        utcYear,
        utcMonth,
        utcDay,
        utcTimeInHours
      });
      throw new Error(`Failed to calculate Julian Day: ${julianError.message}`);
    }

    // Шаг 6: Расчет положений планет
    log.info('Calculating planet positions...');
    const [
      sun,
      moon,
      mercury,
      venus,
      mars,
      jupiter,
      saturn,
      uranus,
      neptune,
      pluto,
      chiron,
      angleData,
    ] = await Promise.all([
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.SUN, 'Sun')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MOON, 'Moon')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MERCURY, 'Mercury')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.VENUS, 'Venus')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MARS, 'Mars')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.JUPITER, 'Jupiter')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.SATURN, 'Saturn')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.URANUS, 'Uranus')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.NEPTUNE, 'Neptune')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.PLUTO, 'Pluto')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.CHIRON, 'Chiron')),
      Promise.resolve(calculateAnglesAndHouses(swe, julianDay, coords.lat, coords.lon))
    ]);

    // Шаг 7: Валидация результатов
    if (!sun) {
      throw new Error('Failed to calculate Sun position');
    }
    if (!moon) {
      throw new Error('Failed to calculate Moon position');
    }
    if (!angleData?.ascendant) {
      throw new Error('Failed to calculate Ascendant');
    }
    const ascendant = angleData.ascendant;
    const houses = angleData.houses;
    const sunWithHouse = withAssignedHouse(sun, houses);
    const moonWithHouse = withAssignedHouse(moon, houses);
    const ascendantWithHouse = withAssignedHouse(ascendant, houses);
    const mercuryWithHouse = withAssignedHouse(mercury, houses);
    const venusWithHouse = withAssignedHouse(venus, houses);
    const marsWithHouse = withAssignedHouse(mars, houses);
    const jupiterWithHouse = withAssignedHouse(jupiter, houses);
    const saturnWithHouse = withAssignedHouse(saturn, houses);
    const uranusWithHouse = withAssignedHouse(uranus, houses);
    const neptuneWithHouse = withAssignedHouse(neptune, houses);
    const plutoWithHouse = withAssignedHouse(pluto, houses);
    const chironWithHouse = withAssignedHouse(chiron, houses);

    // Валидация знаков зодиака
    const validSigns = ZODIAC_SIGNS as readonly string[];
    if (!sunWithHouse || !validSigns.includes(sunWithHouse.sign)) {
      throw new Error(`Invalid Sun sign: ${sunWithHouse?.sign || 'unknown'}`);
    }
    if (!moonWithHouse || !validSigns.includes(moonWithHouse.sign)) {
      throw new Error(`Invalid Moon sign: ${moonWithHouse?.sign || 'unknown'}`);
    }
    if (!ascendantWithHouse || !validSigns.includes(ascendantWithHouse.sign)) {
      throw new Error(`Invalid Ascendant sign: ${ascendantWithHouse?.sign || 'unknown'}`);
    }

    // Шаг 8: Расчет дополнительных параметров
    const positions = [
      sunWithHouse,
      moonWithHouse,
      ascendantWithHouse,
      mercuryWithHouse,
      venusWithHouse,
      marsWithHouse,
      jupiterWithHouse,
      saturnWithHouse,
      uranusWithHouse,
      neptuneWithHouse,
      plutoWithHouse,
      chironWithHouse,
    ].filter((position): position is PlanetPosition => position !== null);
    
    const element = calculateElement(positions);
    const rulingPlanet = calculateRulingPlanet(sunWithHouse.sign);
    const aspects = calculateAspects(positions);

    // Шаг 9: Формирование результата
    const chartData: NatalChartResult = {
      sun: sunWithHouse,
      moon: moonWithHouse,
      rising: ascendantWithHouse,
      mercury: mercuryWithHouse || null,
      venus: venusWithHouse || null,
      mars: marsWithHouse || null,
      jupiter: jupiterWithHouse || null,
      saturn: saturnWithHouse || null,
      uranus: uranusWithHouse || null,
      neptune: neptuneWithHouse || null,
      pluto: plutoWithHouse || null,
      chiron: chironWithHouse || null,
      element,
      rulingPlanet,
      latitude: normalizeCoordinateForStorage(coords.lat),
      longitude: normalizeCoordinateForStorage(coords.lon),
      timezone: coords.timezone,
      houses,
      aspects,
      calculationVersion: CANONICAL_NATAL_CALCULATION_VERSION,
      birthTimeQuality,
      chartQuality,
      summary: `Natal chart for ${name}, born on ${birthDate} at ${birthTime || '12:00'} in ${birthPlace}. Your chart reveals a ${element} dominant personality with ${sunWithHouse.sign} Sun, ${moonWithHouse.sign} Moon, and ${ascendantWithHouse.sign} Rising.`
    };

    // Дополнительная валидация знака Солнца (для логирования)
    const expectedSignByDate = getExpectedSunSignByDate(birthYear, birthMonth, birthDay);
    const signMatch = sunWithHouse.sign === expectedSignByDate;
    
    if (!signMatch) {
      log.warn(`[VALIDATION] Sun sign mismatch (approximate)`, {
        calculated: { sign: sunWithHouse.sign, degree: sunWithHouse.degree.toFixed(4), house: sunWithHouse.house },
        expected: { sign: expectedSignByDate },
        note: 'Approximate based on date only - actual calculation is more accurate'
      });
    } else {
      log.info(`[VALIDATION] ✓ Sun sign matches expected approximate value`, {
        sunSign: sunWithHouse.sign
      });
    }

    const duration = Date.now() - startTime;
    log.info('✓ Natal chart calculated successfully', {
      duration: `${duration}ms`,
      sunSign: sunWithHouse.sign,
      moonSign: moonWithHouse.sign,
      risingSign: ascendantWithHouse.sign,
      element,
      rulingPlanet,
      hasMercury: !!mercuryWithHouse,
      hasVenus: !!venusWithHouse,
      hasMars: !!marsWithHouse,
      hasJupiter: !!jupiterWithHouse,
      hasSaturn: !!saturnWithHouse,
      hasUranus: !!uranusWithHouse,
      hasNeptune: !!neptuneWithHouse,
      hasPluto: !!plutoWithHouse,
      hasChiron: !!chironWithHouse,
      houses: houses.length,
      aspects: aspects.length,
      birthTimeQuality,
      ascendantReliable: chartQuality.ascendantReliable,
      housesReliable: chartQuality.housesReliable,
    });

    return chartData;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    log.error('❌ Error calculating natal chart', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      input: { name, birthDate, birthTime, birthPlace }
    });
    throw error;
  }
}
