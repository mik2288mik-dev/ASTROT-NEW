/**
 * Swiss Ephemeris Calculator - Native версия
 * Использует нативный модуль swisseph-v2 для точных астрономических расчетов
 */
import axios from 'axios';
import path from 'path';
import tzLookup from 'tz-lookup';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import * as swisseph from 'swisseph-v2';
import { CANONICAL_NATAL_CALCULATION_VERSION, normalizeCoordinateForStorage } from './natalChartCanonical';

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
};

interface Coordinates {
  lat: number;
  lon: number;
  timezone: string;
}

interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  longitude: number;
  retrograde: boolean;
  speedLongitude: number;
  description: string;
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

/**
 * Инициализация Swiss Ephemeris Native
 */
function initSwissEph() {
  if (isInitialized && sweInstance) {
    log.info('Swiss Ephemeris already initialized, reusing instance');
    return sweInstance;
  }

  try {
    log.info('Initializing Swiss Ephemeris Native...');
    
    // swisseph-v2 уже инициализирован при импорте
    sweInstance = swisseph;
    
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
        
        if (ephePath) {
          // Проверяем наличие файлов эфемерид
          const files = fs.readdirSync(ephePath);
          const epheFiles = files.filter((f: string) => f.endsWith('.se1'));
          
          if (epheFiles.length === 0) {
            throw new Error(`Папка эфемерид найдена (${ephePath}), но файлы .se1 отсутствуют`);
          }
          
          sweInstance.swe_set_ephe_path(ephePath);
          
          log.info(`✓ Ephemeris path set to: ${ephePath}`, {
            path: ephePath,
            filesCount: epheFiles.length,
            note: 'Using high-precision Swiss Ephemeris files (.se1) for calculations'
          });
        } else {
          const errorMsg = `Эфемериды не найдены. Проверенные пути: ${possiblePaths.join(', ')}`;
          log.error(errorMsg, {
            cwd: process.cwd(),
            envEPHE_PATH: process.env.EPHE_PATH,
            checkedPaths: possiblePaths
          });
          throw new Error(errorMsg);
        }
      } else {
        log.warn('swe_set_ephe_path is not available', {
          note: 'Library may use built-in ephemeris data. Calculations will still be accurate.'
        });
      }
    } catch (epheError: any) {
      log.error('Ephemeris path setup failed', { 
        error: epheError.message,
        note: 'Cannot proceed without ephemeris files'
      });
      throw new Error(`Ошибка настройки астрономических данных: ${epheError.message}`);
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

/**
 * Получение координат и часового пояса по названию места через геокодинг
 * С retry логикой для надёжности
 */
export async function getCoordinates(placeName: string, retryCount = 0): Promise<Coordinates> {
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
          'User-Agent': 'LumiaApp/1.0 (https://lumia.app)',
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
        return getCoordinates(placeName, retryCount + 1);
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
  
  log.info(`[getZodiacSign] ✓ Calculated`, {
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
    'Ascendant': 'Your outer personality and first impressions.'
  };
  return descriptions[planetName] || 'Planetary influence.';
}

/**
 * Рассчитывает положение планеты в натальной карте используя Swiss Ephemeris
 */
function calculatePlanetPosition(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  planetId: number,
  planetName: string
): PlanetPosition | null {
  try {
    // Используем флаги для точных расчетов: SEFLG_SWIEPH | SEFLG_SPEED
    const flags = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED;
    const result = swe.swe_calc_ut(julday, planetId, flags);
    
    if (!result || typeof result.longitude !== 'number') {
      log.error(`Failed to calculate ${planetName}`, { result });
      return null;
    }
    
    const longitude = result.longitude;
    
    const sign = getZodiacSign(longitude);
    const degreeInSign = getDegreeInSign(longitude);

    log.info(`[PLANET] Calculated ${planetName}`, { 
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
function calculateAnglesAndHouses(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  lat: number,
  lon: number
): { ascendant: PlanetPosition; houses: NatalHouseData[] } | null {
  try {
    const result = swe.swe_houses(julday, lat, lon, 'P');

    if (!result || typeof result.ascendant !== 'number') {
      log.error('Failed to calculate ascendant', { result });
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
  element: string;
  rulingPlanet: string;
  latitude: number;
  longitude: number;
  timezone: string;
  houses: NatalHouseData[];
  aspects: NatalAspectData[];
  calculationVersion: string;
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
  options?: { coordinates?: Coordinates }
): Promise<NatalChartResult> {
  const startTime = Date.now();
  
  try {
    log.info('Starting natal chart calculation', {
      name,
      birthDate,
      birthTime: birthTime || '12:00 (default)',
      birthPlace
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
    const [sun, moon, mercury, venus, mars, jupiter, saturn, angleData] = await Promise.all([
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.SUN, 'Sun')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MOON, 'Moon')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MERCURY, 'Mercury')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.VENUS, 'Venus')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.MARS, 'Mars')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.JUPITER, 'Jupiter')),
      Promise.resolve(calculatePlanetPosition(swe, julianDay, PLANETS.SATURN, 'Saturn')),
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

    // Валидация знаков зодиака
    const validSigns = ZODIAC_SIGNS as readonly string[];
    if (!validSigns.includes(sun.sign)) {
      throw new Error(`Invalid Sun sign: ${sun.sign}`);
    }
    if (!validSigns.includes(moon.sign)) {
      throw new Error(`Invalid Moon sign: ${moon.sign}`);
    }
    if (!validSigns.includes(ascendant.sign)) {
      throw new Error(`Invalid Ascendant sign: ${ascendant.sign}`);
    }

    // Шаг 8: Расчет дополнительных параметров
    const positions = [sun, moon, ascendant].filter(p => p !== null) as PlanetPosition[];
    if (mercury) positions.push(mercury);
    if (venus) positions.push(venus);
    if (mars) positions.push(mars);
    if (jupiter) positions.push(jupiter);
    if (saturn) positions.push(saturn);
    
    const element = calculateElement(positions);
    const rulingPlanet = calculateRulingPlanet(sun.sign);
    const aspects = calculateAspects(positions);

    // Шаг 9: Формирование результата
    const chartData: NatalChartResult = {
      sun,
      moon,
      rising: ascendant,
      mercury: mercury || null,
      venus: venus || null,
      mars: mars || null,
      jupiter: jupiter || null,
      saturn: saturn || null,
      element,
      rulingPlanet,
      latitude: normalizeCoordinateForStorage(coords.lat),
      longitude: normalizeCoordinateForStorage(coords.lon),
      timezone: coords.timezone,
      houses,
      aspects,
      calculationVersion: CANONICAL_NATAL_CALCULATION_VERSION,
      summary: `Natal chart for ${name}, born on ${birthDate} at ${birthTime || '12:00'} in ${birthPlace}. Your chart reveals a ${element} dominant personality with ${sun.sign} Sun, ${moon.sign} Moon, and ${ascendant.sign} Rising.`
    };

    // Дополнительная валидация знака Солнца (для логирования)
    const expectedSignByDate = getExpectedSunSignByDate(birthYear, birthMonth, birthDay);
    const signMatch = sun.sign === expectedSignByDate;
    
    if (!signMatch) {
      log.warn(`[VALIDATION] Sun sign mismatch (approximate)`, {
        calculated: { sign: sun.sign, degree: sun.degree.toFixed(4) },
        expected: { sign: expectedSignByDate },
        note: 'Approximate based on date only - actual calculation is more accurate'
      });
    } else {
      log.info(`[VALIDATION] ✓ Sun sign matches expected approximate value`, {
        sunSign: sun.sign
      });
    }

    const duration = Date.now() - startTime;
    log.info('✓ Natal chart calculated successfully', {
      duration: `${duration}ms`,
      sunSign: sun.sign,
      moonSign: moon.sign,
      risingSign: ascendant.sign,
      element,
      rulingPlanet,
      hasMercury: !!mercury,
      hasVenus: !!venus,
      hasMars: !!mars,
      hasJupiter: !!jupiter,
      hasSaturn: !!saturn,
      houses: houses.length,
      aspects: aspects.length,
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
