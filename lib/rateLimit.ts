/**
 * Simple in-memory rate limiter
 * Для production рекомендуется использовать Redis
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory хранилище
const rateLimitStore = new Map<string, RateLimitEntry>();

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Окно времени в миллисекундах
  maxRequests: number;  // Максимум запросов в окне
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

/**
 * Проверка rate limit для пользователя
 * 
 * @param userId - ID пользователя
 * @param config - Конфигурация лимитов
 * @returns Результат проверки
 */
export function checkRateLimit(
  userId: string, 
  config: RateLimitConfig
): RateLimitResult {
  const key = `rate_limit:${userId}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Если записи нет или время истекло - создаем новую
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }
  
  // Проверяем лимит
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      error: 'Too many requests. Please try again later.'
    };
  }
  
  // Увеличиваем счетчик
  entry.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Предустановленные конфигурации
 */
export const RATE_LIMIT_CONFIGS = {
  // Бесплатные пользователи: 10 запросов в минуту
  FREE: {
    windowMs: 60 * 1000,  // 1 минута
    maxRequests: 10
  },
  
  // Премиум пользователи: 60 запросов в минуту
  PREMIUM: {
    windowMs: 60 * 1000,  // 1 минута
    maxRequests: 60
  },
  
  // AI операции (дорогие): 5 запросов в минуту для free, 30 для premium
  AI_FREE: {
    windowMs: 60 * 1000,
    maxRequests: 5
  },
  
  AI_PREMIUM: {
    windowMs: 60 * 1000,
    maxRequests: 30
  }
};

/**
 * Middleware для Next.js API routes
 */
export function withRateLimit(
  handler: any,
  configOrFn: RateLimitConfig | ((req: any) => RateLimitConfig)
) {
  return async (req: any, res: any) => {
    try {
      // Получаем user ID из запроса
      const userId = req.body?.userId || 
                     req.body?.profile?.id || 
                     req.query?.userId ||
                     'anonymous';
      
      // Определяем конфигурацию
      const config = typeof configOrFn === 'function' 
        ? configOrFn(req) 
        : configOrFn;
      
      // Проверяем rate limit
      const result = checkRateLimit(userId, config);
      
      // Добавляем заголовки
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (!result.allowed) {
        console.warn(`[RateLimit] User ${userId} exceeded rate limit`);
        return res.status(429).json({
          error: 'Too many requests',
          message: result.error,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      // Продолжаем обработку
      return handler(req, res);
    } catch (error: any) {
      console.error('[RateLimit] Error:', error);
      // В случае ошибки rate limiter - пропускаем запрос
      return handler(req, res);
    }
  };
}
