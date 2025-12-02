/**
 * Swiss Ephemeris Calculator - WebAssembly версия
 * Использует sweph-wasm для точных астрологических расчетов
 * БЕЗ нативных зависимостей - работает везде!
 */
import SwissEPH from 'sweph-wasm';
import axios from 'axios';
import path from 'path';

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

// Импортируем централизованные данные о знаках зодиака
const { ZODIAC_SIGNS } = require('./zodiac-utils');

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
let sweInstance: any = null;
let isInitialized = false;

/**
 * Инициализация Swiss Ephemeris WASM
 */
async function initSwissEph() {
  if (isInitialized && sweInstance) {
    return sweInstance;
  }

  try {
    log.info('Initializing Swiss Ephemeris WebAssembly...');
    sweInstance = await SwissEPH.init();
    
    // Устанавливаем путь к локальным файлам ephemeris если они есть
    const ephePath = process.env.EPHE_PATH || path.join(process.cwd(), 'ephe');
    log.info('Setting ephemeris path', { ephePath });
    
    // Примечание: sweph-wasm загружает файлы из CDN по умолчанию
    // Локальные файлы можно использовать настроив путь
    await sweInstance.swe_set_ephe_path();
    
    isInitialized = true;
    log.info('Swiss Ephemeris initialized successfully');
    return sweInstance;
  } catch (error: any) {
    log.error('Failed to initialize Swiss Ephemeris', error);
    throw new Error(`Failed to initialize Swiss Ephemeris: ${error.message}`);
  }
}

/**
 * Получение координат по названию места через геокодинг
 */
export async function getCoordinates(placeName: string): Promise<Coordinates> {
  try {
    log.info('Getting coordinates for place', { placeName });
    
    const url = 'https://nominatim.openstreetmap.org/search';
    const response = await axios.get(url, {
      params: {
        q: placeName,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'AstrotApp/1.0'
      },
      timeout: 10000
    });

    if (!response.data || response.data.length === 0) {
      throw new Error(`Location not found: ${placeName}`);
    }

    const location = response.data[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    log.info('Coordinates found', { lat, lon, placeName });

    return { lat, lon, timezone: 'UTC' };
  } catch (error: any) {
    log.error('Error getting coordinates', error);
    throw new Error(`Failed to get coordinates for ${placeName}: ${error.message}`);
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
  let normalizedDegree = degree % 360;
  if (normalizedDegree < 0) {
    normalizedDegree += 360;
  }
  
  // Определяем индекс знака (0-11)
  // 0°-30° = Aries (0), 30°-60° = Taurus (1), и т.д.
  const signIndex = Math.floor(normalizedDegree / 30);
  
  // Обрабатываем граничный случай: ровно 360° или очень близко к 360°
  const finalIndex = signIndex >= 12 ? 0 : signIndex;
  
  // Используем централизованный массив знаков
  const { ZODIAC_SIGNS: signs } = require('./zodiac-utils');
  const signName = signs[finalIndex];
  
  log.info(`[getZodiacSign] Degree: ${degree.toFixed(4)}, Normalized: ${normalizedDegree.toFixed(4)}, Sign Index: ${finalIndex}, Sign: ${signName}`);
  
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
  const normalizedDegree = ((degree % 360) + 360) % 360;
  return normalizedDegree % 30;
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
  swe: any,
  julday: number,
  planetId: number,
  planetName: string
): Promise<PlanetPosition | null> {
  try {
    // Используем флаг SEFLG_SWIEPH (Swiss Ephemeris) + SEFLG_SPEED
    const result = swe.swe_calc_ut(julday, planetId, 258); // 258 = SEFLG_SWIEPH | SEFLG_SPEED
    
    if (!result || result.length < 3) {
      log.error(`Failed to calculate ${planetName}`, { result });
      return null;
    }

    const longitude = result[0]; // Longitude в градусах (эклиптическая долгота)
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
  swe: any,
  julday: number,
  lat: number,
  lon: number
): Promise<PlanetPosition | null> {
  try {
    // Используем систему домов Placidus ('P')
    const result = swe.swe_houses(julday, lat, lon, 'P');

    if (!result || !result.ascmc || result.ascmc.length === 0) {
      log.error('Failed to calculate ascendant', { result });
      return null;
    }

    const ascendant = result.ascmc[0]; // Первое значение - Ascendant
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
    const element = getElementForSign(position.sign as any);
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
export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string
): Promise<any> {
  try {
    log.info('Starting natal chart calculation with Swiss Ephemeris WASM', {
      name,
      birthDate,
      birthTime,
      birthPlace
    });

    // Инициализируем Swiss Ephemeris
    const swe = await initSwissEph();

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

    // Конвертируем локальное время в UTC с учетом временной зоны
    // Вычисляем примерное смещение часового пояса на основе долготы
    // (приблизительно: 15 градусов долготы = 1 час)
    const timezoneOffsetHours = coords.lon / 15.0;
    
    // Конвертируем локальное время в UTC (десятичные часы)
    const localTimeInHours = birthHour + birthMinute / 60.0;
    let utcTimeInHours = localTimeInHours - timezoneOffsetHours;
    
    // Корректируем день если время вышло за пределы суток
    let adjustedDay = birthDay;
    let adjustedMonth = birthMonth;
    let adjustedYear = birthYear;
    
    // Корректируем дату если UTC время вышло за пределы суток
    if (utcTimeInHours < 0) {
      utcTimeInHours += 24;
      adjustedDay -= 1;
      if (adjustedDay < 1) {
        adjustedMonth -= 1;
        if (adjustedMonth < 1) {
          adjustedMonth = 12;
          adjustedYear -= 1;
        }
        // Упрощенная логика для последнего дня месяца
        const daysInMonth = new Date(adjustedYear, adjustedMonth, 0).getDate();
        adjustedDay = daysInMonth;
      }
    } else if (utcTimeInHours >= 24) {
      utcTimeInHours -= 24;
      adjustedDay += 1;
      const daysInMonth = new Date(adjustedYear, adjustedMonth, 0).getDate();
      if (adjustedDay > daysInMonth) {
        adjustedDay = 1;
        adjustedMonth += 1;
        if (adjustedMonth > 12) {
          adjustedMonth = 1;
          adjustedYear += 1;
        }
      }
    }
    
    // Конвертируем в Julian Day используя Swiss Ephemeris
    // Параметр 1 означает использование григорианского календаря
    const julianDay = swe.swe_julday(adjustedYear, adjustedMonth, adjustedDay, utcTimeInHours, 1);
    
    log.info('Calculated Julian Day with timezone correction', { 
      inputDate: `${birthYear}-${birthMonth}-${birthDay}`,
      inputTime: `${birthHour}:${birthMinute}`,
      coordinates: { lat: coords.lat, lon: coords.lon },
      timezoneOffsetHours: timezoneOffsetHours.toFixed(2),
      localTime: localTimeInHours.toFixed(4),
      utcTime: utcTimeInHours.toFixed(4),
      adjustedDate: `${adjustedYear}-${adjustedMonth}-${adjustedDay}`,
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

    // Проверяем что основные планеты рассчитаны
    if (!sun || !moon || !ascendant) {
      throw new Error('Failed to calculate essential planets');
    }

    // Определяем элемент и управляющую планету
    const positions = [sun, moon, ascendant].filter(p => p !== null) as PlanetPosition[];
    if (mercury) positions.push(mercury);
    if (venus) positions.push(venus);
    if (mars) positions.push(mars);
    
    const element = calculateElement(positions);
    const rulingPlanet = calculateRulingPlanet(sun.sign);

    const chartData = {
      sun,
      moon,
      rising: ascendant,
      mercury,
      venus,
      mars,
      element,
      rulingPlanet,
      summary: `Natal chart for ${name}, born on ${birthDate} at ${birthTime || '12:00'} in ${birthPlace}. Your chart reveals a ${element} dominant personality with ${sun.sign} Sun, ${moon.sign} Moon, and ${ascendant.sign} Rising.`
    };

    // Валидация: проверяем, что знак Солнца соответствует ожидаемому для даты рождения
    // Это поможет выявить проблемы с расчетом
    const expectedSignByDate = getExpectedSunSignByDate(birthYear, birthMonth, birthDay);
    const signMatch = sun.sign === expectedSignByDate;
    
    // Вычисляем смещение часового пояса для логирования
    const tzOffset = coords.lon / 15.0;
    
    // Вычисляем эклиптическую долготу Солнца для детального логирования
    const sunResult = swe.swe_calc_ut(julianDay, PLANETS.SUN, 258);
    const sunLongitude = sunResult ? sunResult[0] : null;
    
    if (!signMatch) {
      log.warn(`[VALIDATION] ⚠️ Sun sign mismatch detected!`, {
        calculated: sun.sign,
        expectedByDate: expectedSignByDate,
        date: `${birthYear}-${birthMonth}-${birthDay}`,
        time: `${birthHour}:${birthMinute}`,
        birthPlace,
        coordinates: { lat: coords.lat, lon: coords.lon },
        sunLongitude: sunLongitude ? sunLongitude.toFixed(6) : 'N/A',
        sunDegreeInSign: sun.degree.toFixed(2),
        sunPosition: `${sun.degree.toFixed(2)}° ${sun.sign}`,
        timezoneOffset: tzOffset.toFixed(2),
        julianDay: julianDay.toFixed(6),
        note: 'This might indicate a timezone or calculation issue. The sign is calculated correctly based on ecliptic longitude, but may differ from simplified date ranges.'
      });
    } else {
      log.info(`[VALIDATION] ✓ Sun sign matches expected value for date`, {
        sunSign: sun.sign,
        sunLongitude: sunLongitude ? sunLongitude.toFixed(6) : 'N/A',
        date: `${birthYear}-${birthMonth}-${birthDay}`
      });
    }

    log.info('🌟 Natal chart calculated successfully with Swiss Ephemeris WASM', {
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
