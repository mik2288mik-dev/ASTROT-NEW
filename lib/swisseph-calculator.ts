import * as swisseph from 'swisseph';
import path from 'path';
import axios from 'axios';

// Установка пути к файлам эфемерид
const EPHE_PATH = process.env.EPHE_PATH || path.join(process.cwd(), 'ephe');

// Инициализация Swiss Ephemeris
swisseph.swe_set_ephe_path(EPHE_PATH);

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[SwissephCalculator] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[SwissephCalculator] ERROR: ${message}`, error || '');
  },
};

// Знаки зодиака
const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Планеты Swiss Ephemeris
const PLANETS = {
  SUN: swisseph.SE_SUN,
  MOON: swisseph.SE_MOON,
  MERCURY: swisseph.SE_MERCURY,
  VENUS: swisseph.SE_VENUS,
  MARS: swisseph.SE_MARS,
  JUPITER: swisseph.SE_JUPITER,
  SATURN: swisseph.SE_SATURN,
  URANUS: swisseph.SE_URANUS,
  NEPTUNE: swisseph.SE_NEPTUNE,
  PLUTO: swisseph.SE_PLUTO,
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

/**
 * Получение координат по названию места через геокодинг
 * Использует Nominatim API (OpenStreetMap)
 */
export async function getCoordinates(placeName: string): Promise<Coordinates> {
  try {
    log.info('Getting coordinates for place', { placeName });
    
    // Используем Nominatim API от OpenStreetMap (бесплатный)
    const url = 'https://nominatim.openstreetmap.org/search';
    const response = await axios.get(url, {
      params: {
        q: placeName,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'AstrotApp/1.0'
      }
    });

    if (!response.data || response.data.length === 0) {
      throw new Error(`Location not found: ${placeName}`);
    }

    const location = response.data[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    log.info('Coordinates found', { lat, lon, placeName });

    return {
      lat,
      lon,
      timezone: 'UTC' // Упрощенно, для точного расчета можно использовать timezone API
    };
  } catch (error: any) {
    log.error('Error getting coordinates', error);
    throw new Error(`Failed to get coordinates for ${placeName}: ${error.message}`);
  }
}

/**
 * Конвертация даты и времени в Julian Day Number
 */
function dateToJulianDay(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0
): number {
  const utc = hour + minute / 60.0;
  const julday = swisseph.swe_julday(year, month, day, utc, swisseph.SE_GREG_CAL);
  log.info('Calculated Julian Day', { year, month, day, hour, minute, julday });
  return julday;
}

/**
 * Получение знака зодиака из градуса эклиптики
 */
function getZodiacSign(degree: number): string {
  const signIndex = Math.floor(degree / 30);
  return ZODIAC_SIGNS[signIndex];
}

/**
 * Получение градуса в знаке
 */
function getDegreeInSign(degree: number): number {
  return degree % 30;
}

/**
 * Расчет положения планеты
 */
function calculatePlanetPosition(
  julday: number,
  planetId: number,
  planetName: string
): PlanetPosition | null {
  try {
    const result = swisseph.swe_calc_ut(julday, planetId, swisseph.SEFLG_SWIEPH);
    
    if (result.flag < 0) {
      log.error(`Failed to calculate ${planetName}`, result.error);
      return null;
    }

    const longitude = result.longitude;
    const sign = getZodiacSign(longitude);
    const degreeInSign = getDegreeInSign(longitude);

    log.info(`Calculated ${planetName}`, { longitude, sign, degreeInSign });

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
 * Расчет ASC (Асцендента / Rising Sign)
 */
function calculateAscendant(
  julday: number,
  lat: number,
  lon: number
): PlanetPosition | null {
  try {
    const result = swisseph.swe_houses(
      julday,
      lat,
      lon,
      'P' // Placidus house system
    );

    if (!result || !result.ascendant) {
      log.error('Failed to calculate ascendant');
      return null;
    }

    const ascendant = result.ascendant;
    const sign = getZodiacSign(ascendant);
    const degreeInSign = getDegreeInSign(ascendant);

    log.info('Calculated Ascendant', { ascendant, sign, degreeInSign });

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

  // Возвращаем доминирующий элемент
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
 */
export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string
): Promise<any> {
  try {
    log.info('Starting natal chart calculation', {
      name,
      birthDate,
      birthTime,
      birthPlace
    });

    // Получаем координаты места рождения
    const coords = await getCoordinates(birthPlace);

    // Парсим дату рождения
    const [year, month, day] = birthDate.split('-').map(Number);
    
    // Парсим время рождения (если не указано, используем полдень)
    let hour = 12;
    let minute = 0;
    if (birthTime) {
      const [h, m] = birthTime.split(':').map(Number);
      hour = h;
      minute = m;
    }

    // Конвертируем в Julian Day
    const julday = dateToJulianDay(year, month, day, hour, minute);

    // Рассчитываем положения планет
    const sun = calculatePlanetPosition(julday, PLANETS.SUN, 'Sun');
    const moon = calculatePlanetPosition(julday, PLANETS.MOON, 'Moon');
    const mercury = calculatePlanetPosition(julday, PLANETS.MERCURY, 'Mercury');
    const venus = calculatePlanetPosition(julday, PLANETS.VENUS, 'Venus');
    const mars = calculatePlanetPosition(julday, PLANETS.MARS, 'Mars');
    const ascendant = calculateAscendant(julday, coords.lat, coords.lon);

    // Проверяем что основные планеты рассчитаны
    if (!sun || !moon || !ascendant) {
      throw new Error('Failed to calculate essential planets');
    }

    // Определяем элемент и управляющую планету
    const positions = [sun, moon, ascendant].filter(p => p !== null) as PlanetPosition[];
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
      summary: `Natal chart for ${name}, born on ${birthDate} at ${birthTime || '12:00'} in ${birthPlace}. Your chart reveals a ${element} dominant personality.`
    };

    log.info('Natal chart calculated successfully', {
      hasSun: !!sun,
      hasMoon: !!moon,
      hasRising: !!ascendant,
      element
    });

    return chartData;
  } catch (error: any) {
    log.error('Error calculating natal chart', error);
    throw error;
  } finally {
    // Очистка ресурсов Swiss Ephemeris
    swisseph.swe_close();
  }
}
