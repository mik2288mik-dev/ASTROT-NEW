/**
 * Transits Calculator
 * 
 * Вспомогательные функции для расчёта текущих транзитов планет
 * и их интерпретации для прогнозов
 */

import { calculateNatalChart } from './swisseph-calculator';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[TransitsCalculator] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[TransitsCalculator] ERROR: ${message}`, error || '');
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
}

/**
 * Получить текущие транзиты планет
 * 
 * Использует Swiss Ephemeris для расчёта положения планет на текущую дату
 */
export async function getCurrentTransits(date?: Date): Promise<CurrentTransits> {
  const targetDate = date || new Date();
  const dateString = targetDate.toISOString().split('T')[0];
  
  log.info('Calculating current transits', { date: dateString });

  try {
    // Используем Swiss Ephemeris для расчёта текущих положений планет
    // Передаём фиктивное имя и место, так как нам нужны только положения планет
    const transitChart = await calculateNatalChart(
      'Transit',
      dateString,
      '12:00',
      'Greenwich, UK' // Используем Гринвич как универсальную точку
    );

    // Определяем фазу Луны (упрощённо, на основе знака)
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
      summary: `Текущие астрологические влияния на ${new Date(dateString).toLocaleDateString('ru-RU')}`
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
      date: dateString
    });

    // Возвращаем упрощённые транзиты на основе даты
    return getSimplifiedTransits(targetDate);
  }
}

/**
 * Получить упрощённые транзиты (fallback)
 * 
 * Используется когда Swiss Ephemeris недоступен
 */
function getSimplifiedTransits(date: Date): CurrentTransits {
  const dateString = date.toISOString().split('T')[0];
  
  // Упрощённое определение знака Солнца по дате
  const sunSign = getSunSignByDate(date);
  
  return {
    date: dateString,
    sun: {
      planet: 'Sun',
      sign: sunSign,
      degree: 15,
      description: `Солнце сейчас в ${sunSign}`
    },
    moon: {
      planet: 'Moon',
      sign: 'Cancer', // Упрощённо
      degree: 10,
      description: 'Луна влияет на эмоциональный фон'
    },
    moonPhase: 'Растущая',
    summary: `Текущие астрологические влияния на ${date.toLocaleDateString('ru-RU')}`
  };
}

/**
 * Определить знак Солнца по дате (упрощённо)
 */
function getSunSignByDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();

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
  return 'Pisces';
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
