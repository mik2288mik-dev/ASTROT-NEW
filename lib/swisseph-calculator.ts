/**
 * Swiss Ephemeris Calculator - Factory для выбора между Native и WASM версиями
 * На сервере всегда используется Native версия для максимальной производительности
 * На клиенте можно выбрать WASM через переменную окружения USE_SWE_WASM
 */
import axios from 'axios';
import path from 'path';
import tzLookup from 'tz-lookup';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const IS_SERVER = typeof window === 'undefined';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[SwissephCalculator-WASM] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[SwissephCalculator-WASM] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[SwissephCalculator-WASM] WARNING: ${message}`, data || '');
  },
};

// Динамический импорт для более надежной загрузки модуля
let SwissEPH: any = null;
let swephModuleLoading: Promise<any> | null = null;

/**
 * Загружает модуль sweph-wasm с обработкой ошибок
 */
async function loadSwephModule() {
  if (SwissEPH) {
    return SwissEPH;
  }
  
  if (swephModuleLoading) {
    return swephModuleLoading;
  }
  
  swephModuleLoading = (async () => {
    try {
      log.info('Loading sweph-wasm module...');
      
      // Пробуем динамический импорт (ES6 модули)
      let swephModule: any;
      try {
        swephModule = await import('sweph-wasm');
      } catch (importError: any) {
        log.warn('ES6 import failed, trying require...', { error: importError.message });
        // Fallback на require для CommonJS (работает в Node.js серверной среде)
        // Используем require через глобальный объект Node.js
        if (typeof require !== 'undefined') {
          swephModule = require('sweph-wasm');
        } else {
          throw new Error('Neither ES6 import nor require is available');
        }
      }
      
      // Модуль может экспортироваться по-разному:
      // 1. Как default export: swephModule.default
      // 2. Как именованный export: swephModule
      // 3. Как функция напрямую: swephModule (если это CommonJS)
      SwissEPH = swephModule.default || swephModule;
      
      if (!SwissEPH) {
        throw new Error('sweph-wasm module loaded but export is null or undefined');
      }
      
      // Проверяем, что это функция или объект с методом init
      if (typeof SwissEPH !== 'function' && typeof SwissEPH !== 'object') {
        throw new Error(`sweph-wasm module has unexpected type: ${typeof SwissEPH}`);
      }
      
      // Если это функция, она должна быть функцией init
      if (typeof SwissEPH === 'function' && SwissEPH.name !== 'init') {
        // Возможно, это обертка, пробуем вызвать
        log.info('Module is a function, checking if it has init method...');
      }
      
      log.info('✓ sweph-wasm module loaded successfully', {
        hasInit: typeof SwissEPH.init === 'function',
        moduleType: typeof SwissEPH,
        isFunction: typeof SwissEPH === 'function',
        moduleKeys: typeof SwissEPH === 'object' ? Object.keys(SwissEPH).slice(0, 10) : []
      });
      
      return SwissEPH;
    } catch (error: any) {
      log.error('Failed to load sweph-wasm module', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      });
      swephModuleLoading = null;
      throw new Error(`Не удалось загрузить модуль астрономических расчетов: ${error.message || 'Неизвестная ошибка'}`);
    }
  })();
  
  return swephModuleLoading;
}

// Импортируем централизованные данные о знаках зодиака
const { ZODIAC_SIGNS, getElementForSign: getElementForSignUtil, getRulingPlanet: getRulingPlanetUtil } = require('./zodiac-utils');
import type { ZodiacSign } from './zodiac-utils';

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
  description: string;
}

// Глобальная инициализация Swiss Ephemeris
// Тип из sweph-wasm может быть любым, но мы используем его методы
let sweInstance: any = null;
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Native calculator instance
let nativeSweInstance: any = null;
let nativeInitialized = false;

/**
 * Получение Native калькулятора Swiss Ephemeris
 */
async function getNativeCalculator() {
  if (nativeInitialized && nativeSweInstance) {
    log.info('Native Swiss Ephemeris already initialized, reusing instance');
    return nativeSweInstance;
  }

  try {
    log.info('Initializing Swiss Ephemeris Native...');
    
    // Динамический импорт native модуля
    const swisseph = require('swisseph');
    
    // Устанавливаем путь к эфемеридам перед расчетами
    const ephePath = process.env.EPHE_PATH || '/app/ephe';
    swisseph.swe_set_ephe_path(ephePath);
    log.info(`✓ Ephemeris path set to: ${ephePath}`);
    
    nativeSweInstance = swisseph;
    nativeInitialized = true;
    
    log.info('✓ Swiss Ephemeris Native initialized successfully');
    return nativeSweInstance;
  } catch (error: any) {
    log.error('❌ Failed to initialize Swiss Ephemeris Native', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    throw new Error(`Ошибка инициализации Native астрономических расчетов: ${error.message || 'Неизвестная ошибка'}`);
  }
}

/**
 * Получение WASM калькулятора Swiss Ephemeris
 */
async function getWasmCalculator() {
  return initSwissEph();
}

/**
 * Фабрика для выбора калькулятора Swiss Ephemeris
 * На сервере всегда используется Native версия
 * На клиенте можно выбрать WASM через USE_SWE_WASM
 */
async function getSwissephCalculator() {
  // На сервере ВСЕГДА используем native
  if (IS_SERVER) {
    return getNativeCalculator();
  }
  
  // На клиенте можно выбрать WASM через переменную окружения
  if (!IS_SERVER && process.env.USE_SWE_WASM === 'true') {
    return getWasmCalculator();
  }
  
  // Всё остальное возвращает native
  return getNativeCalculator();
}

/**
 * Инициализация Swiss Ephemeris WASM
 */
async function initSwissEph() {
  if (isInitialized && sweInstance) {
    log.info('Swiss Ephemeris already initialized, reusing instance');
    return sweInstance;
  }

  try {
    log.info('Initializing Swiss Ephemeris WebAssembly...');
    
    // Сначала загружаем модуль, если он еще не загружен
    if (!SwissEPH) {
      try {
        SwissEPH = await loadSwephModule();
      } catch (loadError: any) {
        log.error('Failed to load Swiss Ephemeris module', {
          error: loadError.message,
          stack: loadError.stack
        });
        throw new Error(`Не удалось загрузить модуль астрономических расчетов: ${loadError.message || 'Неизвестная ошибка'}`);
      }
    }
    
    // Проверяем доступность модуля
    if (!SwissEPH || typeof SwissEPH.init !== 'function') {
      const errorMsg = 'SwissEPH module is not available or init function is missing';
      log.error(errorMsg, { 
        SwissEPH: typeof SwissEPH, 
        hasInit: typeof SwissEPH?.init,
        moduleKeys: SwissEPH ? Object.keys(SwissEPH).slice(0, 10) : []
      });
      throw new Error(errorMsg);
    }
    
    // Инициализируем Swiss Ephemeris с timeout для предотвращения зависания
    let initResult;
    try {
      log.info('Calling SwissEPH.init()...');
      
      // Добавляем timeout для предотвращения зависания (30 секунд)
      const initPromise = SwissEPH.init();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout after 30 seconds')), 30000)
      );
      
      initResult = await Promise.race([initPromise, timeoutPromise]);
      
      log.info('SwissEPH.init() completed', { 
        hasResult: !!initResult,
        resultType: typeof initResult,
        hasMethods: initResult ? Object.keys(initResult).slice(0, 5) : []
      });
    } catch (initError: any) {
      log.error('Failed to initialize Swiss Ephemeris WASM', {
        error: initError.message,
        stack: initError.stack,
        name: initError.name,
        code: initError.code
      });
      
      // Более детальное сообщение об ошибке
      let errorMessage = initError.message || 'Unknown initialization error';
      if (initError.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания инициализации модуля расчетов';
      } else if (initError.message?.includes('WebAssembly') || initError.message?.includes('wasm')) {
        errorMessage = 'Ошибка загрузки WebAssembly модуля расчетов';
      }
      
      throw new Error(`Failed to initialize ephemeris calculator: ${errorMessage}`);
    }
    
    sweInstance = initResult;
    
    if (!sweInstance) {
      const errorMsg = 'Swiss Ephemeris instance is null after initialization';
      log.error(errorMsg, { initResult });
      throw new Error(errorMsg);
    }
    
    // Проверяем наличие необходимых методов
    type SwissEPHRequiredMethod = 'swe_calc_ut' | 'swe_julday' | 'swe_houses' | 'swe_set_ephe_path';
    
    const requiredMethods: SwissEPHRequiredMethod[] = [
      'swe_calc_ut',
      'swe_julday',
      'swe_houses',
      'swe_set_ephe_path',
    ];
    
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
    
    // Устанавливаем путь к эфемеридам (не критично, библиотека может работать со встроенными данными)
    try {
      if (typeof sweInstance.swe_set_ephe_path === 'function') {
        await sweInstance.swe_set_ephe_path();
        log.info('✓ Ephemeris path initialized');
      } else {
        log.warn('swe_set_ephe_path is not available, skipping ephemeris path setup');
      }
    } catch (epheError: any) {
      log.warn('Ephemeris path warning (will use built-in data)', { 
        error: epheError.message
      });
      // Не критично - библиотека может работать со встроенными данными
    }
    
    isInitialized = true;
    initializationAttempts = 0; // Сбрасываем счетчик при успешной инициализации
    log.info('✓ Swiss Ephemeris initialized successfully');
    return sweInstance;
  } catch (error: any) {
    initializationAttempts++;
    log.error('❌ Failed to initialize Swiss Ephemeris', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      isInitialized,
      hasInstance: !!sweInstance,
      attempt: initializationAttempts,
      maxAttempts: MAX_INIT_ATTEMPTS
    });
    
    // Сбрасываем состояние при ошибке, чтобы можно было попробовать снова
    isInitialized = false;
    sweInstance = null;
    
    // Если это не последняя попытка и ошибка не критическая, пробуем еще раз
    if (initializationAttempts < MAX_INIT_ATTEMPTS && 
        !error.message?.includes('module') && 
        !error.message?.includes('timeout')) {
      log.info(`Retrying initialization (attempt ${initializationAttempts + 1}/${MAX_INIT_ATTEMPTS})...`);
      // Небольшая задержка перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 1000));
      return initSwissEph();
    }
    
    // Сбрасываем счетчик попыток после всех попыток
    if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
      initializationAttempts = 0;
    }
    
    // Пробрасываем оригинальное сообщение с дополнительным контекстом
    const errorMessage = error.message || 'Unknown initialization error';
    throw new Error(`Ошибка инициализации астрономических расчетов: ${errorMessage}`);
  }
}

/**
 * Конвертирует локальное время в UTC с учетом реального часового пояса
 * Использует date-fns-tz для точной конвертации
 * 
 * @param year - Год рождения
 * @param month - Месяц рождения (1-12)
 * @param day - День рождения (1-31)
 * @param hour - Час рождения (0-23)
 * @param minute - Минута рождения (0-59)
 * @param timezone - Название часового пояса (например, 'Europe/Moscow', 'America/New_York')
 * @returns Объект с UTC временем и скорректированной датой
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
    // ИСПРАВЛЕНО: Правильный способ конвертации локального времени в UTC с использованием date-fns-tz
    
    // Создаем строку даты в формате ISO (без указания timezone)
    // Это представляет локальное время в указанном часовом поясе
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    
    log.info('Converting local time to UTC', {
      input: { year, month, day, hour, minute },
      timezone,
      dateString
    });
    
    // Используем fromZonedTime для конвертации локального времени в указанном часовом поясе в UTC
    // fromZonedTime принимает строку и интерпретирует её как локальное время в указанном timezone
    const utcDate = fromZonedTime(dateString, timezone);
    
    // Для проверки: конвертируем обратно в локальное время в указанном timezone
    const localInTimezone = toZonedTime(utcDate, timezone);
    
    // Извлекаем компоненты UTC даты
    const utcYear = utcDate.getUTCFullYear();
    const utcMonth = utcDate.getUTCMonth() + 1; // getUTCMonth() возвращает 0-11
    const utcDay = utcDate.getUTCDate();
    const utcHour = utcDate.getUTCHours();
    const utcMinute = utcDate.getUTCMinutes();
    const utcTimeInHours = utcHour + utcMinute / 60.0;
    
    // Проверяем, что конвертация обратно дает правильное локальное время
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
      // Продолжаем выполнение, но логируем ошибку для отладки
    }
    
    return { utcYear, utcMonth, utcDay, utcHour, utcMinute, utcTimeInHours };
  } catch (error: any) {
    log.error('Error converting local time to UTC', { error: error.message, timezone, year, month, day, hour, minute });
    throw new Error(`Failed to convert time with timezone ${timezone}: ${error.message}`);
  }
}

/**
 * Получение координат и часового пояса по названию места через геокодинг
 * Использует точное определение часового пояса через tz-lookup
 */
export async function getCoordinates(placeName: string): Promise<Coordinates> {
  try {
    log.info('Getting coordinates and timezone for place', { placeName });
    
    const url = 'https://nominatim.openstreetmap.org/search';
    
    let response;
    try {
      response = await axios.get(url, {
        params: {
          q: placeName,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'AstrotApp/1.0'
        },
        timeout: 15000 // Увеличили timeout до 15 секунд
      });
    } catch (axiosError: any) {
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        throw new Error(`Timeout getting coordinates for location: ${placeName}. Please check your internet connection and try again.`);
      }
      throw new Error(`Network error getting coordinates for ${placeName}: ${axiosError.message}`);
    }

    if (!response.data || response.data.length === 0) {
      throw new Error(`Location not found: ${placeName}. Please check the spelling and try again (e.g., "Moscow, Russia" or "Москва, Россия").`);
    }

    const location = response.data[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Invalid coordinates received for location: ${placeName}`);
    }

    // Точное определение часового пояса по координатам
    let timezone: string;
    try {
      timezone = tzLookup(lat, lon);
      log.info('Timezone determined accurately', { lat, lon, timezone, placeName });
    } catch (tzError: any) {
      log.warn('Failed to determine timezone, using UTC', { error: tzError.message });
      timezone = 'UTC';
    }

    log.info('Coordinates and timezone found', { lat, lon, timezone, placeName, displayName: location.display_name });

    return { lat, lon, timezone };
  } catch (error: any) {
    log.error('Error getting coordinates', error);
    // Пробрасываем оригинальное сообщение об ошибке
    throw error;
  }
}

/**
 * Определяет знак зодиака по эклиптической долготе планеты
 * 
 * Эклиптическая долгота - это угол от точки весеннего равноденствия (0° Овна)
 * до текущего положения планеты на эклиптике. Каждый знак зодиака занимает 30°.
 * 
 * @param degree - Эклиптическая долгота в градусах (0-360)
 * @returns Название знака зодиака на английском (Aries, Taurus, и т.д.)
 * 
 * @example
 * getZodiacSign(45) // 'Taurus' (45° находится во втором знаке)
 * getZodiacSign(180) // 'Libra' (180° находится в седьмом знаке)
 */
export function getZodiacSign(degree: number): string {
  // Нормализуем градус в диапазон 0-360
  // Используем более надежную нормализацию для обработки отрицательных значений и значений > 360
  let normalizedDegree = degree % 360;
  if (normalizedDegree < 0) {
    normalizedDegree += 360;
  }
  
  // Убеждаемся что значение в правильном диапазоне
  if (normalizedDegree >= 360) {
    normalizedDegree = normalizedDegree % 360;
  }
  if (normalizedDegree < 0) {
    normalizedDegree = 0;
  }
  
  // Определяем индекс знака (0-11)
  // 0°-30° = Aries (0), 30°-60° = Taurus (1), ..., 330°-360° = Pisces (11)
  // Важно: Math.floor правильно обрабатывает граничные случаи
  // Например: 30.0° -> index 1 (Taurus), 29.999° -> index 0 (Aries)
  // 345° -> index 11 (Pisces)
  const signIndex = Math.floor(normalizedDegree / 30);
  
  // Обрабатываем граничный случай: ровно 360° должен быть Aries (0)
  // signIndex может быть 12 только если normalizedDegree = 360.0 (что не должно произойти после нормализации)
  const finalIndex = signIndex >= 12 ? 0 : (signIndex < 0 ? 0 : signIndex);
  
  // Используем централизованный массив знаков
  const { ZODIAC_SIGNS: signs } = require('./zodiac-utils');
  
  if (finalIndex < 0 || finalIndex >= signs.length) {
    log.error(`[getZodiacSign] ❌ Invalid sign index: ${finalIndex} for degree ${degree}, normalized: ${normalizedDegree}`);
    return signs[0]; // Fallback to Aries
  }
  
  const signName = signs[finalIndex];
  const degreeInSign = normalizedDegree % 30;
  
  // Детальное логирование для отладки
  log.info(`[getZodiacSign] ✓ Calculated`, {
    inputDegree: degree.toFixed(6),
    normalizedDegree: normalizedDegree.toFixed(6),
    signIndex: finalIndex,
    signName: signName,
    degreeInSign: degreeInSign.toFixed(4),
    fullPosition: `${degreeInSign.toFixed(2)}° ${signName}`,
    zodiacMapping: `${normalizedDegree.toFixed(2)}° = ${signName} (${finalIndex * 30}° - ${(finalIndex + 1) * 30}°)`
  });
  
  return signName;
}

/**
 * Вычисляет градус планеты внутри знака зодиака
 * 
 * Например, если эклиптическая долгота = 45°, то планета находится в Тельце (30-60°)
 * на 15° внутри знака (45 - 30 = 15°).
 * 
 * @param degree - Эклиптическая долгота в градусах (0-360)
 * @returns Градус внутри знака (0-29.99...)
 * 
 * @example
 * getDegreeInSign(45) // 15 (45° - 30° = 15° в Тельце)
 * getDegreeInSign(180) // 0 (180° - 180° = 0° в Весах)
 */
export function getDegreeInSign(degree: number): number {
  // Нормализуем градус в диапазон 0-360
  let normalizedDegree = degree % 360;
  if (normalizedDegree < 0) {
    normalizedDegree += 360;
  }
  
  // Вычисляем градус внутри знака (0-29.999...)
  // Например: 45° -> 15° в Тельце, 180° -> 0° в Весах
  const degreeInSign = normalizedDegree % 30;
  
  // Округляем до 2 знаков после запятой для читаемости, но возвращаем точное значение
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
 * 
 * Использует точные астрономические расчеты для определения эклиптической долготы планеты,
 * затем вычисляет знак зодиака и градус внутри знака.
 * 
 * @param swe - Экземпляр Swiss Ephemeris (инициализированный)
 * @param julday - Юлианский день для момента рождения
 * @param planetId - ID планеты в Swiss Ephemeris (0=Sun, 1=Moon, 2=Mercury, и т.д.)
 * @param planetName - Название планеты для логирования ('Sun', 'Moon', и т.д.)
 * @returns Объект с данными о положении планеты или null при ошибке
 * 
 * @example
 * const sunPosition = await calculatePlanetPosition(swe, 2451545.0, PLANETS.SUN, 'Sun');
 * // { planet: 'Sun', sign: 'Aries', degree: 15.5, description: '...' }
 */
async function calculatePlanetPosition(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  planetId: number,
  planetName: string
): Promise<PlanetPosition | null> {
  try {
    // Используем флаги Swiss Ephemeris для точных расчетов:
    // SEFLG_SWIEPH (2) = использовать Swiss Ephemeris (самые точные данные)
    // SEFLG_SPEED (256) = включить скорость планеты
    // 258 = 2 | 256 = SEFLG_SWIEPH | SEFLG_SPEED
    // Результат: эклиптическая долгота в градусах (0-360°)
    const result = swe.swe_calc_ut(julday, planetId, 258);
    
    // Адаптер для совместимости: WASM возвращает массив, Native возвращает объект
    let longitude: number;
    if (Array.isArray(result)) {
      // WASM версия: result[0] = эклиптическая долгота
      if (!result || result.length < 3) {
        log.error(`Failed to calculate ${planetName}`, { result });
        return null;
      }
      longitude = result[0];
    } else {
      // Native версия: result.longitude = эклиптическая долгота
      if (!result || typeof result.longitude !== 'number') {
        log.error(`Failed to calculate ${planetName}`, { result });
        return null;
      }
      longitude = result.longitude;
    }
    const sign = getZodiacSign(longitude);
    const degreeInSign = getDegreeInSign(longitude);

    log.info(`[PLANET] Calculated ${planetName}`, { 
      longitude: longitude.toFixed(6), 
      sign, 
      degreeInSign: degreeInSign.toFixed(4),
      fullDegree: `${degreeInSign.toFixed(2)}° ${sign}`,
      signIndex: Math.floor((longitude % 360) / 30)
    });

    return {
      planet: planetName,
      sign,
      degree: degreeInSign,
      description: getPlanetDescription(planetName)
    };
  } catch (error: any) {
    log.error(`Error calculating ${planetName}`, error);
    return null;
  }
}

/**
 * Рассчитывает Асцендент (Rising Sign) - знак зодиака на восточном горизонте в момент рождения
 * 
 * Асцендент зависит от точного времени и места рождения, так как Земля вращается,
 * и знак на горизонте меняется каждые 2 часа. Использует систему домов Placidus.
 * 
 * @param swe - Экземпляр Swiss Ephemeris (инициализированный)
 * @param julday - Юлианский день для момента рождения
 * @param lat - Широта места рождения в градусах (-90 до 90)
 * @param lon - Долгота места рождения в градусах (-180 до 180)
 * @returns Объект с данными об Асценденте или null при ошибке
 * 
 * @example
 * const ascendant = await calculateAscendant(swe, 2451545.0, 55.7558, 37.6173);
 * // { planet: 'Ascendant', sign: 'Leo', degree: 12.3, description: '...' }
 */
async function calculateAscendant(
  swe: NonNullable<typeof sweInstance>,
  julday: number,
  lat: number,
  lon: number
): Promise<PlanetPosition | null> {
  try {
    // Используем систему домов Placidus ('P')
    const result = swe.swe_houses(julday, lat, lon, 'P');

    // Адаптер для совместимости: WASM возвращает ascmc[0], Native возвращает ascendant
    let ascendant: number;
    if (result && result.ascmc && Array.isArray(result.ascmc)) {
      // WASM версия: result.ascmc[0] = Ascendant
      ascendant = result.ascmc[0];
    } else if (result && typeof result.ascendant === 'number') {
      // Native версия: result.ascendant = Ascendant
      ascendant = result.ascendant;
    } else {
      log.error('Failed to calculate ascendant', { result });
      return null;
    }
    const sign = getZodiacSign(ascendant);
    const degreeInSign = getDegreeInSign(ascendant);

    log.info('Calculated Ascendant', { 
      ascendant: ascendant.toFixed(4), 
      sign, 
      degreeInSign: degreeInSign.toFixed(2) 
    });

    return {
      planet: 'Ascendant',
      sign,
      degree: degreeInSign,
      description: 'Your outer personality and first impressions.'
    };
  } catch (error: any) {
    log.error('Error calculating ascendant', error);
    return null;
  }
}

/**
 * Определяет доминирующий элемент (стихию) на основе положений планет
 * 
 * Элементы: Fire (Огонь), Earth (Земля), Air (Воздух), Water (Вода).
 * Каждый знак зодиака принадлежит одному элементу. Функция подсчитывает,
 * какой элемент встречается чаще всего среди планет.
 * 
 * @param positions - Массив положений планет в натальной карте
 * @returns Название доминирующего элемента ('Fire', 'Earth', 'Air', или 'Water')
 * 
 * @example
 * const positions = [
 *   { sign: 'Aries', ... },    // Fire
 *   { sign: 'Leo', ... },       // Fire
 *   { sign: 'Cancer', ... }     // Water
 * ];
 * calculateElement(positions) // 'Fire' (2 против 1)
 */
function calculateElement(positions: PlanetPosition[]): string {
  // Используем централизованные данные о элементах для избежания дублирования
  const { getElementForSign } = require('./zodiac-utils');

  const elementCounts: { [key: string]: number } = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0
  };

  // Подсчитываем элементы для каждой планеты
  positions.forEach(position => {
      const element = getElementForSign(position.sign as ZodiacSign);
    if (element) {
      elementCounts[element]++;
    }
  });

  // Находим элемент с максимальным количеством
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
 * 
 * ВАЖНО: Это приблизительная функция для валидации!
 * - Точное время входа Солнца в знак меняется от года к году (на 1-2 дня)
 * - Не учитывает точное время суток и часовой пояс
 * - Используется только для выявления явных ошибок в расчетах
 * 
 * Реальный знак зодиака ВСЕГДА должен определяться по точной эклиптической долготе,
 * полученной из Swiss Ephemeris, как это делается в функции getZodiacSign().
 * 
 * @deprecated Используйте getApproximateSunSignByDate из lib/zodiac-utils.ts
 */
function getExpectedSunSignByDate(year: number, month: number, day: number): string {
  // Импортируем централизованную функцию для избежания дублирования
  const { getApproximateSunSignByDate } = require('./zodiac-utils');
  return getApproximateSunSignByDate(year, month, day);
}

/**
 * Определяет управляющую (управитель) планету знака зодиака Солнца
 * 
 * Каждый знак зодиака имеет свою управляющую планету:
 * - Овен → Марс, Телец → Венера, Близнецы → Меркурий
 * - Рак → Луна, Лев → Солнце, Дева → Меркурий
 * - Весы → Венера, Скорпион → Плутон, Стрелец → Юпитер
 * - Козерог → Сатурн, Водолей → Уран, Рыбы → Нептун
 * 
 * @param sunSign - Знак зодиака Солнца (Aries, Taurus, и т.д.)
 * @returns Название управляющей планеты ('Mars', 'Venus', и т.д.)
 * 
 * @example
 * calculateRulingPlanet('Aries') // 'Mars'
 * calculateRulingPlanet('Leo') // 'Sun'
 */
/**
 * Определение управляющей планеты
 * 
 * @deprecated Используйте getRulingPlanet из lib/zodiac-utils.ts
 */
function calculateRulingPlanet(sunSign: string): string {
  // Используем централизованную функцию для избежания дублирования
  const { getRulingPlanet } = require('./zodiac-utils');
  return getRulingPlanet(sunSign as any) || 'Sun';
}

/**
 * Рассчитывает полную натальную карту для человека
 * 
 * Натальная карта - это "снимок" неба в момент рождения человека.
 * Функция вычисляет положения всех планет, Асцендент, определяет доминирующий
 * элемент и управляющую планету.
 * 
 * Процесс расчета:
 * 1. Получает координаты места рождения через геокодинг
 * 2. Конвертирует локальное время в UTC с учетом часового пояса
 * 3. Вычисляет Юлианский день для момента рождения
 * 4. Рассчитывает положения планет (Солнце, Луна, Меркурий, Венера, Марс)
 * 5. Вычисляет Асцендент на основе координат и времени
 * 6. Определяет доминирующий элемент и управляющую планету
 * 
 * @param name - Имя человека (используется только для описания)
 * @param birthDate - Дата рождения в формате YYYY-MM-DD
 * @param birthTime - Время рождения в формате HH:MM (24-часовой формат)
 * @param birthPlace - Название места рождения (город, страна)
 * @returns Объект с данными натальной карты:
 *   - sun, moon, rising, mercury, venus, mars: положения планет
 *   - element: доминирующий элемент ('Fire', 'Earth', 'Air', 'Water')
 *   - rulingPlanet: управляющая планета знака Солнца
 *   - summary: текстовое описание карты
 * 
 * @throws Error если не удалось инициализировать Swiss Ephemeris или рассчитать карту
 * 
 * @example
 * const chart = await calculateNatalChart(
 *   'John Doe',
 *   '1990-05-15',
 *   '14:30',
 *   'Moscow, Russia'
 * );
 * console.log(chart.sun.sign); // 'Taurus'
 * console.log(chart.element); // 'Earth'
 */
export interface NatalChartResult {
  sun: PlanetPosition;
  moon: PlanetPosition;
  rising: PlanetPosition;
  mercury: PlanetPosition | null;
  venus: PlanetPosition | null;
  mars: PlanetPosition | null;
  element: string;
  rulingPlanet: string;
  summary: string;
}

export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string
): Promise<NatalChartResult> {
  try {
    log.info('Starting natal chart calculation with Swiss Ephemeris', {
      name,
      birthDate,
      birthTime,
      birthPlace
    });

    // Инициализируем Swiss Ephemeris с улучшенной обработкой ошибок
    let swe;
    try {
      swe = await getSwissephCalculator();
      if (!swe) {
        throw new Error('Swiss Ephemeris instance is null after initialization');
      }
      log.info('✓ Swiss Ephemeris initialized and ready for calculations');
    } catch (initError: any) {
      log.error('Failed to initialize Swiss Ephemeris for calculation', {
        error: initError.message,
        stack: initError.stack,
        name: initError.name
      });
      // Пробрасываем ошибку с понятным сообщением
      throw new Error(`Ошибка инициализации астрономических расчетов: ${initError.message || 'Неизвестная ошибка'}`);
    }

    // Получаем координаты места рождения
    const coords = await getCoordinates(birthPlace);

    // Парсим дату рождения из формата YYYY-MM-DD
    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    
    // Парсим время рождения из формата HH:MM
    let birthHour = 12; // По умолчанию полдень
    let birthMinute = 0;
    if (birthTime) {
      const timeParts = birthTime.split(':');
      birthHour = parseInt(timeParts[0], 10) || 12;
      birthMinute = parseInt(timeParts[1], 10) || 0;
      
      // Проверяем валидность времени
      if (birthHour < 0 || birthHour > 23) {
        log.warn(`Invalid hour ${birthHour}, using 12:00`);
        birthHour = 12;
      }
      if (birthMinute < 0 || birthMinute > 59) {
        log.warn(`Invalid minute ${birthMinute}, using 0`);
        birthMinute = 0;
      }
    }

    // Конвертируем локальное время в UTC с учетом реального часового пояса
    // Используем точную библиотеку date-fns-tz вместо приблизительного расчета
    const { utcYear, utcMonth, utcDay, utcHour, utcMinute, utcTimeInHours } = convertLocalTimeToUTC(
      birthYear,
      birthMonth,
      birthDay,
      birthHour,
      birthMinute,
      coords.timezone
    );
    
    // Конвертируем в Julian Day используя Swiss Ephemeris
    // Параметр 1 означает использование григорианского календаря
    const julianDay = swe.swe_julday(utcYear, utcMonth, utcDay, utcTimeInHours, 1);
    
    log.info('Calculated Julian Day with accurate timezone conversion', { 
      inputDate: `${birthYear}-${birthMonth}-${birthDay}`,
      inputTime: `${birthHour}:${birthMinute}`,
      coordinates: { lat: coords.lat, lon: coords.lon },
      timezone: coords.timezone,
      localTime: `${birthHour}:${birthMinute}`,
      utcTime: `${utcHour}:${utcMinute} (${utcTimeInHours.toFixed(4)} hours)`,
      utcDate: `${utcYear}-${utcMonth}-${utcDay}`,
      julianDay: julianDay.toFixed(6)
    });

    // Рассчитываем положения планет параллельно для оптимизации
    const [sun, moon, mercury, venus, mars, ascendant] = await Promise.all([
      calculatePlanetPosition(swe, julianDay, PLANETS.SUN, 'Sun'),
      calculatePlanetPosition(swe, julianDay, PLANETS.MOON, 'Moon'),
      calculatePlanetPosition(swe, julianDay, PLANETS.MERCURY, 'Mercury'),
      calculatePlanetPosition(swe, julianDay, PLANETS.VENUS, 'Venus'),
      calculatePlanetPosition(swe, julianDay, PLANETS.MARS, 'Mars'),
      calculateAscendant(swe, julianDay, coords.lat, coords.lon)
    ]);

    // Проверка уже выполнена выше при создании chartData

    // Проверяем что основные планеты не null
    if (!sun || !moon || !ascendant) {
      throw new Error('Failed to calculate essential planets: sun, moon, or ascendant is null');
    }

    // Определяем элемент и управляющую планету
    const positions = [sun, moon, ascendant].filter(p => p !== null) as PlanetPosition[];
    if (mercury) positions.push(mercury);
    if (venus) positions.push(venus);
    if (mars) positions.push(mars);
    
    const element = calculateElement(positions);
    const rulingPlanet = calculateRulingPlanet(sun.sign);

    const chartData: NatalChartResult = {
      sun,
      moon,
      rising: ascendant,
      mercury: mercury || null,
      venus: venus || null,
      mars: mars || null,
      element,
      rulingPlanet,
      summary: `Natal chart for ${name}, born on ${birthDate} at ${birthTime || '12:00'} in ${birthPlace}. Your chart reveals a ${element} dominant personality with ${sun.sign} Sun, ${moon.sign} Moon, and ${ascendant.sign} Rising.`
    };

    // Валидация: проверяем, что знак Солнца соответствует ожидаемому для даты рождения
    // Приблизительная проверка для выявления явных ошибок
    const expectedSignByDate = getExpectedSunSignByDate(birthYear, birthMonth, birthDay);
    const signMatch = sun.sign === expectedSignByDate;
    
    // Вычисляем эклиптическую долготу Солнца для детального логирования
    const sunResult = swe.swe_calc_ut(julianDay, PLANETS.SUN, 258);
    // Адаптер для совместимости: WASM возвращает массив, Native возвращает объект
    const sunLongitude = sunResult 
      ? (Array.isArray(sunResult) ? sunResult[0] : sunResult.longitude)
      : null;
    
    // Детальная валидация и логирование
    if (!signMatch) {
      // Проверяем, не находится ли Солнце близко к границе знака
      const isNearBoundary = sun.degree < 1.0 || sun.degree > 29.0;
      const signIndex = Math.floor((sunLongitude || 0) / 30);
      const expectedSignIndex = ZODIAC_SIGNS.indexOf(expectedSignByDate);
      const signDifference = Math.abs(signIndex - expectedSignIndex);
      
      log.warn(`[VALIDATION] Sun sign mismatch detected`, {
        calculated: {
          sign: sun.sign,
          degree: sun.degree.toFixed(4),
          longitude: sunLongitude ? sunLongitude.toFixed(6) : 'N/A',
          signIndex
        },
        expected: {
          sign: expectedSignByDate,
          signIndex: expectedSignIndex,
          note: 'Approximate based on date only (does not account for time of day or year variations)'
        },
        input: {
          date: `${birthYear}-${birthMonth}-${birthDay}`,
          time: `${birthHour}:${birthMinute}`,
          utcTime: `${utcHour}:${utcMinute}`,
          birthPlace,
          timezone: coords.timezone,
          coordinates: { lat: coords.lat, lon: coords.lon }
        },
        calculation: {
          julianDay: julianDay.toFixed(6),
          sunPosition: `${sun.degree.toFixed(2)}° ${sun.sign}`,
          isNearBoundary,
          signDifference
        },
        note: 'Mismatch may be due to: 1) Time of day near sign boundary, 2) Year-specific sign entry dates, 3) Timezone conversion. Using accurate Swiss Ephemeris calculation.'
      });
      
      // Если разница больше 1 знака, это может указывать на серьезную ошибку
      if (signDifference > 1) {
        log.error(`[VALIDATION] CRITICAL: Large sign difference detected!`, {
          calculatedSign: sun.sign,
          expectedSign: expectedSignByDate,
          difference: signDifference,
          sunLongitude: sunLongitude ? sunLongitude.toFixed(6) : 'N/A'
        });
      }
    } else {
      log.info(`[VALIDATION] ✓ Sun sign matches expected approximate value`, {
        sunSign: sun.sign,
        sunLongitude: sunLongitude ? sunLongitude.toFixed(6) : 'N/A',
        sunDegree: sun.degree.toFixed(4),
        date: `${birthYear}-${birthMonth}-${birthDay}`,
        timezone: coords.timezone,
        note: 'Approximate date-based check passed. Using accurate Swiss Ephemeris calculation.'
      });
    }

    log.info('🌟 Natal chart calculated successfully with Swiss Ephemeris', {
      hasSun: !!sun,
      hasMoon: !!moon,
      hasRising: !!ascendant,
      element,
      sunSign: sun.sign,
      moonSign: moon.sign,
      risingSign: ascendant.sign,
      expectedSunSignByDate: expectedSignByDate,
      sunSignMatch: signMatch,
      allPlanets: {
        sun: `${sun.sign} at ${sun.degree.toFixed(2)}°`,
        moon: `${moon.sign} at ${moon.degree.toFixed(2)}°`,
        rising: `${ascendant.sign} at ${ascendant.degree.toFixed(2)}°`
      }
    });

    return chartData;
  } catch (error: any) {
    log.error('Error calculating natal chart', error);
    throw error;
  }
}
