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
 */
function getZodiacSign(degree: number): string {
  const normalizedDegree = ((degree % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedDegree / 30);
  return ZODIAC_SIGNS[signIndex];
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

    const longitude = result[0]; // Longitude в градусах
    const sign = getZodiacSign(longitude);
    const degreeInSign = getDegreeInSign(longitude);

    log.info(`Calculated ${planetName}`, { 
      longitude: longitude.toFixed(4), 
      sign, 
      degreeInSign: degreeInSign.toFixed(2) 
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
      const [h, m] = birthTime.split(':').map(Number);
      hour = h;
      minute = m;
    }

    // Конвертируем в Julian Day используя Swiss Ephemeris
    const utcHour = hour + minute / 60.0;
    const julday = swe.swe_julday(year, month, day, utcHour, 1); // 1 = Gregorian calendar
    
    log.info('Calculated Julian Day', { year, month, day, hour, minute, julday });

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

    log.info('Natal chart calculated successfully with Swiss Ephemeris WASM', {
      hasSun: !!sun,
      hasMoon: !!moon,
      hasRising: !!ascendant,
      element,
      sunSign: sun.sign,
      moonSign: moon.sign,
      risingSign: ascendant.sign
    });

    return chartData;
  } catch (error: any) {
    log.error('Error calculating natal chart', error);
    throw error;
  }
}
