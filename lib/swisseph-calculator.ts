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

// Знаки зодиака
const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

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
 * Получение знака зодиака из градуса эклиптики
 * Исправленная версия с правильной обработкой граничных случаев
 */
function getZodiacSign(degree: number): string {
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
  
  log.info(`[getZodiacSign] Degree: ${degree.toFixed(4)}, Normalized: ${normalizedDegree.toFixed(4)}, Sign Index: ${finalIndex}, Sign: ${ZODIAC_SIGNS[finalIndex]}`);
  
  return ZODIAC_SIGNS[finalIndex];
}

/**
 * Получение градуса в знаке
 */
function getDegreeInSign(degree: number): number {
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
 * Расчет положения планеты используя Swiss Ephemeris WASM
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

    log.info(`Calculated ${planetName}`, { 
      longitude: longitude.toFixed(6), 
      sign, 
      degreeInSign: degreeInSign.toFixed(4),
      fullDegree: `${degreeInSign.toFixed(2)}° ${sign}`
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
 * Расчет ASC (Асцендента / Rising Sign) используя Swiss Ephemeris WASM
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
 * Определение доминирующего элемента
 */
function calculateElement(positions: PlanetPosition[]): string {
  const elements: { [key: string]: string[] } = {
    Fire: ['Aries', 'Leo', 'Sagittarius'],
    Earth: ['Taurus', 'Virgo', 'Capricorn'],
    Air: ['Gemini', 'Libra', 'Aquarius'],
    Water: ['Cancer', 'Scorpio', 'Pisces']
  };

  const counts: { [key: string]: number } = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0
  };

  positions.forEach(pos => {
    for (const [element, signs] of Object.entries(elements)) {
      if (signs.includes(pos.sign)) {
        counts[element]++;
        break;
      }
    }
  });

  let maxElement = 'Fire';
  let maxCount = 0;
  for (const [element, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxElement = element;
    }
  }

  return maxElement;
}

/**
 * Определить ожидаемый знак Солнца по дате рождения (упрощённо, для валидации)
 * Это приблизительная проверка, реальный расчет зависит от точного времени и года
 */
function getExpectedSunSignByDate(year: number, month: number, day: number): string {
  // Упрощённая логика для проверки (не учитывает точное время и год)
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces'; // 19 февраля - 20 марта
}

/**
 * Определение управляющей планеты
 */
function calculateRulingPlanet(sunSign: string): string {
  const rulers: { [key: string]: string } = {
    'Aries': 'Mars',
    'Taurus': 'Venus',
    'Gemini': 'Mercury',
    'Cancer': 'Moon',
    'Leo': 'Sun',
    'Virgo': 'Mercury',
    'Libra': 'Venus',
    'Scorpio': 'Pluto',
    'Sagittarius': 'Jupiter',
    'Capricorn': 'Saturn',
    'Aquarius': 'Uranus',
    'Pisces': 'Neptune'
  };
  return rulers[sunSign] || 'Sun';
}

/**
 * Основная функция расчета натальной карты
 * Использует настоящую Swiss Ephemeris через WebAssembly!
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

    // Парсим дату рождения
    const [year, month, day] = birthDate.split('-').map(Number);
    
    // Парсим время рождения
    let hour = 12;
    let minute = 0;
    if (birthTime) {
      const timeParts = birthTime.split(':');
      hour = parseInt(timeParts[0], 10) || 12;
      minute = parseInt(timeParts[1], 10) || 0;
      
      // Проверяем валидность времени
      if (hour < 0 || hour > 23) {
        log.warn(`Invalid hour ${hour}, using 12:00`);
        hour = 12;
      }
      if (minute < 0 || minute > 59) {
        log.warn(`Invalid minute ${minute}, using 0`);
        minute = 0;
      }
    }

    // Конвертируем в Julian Day используя Swiss Ephemeris
    // Используем UTC время (Swiss Ephemeris ожидает UTC)
    const utcHour = hour + minute / 60.0;
    const julday = swe.swe_julday(year, month, day, utcHour, 1); // 1 = Gregorian calendar
    
    log.info('Calculated Julian Day', { 
      year, 
      month, 
      day, 
      hour, 
      minute, 
      utcHour: utcHour.toFixed(4),
      julday: julday.toFixed(6)
    });

    // Рассчитываем положения планет
    const [sun, moon, mercury, venus, mars, ascendant] = await Promise.all([
      calculatePlanetPosition(swe, julday, PLANETS.SUN, 'Sun'),
      calculatePlanetPosition(swe, julday, PLANETS.MOON, 'Moon'),
      calculatePlanetPosition(swe, julday, PLANETS.MERCURY, 'Mercury'),
      calculatePlanetPosition(swe, julday, PLANETS.VENUS, 'Venus'),
      calculatePlanetPosition(swe, julday, PLANETS.MARS, 'Mars'),
      calculateAscendant(swe, julday, coords.lat, coords.lon)
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
    const expectedSignByDate = getExpectedSunSignByDate(year, month, day);
    if (sun.sign !== expectedSignByDate) {
      log.warn(`[VALIDATION] Sun sign mismatch!`, {
        calculated: sun.sign,
        expectedByDate: expectedSignByDate,
        date: `${year}-${month}-${day}`,
        sunLongitude: sun.degree,
        note: 'This might indicate a timezone or calculation issue'
      });
    }

    log.info('Natal chart calculated successfully with Swiss Ephemeris WASM', {
      hasSun: !!sun,
      hasMoon: !!moon,
      hasRising: !!ascendant,
      element,
      sunSign: sun.sign,
      moonSign: moon.sign,
      risingSign: ascendant.sign,
      expectedSunSignByDate: expectedSignByDate,
      sunSignMatch: sun.sign === expectedSignByDate
    });

    return chartData;
  } catch (error: any) {
    log.error('Error calculating natal chart', error);
    throw error;
  }
}
