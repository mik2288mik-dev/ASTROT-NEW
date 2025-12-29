/**
 * Утилиты для кэширования данных
 * Используется для ISR и оптимизации запросов
 */

export interface CacheConfig {
  revalidate?: number; // Время в секундах до ревалидации (ISR)
  tags?: string[]; // Теги для групповой инвалидации кэша
}

/**
 * Конфигурация кэширования для разных типов контента
 */
export const CACHE_CONFIGS = {
  // Ежедневный гороскоп - обновляется раз в день (00:01 МСК)
  dailyHoroscope: {
    revalidate: 86400, // 24 часа
    tags: ['daily-horoscope']
  },
  
  // Еженедельный гороскоп - обновляется раз в неделю
  weeklyHoroscope: {
    revalidate: 604800, // 7 дней
    tags: ['weekly-horoscope']
  },
  
  // Ежемесячный гороскоп - обновляется раз в месяц
  monthlyHoroscope: {
    revalidate: 2592000, // 30 дней
    tags: ['monthly-horoscope']
  },
  
  // Натальная карта - статична, не меняется
  natalChart: {
    revalidate: false, // Не ревалидируется автоматически
    tags: ['natal-chart']
  },
  
  // Deep Dive анализы - статичны
  deepDive: {
    revalidate: false,
    tags: ['deep-dive']
  },
  
  // Синастрия - статична для пары пользователей
  synastry: {
    revalidate: false,
    tags: ['synastry']
  }
} as const;

/**
 * Получает время следующего обновления гороскопа (00:01 по МСК)
 */
export function getNextDailyUpdateTime(): number {
  const now = new Date();
  const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
  
  const nextUpdate = new Date(moscowTime);
  nextUpdate.setHours(0, 1, 0, 0);
  
  if (moscowTime.getTime() >= nextUpdate.getTime()) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }
  
  return Math.floor((nextUpdate.getTime() - (3 * 60 * 60 * 1000)) / 1000);
}

/**
 * Вычисляет время до следующего обновления в секундах
 */
export function getSecondsUntilNextUpdate(): number {
  const nextUpdate = getNextDailyUpdateTime();
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, nextUpdate - now);
}

/**
 * ЧЕТКАЯ ЛОГИКА КЭШИРОВАНИЯ НАТАЛЬНОЙ КАРТЫ
 * 
 * Правила кэширования:
 * 1. Натальная карта (расчет планет) - НИКОГДА не меняется (статична)
 * 2. Вступление натальной карты - генерируется один раз, обновляется только через регенерацию
 * 3. Deep Dive анализы - генерируются один раз, обновляются только через регенерацию
 * 4. Ежедневный гороскоп - обновляется каждый день в 00:01 МСК
 */

export interface NatalChartCacheStatus {
  /** Натальная карта актуальна (всегда true, т.к. статична) */
  chartValid: boolean;
  /** Вступление есть в кэше */
  introCached: boolean;
  /** Вступление нужно обновить (только через регенерацию) */
  introNeedsUpdate: boolean;
  /** Deep Dive анализы есть в кэше */
  deepDiveCached: boolean;
  /** Ежедневный гороскоп актуален */
  horoscopeValid: boolean;
  /** Время следующего обновления гороскопа */
  nextHoroscopeUpdate: number;
}

/**
 * Проверяет статус кэша натальной карты
 */
export function checkNatalChartCache(
  generatedContent?: any,
  chartData?: any
): NatalChartCacheStatus {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  // Натальная карта всегда актуальна (статична)
  const chartValid = !!(chartData?.sun && chartData?.moon && chartData?.rising);
  
  // Вступление: проверяем наличие и валидность
  const introCached = !!(generatedContent?.natalIntro && 
                         generatedContent.natalIntro.length > 50);
  // Вступление обновляется только через регенерацию (не автоматически)
  const introNeedsUpdate = false;
  
  // Deep Dive: проверяем наличие всех анализов
  const deepDiveAnalyses = generatedContent?.deepDiveAnalyses || {};
  const deepDiveCached = !!(
    deepDiveAnalyses.personality &&
    deepDiveAnalyses.love &&
    deepDiveAnalyses.career &&
    deepDiveAnalyses.weakness &&
    deepDiveAnalyses.karma
  );
  
  // Ежедневный гороскоп: проверяем дату
  const horoscope = generatedContent?.dailyHoroscope;
  const horoscopeValid = !!(
    horoscope &&
    horoscope.date === today &&
    horoscope.content &&
    horoscope.content.length > 0
  );
  
  const nextHoroscopeUpdate = getNextDailyUpdateTime() * 1000;
  
  return {
    chartValid,
    introCached,
    introNeedsUpdate,
    deepDiveCached,
    horoscopeValid,
    nextHoroscopeUpdate
  };
}

/**
 * Определяет, нужно ли загружать вступление натальной карты
 */
export function shouldLoadNatalIntro(generatedContent?: any): boolean {
  const intro = generatedContent?.natalIntro;
  return !intro || intro.length < 50;
}

/**
 * Определяет, нужно ли загружать Deep Dive анализ для конкретной темы
 */
export function shouldLoadDeepDive(
  generatedContent: any,
  topic: 'personality' | 'love' | 'career' | 'weakness' | 'karma'
): boolean {
  const analyses = generatedContent?.deepDiveAnalyses || {};
  return !analyses[topic] || analyses[topic].length === 0;
}

/**
 * Определяет, нужно ли обновлять ежедневный гороскоп
 */
export function shouldUpdateDailyHoroscope(generatedContent?: any): boolean {
  const today = new Date().toISOString().split('T')[0];
  const horoscope = generatedContent?.dailyHoroscope;
  
  // Если нет гороскопа или дата не совпадает - нужно обновить
  if (!horoscope || horoscope.date !== today) {
    return true;
  }
  
  // Если контент пустой - нужно обновить
  if (!horoscope.content || horoscope.content.length === 0) {
    return true;
  }
  
  // Проверяем временную метку (обновление в 00:01 МСК)
  const lastGenerated = generatedContent?.timestamps?.dailyHoroscopeGenerated || 0;
  if (!lastGenerated) {
    return true;
  }
  
  const now = Date.now();
  const moscowNow = new Date(now + (3 * 60 * 60 * 1000));
  const moscowLast = new Date(lastGenerated + (3 * 60 * 60 * 1000));
  
  const lastUpdateDate = new Date(moscowLast);
  lastUpdateDate.setHours(0, 1, 0, 0);
  
  const currentUpdateDate = new Date(moscowNow);
  currentUpdateDate.setHours(0, 1, 0, 0);
  
  // Если прошло 00:01 и дата изменилась - нужно обновить
  if (moscowNow.getHours() > 0 || (moscowNow.getHours() === 0 && moscowNow.getMinutes() >= 1)) {
    return currentUpdateDate.getTime() > lastUpdateDate.getTime();
  }
  
  return false;
}
