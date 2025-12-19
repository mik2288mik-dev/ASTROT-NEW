/**
 * Упрощенная система отслеживания ошибок
 * Для production рекомендуется использовать Sentry
 */

interface ErrorLog {
  timestamp: number;
  error: string;
  message: string;
  stack?: string;
  context?: any;
  userId?: string;
  endpoint?: string;
}

// In-memory хранилище последних ошибок (для отладки)
const errorLogs: ErrorLog[] = [];
const MAX_ERROR_LOGS = 100;

/**
 * Логирование ошибки
 */
export function logError(
  error: Error | string,
  context?: {
    userId?: string;
    endpoint?: string;
    metadata?: any;
  }
) {
  const errorLog: ErrorLog = {
    timestamp: Date.now(),
    error: typeof error === 'string' ? error : error.name,
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'object' && error.stack ? error.stack : undefined,
    context: context?.metadata,
    userId: context?.userId,
    endpoint: context?.endpoint
  };

  // Добавляем в память (для последних N ошибок)
  errorLogs.push(errorLog);
  if (errorLogs.length > MAX_ERROR_LOGS) {
    errorLogs.shift(); // Удаляем самую старую
  }

  // Логируем в консоль с деталями
  console.error('[ErrorTracking]', {
    timestamp: new Date(errorLog.timestamp).toISOString(),
    error: errorLog.error,
    message: errorLog.message,
    userId: errorLog.userId,
    endpoint: errorLog.endpoint
  });

  // В production можно отправлять в внешний сервис
  if (process.env.NODE_ENV === 'production') {
    // TODO: Отправка в Sentry/LogRocket/другой сервис
    // Example: Sentry.captureException(error);
  }
}

/**
 * Получить последние ошибки (для админ панели)
 */
export function getRecentErrors(limit = 50): ErrorLog[] {
  return errorLogs.slice(-limit).reverse();
}

/**
 * Очистить логи ошибок
 */
export function clearErrorLogs() {
  errorLogs.length = 0;
}

/**
 * Middleware для обработки ошибок в API routes
 */
export function withErrorTracking(handler: any) {
  return async (req: any, res: any) => {
    try {
      return await handler(req, res);
    } catch (error: any) {
      // Логируем ошибку
      logError(error, {
        userId: req.body?.userId || req.body?.profile?.id,
        endpoint: req.url,
        metadata: {
          method: req.method,
          body: req.body ? Object.keys(req.body) : []
        }
      });

      // Возвращаем 500 ошибку
      return res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'An error occurred. Please try again later.'
      });
    }
  };
}

/**
 * Хук для логирования ошибок в React компонентах
 */
export function useErrorTracking() {
  return {
    logError: (error: Error | string, metadata?: any) => {
      logError(error, { metadata });
    }
  };
}
