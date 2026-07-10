/**
 * Серверные блокировки для предотвращения двойных вызовов
 * 
 * Использует Map в памяти сервера для отслеживания активных операций.
 * При перезапуске сервера блокировки сбрасываются - это нормально,
 * т.к. БД остаётся источником истины.
 */

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[ServerLocks] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ServerLocks] WARNING: ${message}`, data || '');
  },
};

// Активные операции: ключ -> timestamp начала
const activeLocks = new Map<string, { startedAt: number; operation: string }>();

// Таймаут блокировки (5 минут) - если операция зависла
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Попытаться получить блокировку для операции
 * @returns true если блокировка получена, false если уже выполняется
 */
export function tryAcquireLock(key: string, operation: string): boolean {
  const existing = activeLocks.get(key);
  
  if (existing) {
    const elapsed = Date.now() - existing.startedAt;
    
    // Если блокировка висит слишком долго - очищаем её
    if (elapsed > LOCK_TIMEOUT_MS) {
      log.warn(`Lock expired for ${key}, releasing`, {
        operation: existing.operation,
        elapsedMs: elapsed
      });
      activeLocks.delete(key);
    } else {
      log.info(`Lock already held for ${key}`, {
        operation: existing.operation,
        elapsedMs: elapsed
      });
      return false;
    }
  }
  
  activeLocks.set(key, { startedAt: Date.now(), operation });
  log.info(`Lock acquired: ${key}`, { operation });
  return true;
}

/**
 * Освободить блокировку
 */
export function releaseLock(key: string): void {
  const existing = activeLocks.get(key);
  if (existing) {
    const elapsed = Date.now() - existing.startedAt;
    log.info(`Lock released: ${key}`, {
      operation: existing.operation,
      durationMs: elapsed
    });
  }
  activeLocks.delete(key);
}

/**
 * Проверить, заблокирована ли операция
 */
export function isLocked(key: string): boolean {
  const existing = activeLocks.get(key);
  if (!existing) return false;
  
  const elapsed = Date.now() - existing.startedAt;
  if (elapsed > LOCK_TIMEOUT_MS) {
    activeLocks.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Генерация ключей блокировки для разных операций
 */
export const LockKeys = {
  natalChartCalculation: (userId: string) => `natal-chart:${userId}`,
  dailyHoroscope: (userId: string, date: string) => `daily-horoscope:${userId}:${date}`,
  todayOverview: (userId: string, chartId: number | null, date: string) => `today-overview:${userId}:${chartId ?? 'primary'}:${date}`,
  deepDive: (userId: string, topic: string) => `deep-dive:${userId}:${topic}`,
  contentGeneration: (key: string) => key,
};

/**
 * Очистка устаревших блокировок (вызывается периодически)
 */
export function cleanupExpiredLocks(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, lock] of activeLocks.entries()) {
    if (now - lock.startedAt > LOCK_TIMEOUT_MS) {
      activeLocks.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    log.info(`Cleaned up ${cleaned} expired locks`);
  }
  
  return cleaned;
}

// Периодическая очистка каждые 5 минут
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(cleanupExpiredLocks, 5 * 60 * 1000) as ReturnType<typeof setInterval> & {
    unref?: () => void;
  };
  cleanupTimer.unref?.();
}
