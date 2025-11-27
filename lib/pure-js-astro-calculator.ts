import axios from 'axios';

/**
 * Pure JavaScript Astrological Calculator
 * No native dependencies - works on any platform including serverless
 */

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[PureJSAstroCalculator] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[PureJSAstroCalculator] ERROR: ${message}`, error || '');
  },
};

// Знаки зодиака
const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

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
      timeout: 5000
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
 * Конвертация даты в Julian Day Number (чистый JavaScript)
 */
function dateToJulianDay(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0
): number {
  // Алгоритм конвертации в Julian Day
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  
  const jd = Math.floor(365.25 * (year + 4716)) + 
             Math.floor(30.6001 * (month + 1)) + 
             day + b - 1524.5 + 
             (hour + minute / 60) / 24;
  
  log.info('Calculated Julian Day', { year, month, day, hour, minute, jd });
  return jd;
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
 * Вычисление положения Солнца (упрощенный алгоритм)
 */
function calculateSunPosition(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * Math.PI / 180) +
            (0.019993 - 0.000101 * T) * Math.sin(2 * M * Math.PI / 180) +
            0.000289 * Math.sin(3 * M * Math.PI / 180);
  
  const sunLongitude = (L0 + C) % 360;
  return sunLongitude;
}

/**
 * Вычисление положения Луны (упрощенный алгоритм)
 */
function calculateMoonPosition(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
  
  const moonLongitude = (L0 + 
    6.288774 * Math.sin(D * Math.PI / 180) +
    1.274027 * Math.sin((2 * D - M) * Math.PI / 180) +
    0.658314 * Math.sin(2 * D * Math.PI / 180) +
    0.213618 * Math.sin(2 * M * Math.PI / 180)) % 360;
  
  return moonLongitude;
}

/**
 * Вычисление положения Меркурия (упрощенный алгоритм)
 */
function calculateMercuryPosition(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L = 252.250906 + 149472.6746358 * T;
  const mercuryLongitude = L % 360;
  return mercuryLongitude;
}

/**
 * Вычисление положения Венеры (упрощенный алгоритм)
 */
function calculateVenusPosition(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L = 181.979801 + 58517.8156760 * T;
  const venusLongitude = L % 360;
  return venusLongitude;
}

/**
 * Вычисление положения Марса (упрощенный алгоритм)
 */
function calculateMarsPosition(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L = 355.433275 + 19140.2993313 * T;
  const marsLongitude = L % 360;
  return marsLongitude;
}

/**
 * Вычисление Асцендента (упрощенный алгоритм)
 */
function calculateAscendant(jd: number, lat: number, lon: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  
  // Вычисление GMST (Greenwich Mean Sidereal Time)
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 
               0.000387933 * T * T - T * T * T / 38710000.0;
  
  // Вычисление LMST (Local Mean Sidereal Time)
  const lmst = (gmst + lon) % 360;
  
  // Упрощенное вычисление асцендента
  // Для более точного расчета нужно учитывать наклон эклиптики
  const obliquity = 23.439291 - 0.0130042 * T;
  const ascendant = (lmst + lat * 0.5) % 360;
  
  return ascendant;
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
 * Создание объекта позиции планеты
 */
function createPlanetPosition(
  planetName: string,
  longitude: number
): PlanetPosition {
  const sign = getZodiacSign(longitude);
  const degree = getDegreeInSign(longitude);
  
  return {
    planet: planetName,
    sign,
    degree,
    description: getPlanetDescription(planetName)
  };
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
 * Основная функция расчета натальной карты (Pure JavaScript)
 */
export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string
): Promise<any> {
  try {
    log.info('Starting natal chart calculation (Pure JS)', {
      name,
      birthDate,
      birthTime,
      birthPlace
    });

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

    // Конвертируем в Julian Day
    const jd = dateToJulianDay(year, month, day, hour, minute);

    // Рассчитываем положения планет
    const sunLongitude = calculateSunPosition(jd);
    const moonLongitude = calculateMoonPosition(jd);
    const mercuryLongitude = calculateMercuryPosition(jd);
    const venusLongitude = calculateVenusPosition(jd);
    const marsLongitude = calculateMarsPosition(jd);
    const ascendantLongitude = calculateAscendant(jd, coords.lat, coords.lon);

    const sun = createPlanetPosition('Sun', sunLongitude);
    const moon = createPlanetPosition('Moon', moonLongitude);
    const mercury = createPlanetPosition('Mercury', mercuryLongitude);
    const venus = createPlanetPosition('Venus', venusLongitude);
    const mars = createPlanetPosition('Mars', marsLongitude);
    const ascendant = createPlanetPosition('Ascendant', ascendantLongitude);

    log.info('Calculated planet positions', {
      sun: `${sun.sign} ${sun.degree.toFixed(2)}°`,
      moon: `${moon.sign} ${moon.degree.toFixed(2)}°`,
      rising: `${ascendant.sign} ${ascendant.degree.toFixed(2)}°`
    });

    // Определяем элемент и управляющую планету
    const positions = [sun, moon, ascendant, mercury, venus, mars];
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

    log.info('Natal chart calculated successfully', {
      element,
      rulingPlanet
    });

    return chartData;
  } catch (error: any) {
    log.error('Error calculating natal chart', error);
    throw error;
  }
}
