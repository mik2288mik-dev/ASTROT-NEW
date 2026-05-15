/**
 * Transits Calculator
 * 
 * Вспомогательные функции для расчёта текущих транзитов планет
 * и их интерпретации для прогнозов
 */

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[TransitsCalculator] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[TransitsCalculator] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[TransitsCalculator] WARNING: ${message}`, data || '');
  },
};

/**
 * Интерфейс для транзита планеты
 */
export interface PlanetTransit {
  planet: string;
  sign: string;
  degree: number;
  description?: string;
}

/**
 * Интерфейс для текущих транзитов
 */
export interface CurrentTransits {
  date: string;
  sun: PlanetTransit;
  moon: PlanetTransit;
  mercury?: PlanetTransit;
  venus?: PlanetTransit;
  mars?: PlanetTransit;
  jupiter?: PlanetTransit;
  saturn?: PlanetTransit;
  moonPhase?: string;
  summary?: string;
  source?: 'swisseph' | 'algorithmic';
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

function normalizeDegree(value: number): number {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function daysSinceJ2000(date: Date): number {
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
  return (date.getTime() - j2000) / 86_400_000;
}

function transitFromLongitude(
  planet: string,
  longitude: number,
  description: (sign: string) => string
): PlanetTransit {
  const normalized = normalizeDegree(longitude);
  const signIndex = Math.floor(normalized / 30) % 12;
  const sign = ZODIAC_SIGNS[signIndex] || 'Aries';
  return {
    planet,
    sign,
    degree: Number((normalized % 30).toFixed(2)),
    description: description(sign),
  };
}

function calculateApproximateLongitudes(date: Date) {
  const n = daysSinceJ2000(date);
  const meanSun = normalizeDegree(280.460 + 0.9856474 * n);
  const sunAnomaly = normalizeDegree(357.528 + 0.9856003 * n);
  const sun = normalizeDegree(
    meanSun + 1.915 * Math.sin(toRadians(sunAnomaly)) + 0.020 * Math.sin(toRadians(2 * sunAnomaly))
  );

  const moonMean = normalizeDegree(218.316 + 13.176396 * n);
  const moonAnomaly = normalizeDegree(134.963 + 13.064993 * n);
  const moon = normalizeDegree(moonMean + 6.289 * Math.sin(toRadians(moonAnomaly)));

  // Lightweight geocentric approximations: enough for daily rhythm metrics when
  // native Swiss bindings are unavailable, without returning static fake data.
  const mercury = normalizeDegree(sun + 23 * Math.sin((2 * Math.PI * n) / 116));
  const venus = normalizeDegree(sun + 37 * Math.sin((2 * Math.PI * n) / 584));
  const mars = normalizeDegree(355.433 + 0.524039 * n + 8 * Math.sin((2 * Math.PI * n) / 780));
  const jupiter = normalizeDegree(34.351 + 0.083086 * n);
  const saturn = normalizeDegree(50.077 + 0.033459 * n);

  return { sun, moon, mercury, venus, mars, jupiter, saturn };
}

/**
 * Получить текущие транзиты планет
 * 
 * Использует Swiss Ephemeris для расчёта положения планет на текущую дату
 */
export async function getCurrentTransits(date?: Date): Promise<CurrentTransits> {
  const targetDate = date || new Date();
  const dateString = targetDate.toISOString().split('T')[0];
  const timeString = targetDate.toISOString().slice(11, 16);
  
  log.info('Calculating current transits', { date: dateString, time: timeString });

  try {
    const { calculatePlanetaryTransitsAt } = await import('./swisseph-calculator');
    const transitChart = calculatePlanetaryTransitsAt(targetDate);
    const moonPhase = getMoonPhase(transitChart.moon.degree);

    const transits: CurrentTransits = {
      date: dateString,
      sun: {
        planet: 'Sun',
        sign: transitChart.sun.sign,
        degree: transitChart.sun.degree,
        description: `Солнце сейчас в ${transitChart.sun.sign}, освещая темы этого знака`
      },
      moon: {
        planet: 'Moon',
        sign: transitChart.moon.sign,
        degree: transitChart.moon.degree,
        description: `Луна в ${transitChart.moon.sign}, влияя на эмоциональный фон`
      },
      mercury: transitChart.mercury ? {
        planet: 'Mercury',
        sign: transitChart.mercury.sign,
        degree: transitChart.mercury.degree,
        description: `Меркурий в ${transitChart.mercury.sign}, влияя на коммуникацию`
      } : undefined,
      venus: transitChart.venus ? {
        planet: 'Venus',
        sign: transitChart.venus.sign,
        degree: transitChart.venus.degree,
        description: `Венера в ${transitChart.venus.sign}, влияя на отношения`
      } : undefined,
      mars: transitChart.mars ? {
        planet: 'Mars',
        sign: transitChart.mars.sign,
        degree: transitChart.mars.degree,
        description: `Марс в ${transitChart.mars.sign}, влияя на энергию и действия`
      } : undefined,
      moonPhase,
      summary: `Текущие астрологические влияния на ${new Date(dateString).toLocaleDateString('ru-RU')}`,
      source: 'swisseph',
    };

    log.info('Transits calculated successfully', {
      sunSign: transits.sun.sign,
      moonSign: transits.moon.sign,
      moonPhase
    });

    return transits;
  } catch (error: any) {
    log.error('Failed to calculate transits', {
      error: error.message,
      date: dateString,
      time: timeString
    });

    return getAlgorithmicTransits(targetDate);
  }
}

/**
 * Получить упрощённые транзиты (fallback)
 * 
 * Используется когда Swiss Ephemeris недоступен
 */
function getAlgorithmicTransits(date: Date): CurrentTransits {
  const dateString = date.toISOString().split('T')[0];
  const longitudes = calculateApproximateLongitudes(date);
  
  return {
    date: dateString,
    sun: transitFromLongitude('Sun', longitudes.sun, (sign) => `Солнце сейчас в ${sign}`),
    moon: transitFromLongitude('Moon', longitudes.moon, (sign) => `Луна сейчас в ${sign}`),
    mercury: transitFromLongitude('Mercury', longitudes.mercury, (sign) => `Меркурий сейчас в ${sign}`),
    venus: transitFromLongitude('Venus', longitudes.venus, (sign) => `Венера сейчас в ${sign}`),
    mars: transitFromLongitude('Mars', longitudes.mars, (sign) => `Марс сейчас в ${sign}`),
    jupiter: transitFromLongitude('Jupiter', longitudes.jupiter, (sign) => `Юпитер сейчас в ${sign}`),
    saturn: transitFromLongitude('Saturn', longitudes.saturn, (sign) => `Сатурн сейчас в ${sign}`),
    moonPhase: getMoonPhase(longitudes.moon),
    summary: `Текущие астрологические влияния на ${date.toLocaleDateString('ru-RU')}`,
    source: 'algorithmic',
  };
}

/**
 * Определить фазу Луны (упрощённо)
 */
function getMoonPhase(moonDegree: number): string {
  // Это упрощённая версия, в реальности нужно учитывать позиции Солнца и Луны
  const phase = Math.floor(moonDegree / 45) % 8;
  
  const phases = [
    'Новолуние',
    'Растущий серп',
    'Первая четверть',
    'Растущая Луна',
    'Полнолуние',
    'Убывающая Луна',
    'Последняя четверть',
    'Убывающий серп'
  ];
  
  return phases[phase] || 'Растущая';
}

/**
 * Получить транзиты на период (неделя/месяц)
 */
export async function getTransitsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<{
  startTransits: CurrentTransits;
  endTransits: CurrentTransits;
  summary: string;
}> {
  const startTransits = await getCurrentTransits(startDate);
  const endTransits = await getCurrentTransits(endDate);
  
  const summary = `Период с ${startDate.toLocaleDateString('ru-RU')} по ${endDate.toLocaleDateString('ru-RU')}. ` +
    `Солнце движется через ${startTransits.sun.sign}` +
    (startTransits.sun.sign !== endTransits.sun.sign ? ` в ${endTransits.sun.sign}` : '') +
    `.`;
  
  return {
    startTransits,
    endTransits,
    summary
  };
}
