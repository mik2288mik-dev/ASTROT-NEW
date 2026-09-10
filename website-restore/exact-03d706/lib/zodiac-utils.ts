/**
 * Утилиты для работы со знаками зодиака
 * Централизованное хранение данных о знаках для избежания дублирования
 */

/**
 * Все знаки зодиака в порядке следования
 * 
 * Используется для определения знака по градусу эклиптики
 */
export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

export type ZodiacSign = typeof ZODIAC_SIGNS[number];

/**
 * Управляющие планеты для каждого знака зодиака
 */
export const RULING_PLANETS: Record<ZodiacSign, string> = {
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
} as const;

/**
 * Элементы для каждого знака зодиака
 */
export const SIGN_ELEMENTS: Record<ZodiacSign, 'Fire' | 'Earth' | 'Air' | 'Water'> = {
  'Aries': 'Fire',
  'Taurus': 'Earth',
  'Gemini': 'Air',
  'Cancer': 'Water',
  'Leo': 'Fire',
  'Virgo': 'Earth',
  'Libra': 'Air',
  'Scorpio': 'Water',
  'Sagittarius': 'Fire',
  'Capricorn': 'Earth',
  'Aquarius': 'Air',
  'Pisces': 'Water'
} as const;

/**
 * Приблизительные даты входа Солнца в знаки зодиака
 * 
 * ВАЖНО: Это упрощенная функция для валидации!
 * Точное время входа Солнца в знак меняется от года к году (на 1-2 дня).
 * Не учитывает точное время суток и часовой пояс.
 * Используется только для выявления явных ошибок в расчетах.
 * 
 * Реальный знак зодиака ВСЕГДА должен определяться по точной эклиптической долготе,
 * полученной из Swiss Ephemeris.
 */
export const APPROXIMATE_SUN_SIGN_DATES: Record<ZodiacSign, { startMonth: number; startDay: number; endMonth: number; endDay: number }> = {
  'Aries': { startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  'Taurus': { startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  'Gemini': { startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  'Cancer': { startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  'Leo': { startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  'Virgo': { startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  'Libra': { startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  'Scorpio': { startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  'Sagittarius': { startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  'Capricorn': { startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  'Aquarius': { startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  'Pisces': { startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 }
} as const;

/**
 * Определяет приблизительный знак Солнца по дате рождения
 * 
 * ВАЖНО: Это упрощенная функция для валидации!
 * Точное время входа Солнца в знак меняется от года к году (на 1-2 дня).
 * Не учитывает точное время суток и часовой пояс.
 * Используется только для выявления явных ошибок в расчетах.
 * 
 * Реальный знак зодиака ВСЕГДА должен определяться по точной эклиптической долготе,
 * полученной из Swiss Ephemeris.
 * 
 * @param year - Год рождения
 * @param month - Месяц рождения (1-12)
 * @param day - День рождения (1-31)
 * @returns Приблизительный знак зодиака
 * 
 * @example
 * getApproximateSunSignByDate(1990, 5, 15) // 'Taurus'
 * getApproximateSunSignByDate(1990, 7, 23) // 'Leo'
 */
export function getApproximateSunSignByDate(year: number, month: number, day: number): ZodiacSign {
  // Проверяем каждый знак по порядку
  for (const sign of ZODIAC_SIGNS) {
    const dates = APPROXIMATE_SUN_SIGN_DATES[sign];
    const { startMonth, startDay, endMonth, endDay } = dates;
    
    // Обработка знаков, которые пересекают границу года (Capricorn, Aquarius, Pisces)
    if (startMonth > endMonth) {
      // Знак начинается в одном году и заканчивается в следующем
      // Например, Capricorn: декабрь (12) -> январь (1)
      // Проверяем: декабрь с дня startDay до конца месяца ИЛИ январь с начала до дня endDay
      if (
        (month === startMonth && day >= startDay) ||  // В начале знака (например, Dec 22+)
        (month === endMonth && day <= endDay)          // В конце знака (например, Jan 1-19)
      ) {
        return sign;
      }
    } else {
      // Обычный случай - знак в пределах одного года
      // Например, Aries: март (3) -> апрель (4)
      if (
        (month === startMonth && day >= startDay) ||           // В начале знака
        (month === endMonth && day <= endDay) ||               // В конце знака
        (month > startMonth && month < endMonth)               // Между началом и концом
      ) {
        return sign;
      }
    }
  }
  
  // Fallback на Pisces (последний знак) - не должно произойти при правильной логике
  return 'Pisces';
}

/**
 * Получает управляющую планету для знака зодиака
 * 
 * @param sign - Знак зодиака
 * @returns Название управляющей планеты
 */
export function getRulingPlanet(sign: ZodiacSign): string {
  return RULING_PLANETS[sign] || 'Sun';
}

/**
 * Получает элемент для знака зодиака
 * 
 * @param sign - Знак зодиака
 * @returns Элемент знака ('Fire', 'Earth', 'Air', или 'Water')
 */
export function getElementForSign(sign: ZodiacSign): 'Fire' | 'Earth' | 'Air' | 'Water' {
  return SIGN_ELEMENTS[sign];
}
