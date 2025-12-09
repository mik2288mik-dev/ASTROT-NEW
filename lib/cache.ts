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
  
  // Три ключа - статичны для пользователя
  threeKeys: {
    revalidate: false,
    tags: ['three-keys']
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
