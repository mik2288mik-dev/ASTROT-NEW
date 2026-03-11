import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import { db } from '../../../lib/db';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';
import { getShortDescription } from '../../../lib/descriptions';

function toMvpFormat(chartData: any, hasExactTime: boolean): any {
  const hasHouses = hasExactTime && chartData?.rising;
  const toPlanet = (p: any, body?: 'sun' | 'moon' | 'ascendant') => {
    if (!p || !p.sign) return null;
    const base = { sign: p.sign, degree: typeof p.degree === 'number' ? p.degree : parseFloat(p.degree) || 0 };
    if (body) {
      return { ...base, retrograde: p.retrograde ?? false, description_short: getShortDescription(body, p.sign) };
    }
    return { ...base, retrograde: p.retrograde ?? false };
  };
  const toAsc = (p: any) => {
    if (!p || !p.sign || !hasHouses) return null;
    const deg = typeof p.degree === 'number' ? p.degree : parseFloat(p.degree) || 0;
    return { sign: p.sign, degree: deg, description_short: getShortDescription('ascendant', p.sign) };
  };
  return {
    success: true,
    data: {
      sun: toPlanet(chartData?.sun, 'sun') || { sign: '', degree: 0, retrograde: false, description_short: '' },
      moon: toPlanet(chartData?.moon, 'moon') || { sign: '', degree: 0, retrograde: false, description_short: '' },
      ascendant: toAsc(chartData?.rising),
      mercury: toPlanet(chartData?.mercury) || { sign: '', degree: 0, retrograde: false },
      venus: toPlanet(chartData?.venus) || { sign: '', degree: 0, retrograde: false },
      mars: toPlanet(chartData?.mars) || { sign: '', degree: 0, retrograde: false },
    },
    houses_available: hasHouses,
  };
}

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/natal-chart] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API/natal-chart] WARNING: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/natal-chart] ERROR: ${message}`, error || '');
  },
};

/**
 * ИДЕМПОТЕНТНЫЙ API для расчёта натальной карты
 * 
 * Логика:
 * 1. Проверяем есть ли карта в БД
 * 2. Если есть и данные рождения не изменились - возвращаем из БД (CACHE_HIT)
 * 3. Если нет или данные изменились - рассчитываем, сохраняем, возвращаем (CALCULATED)
 * 4. Защита от двойных вызовов через серверный mutex
 * 
 * Логирование:
 * - CACHE_HIT: карта взята из БД без пересчёта
 * - CACHE_MISS: карты нет, нужен расчёт
 * - BIRTH_DATA_CHANGED: данные изменились, нужен пересчёт
 * - CALCULATED: карта рассчитана
 * - SAVED: карта сохранена в БД
 * - LOCK_DENIED: запрос уже выполняется для этого пользователя
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  
  log.info('=== REQUEST START ===', {
    method: req.method,
    path: req.url
  });

  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST method is allowed'
    });
  }

  let lockKey: string | null = null;

  try {
    const { userId, name, birthDate, birthTime, birthPlace, language, forceRecalculate } = req.body;

    // Строгая валидация входных данных
    const validation = validateNatalChartInput({
      name,
      birthDate,
      birthTime,
      birthPlace,
      language: language || 'ru'
    });

    if (!validation.isValid) {
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);
      
      log.error('Validation failed', { errors: validation.errors });
      
      return res.status(400).json({ 
        error: 'Validation failed',
        message: errorMessage,
        errors: validation.errors
      });
    }

    // Нормализуем данные
    const normalizedBirthTime = birthTime || '12:00';
    const effectiveUserId = userId || 'anonymous';

    log.info('Request validated', {
      userId: effectiveUserId,
      name,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace,
      forceRecalculate
    });

    // ШАГ 1: Проверяем, нужен ли пересчёт (только если БД доступна)
    const DATABASE_URL_CHECK = process.env.DATABASE_URL;
    
    if (!forceRecalculate && DATABASE_URL_CHECK) {
      try {
        const checkResult = await db.charts.needsRecalculation(
          effectiveUserId, 
          birthDate, 
          normalizedBirthTime, 
          birthPlace
        );

        if (!checkResult.needsCalc && checkResult.existingChart) {
          const duration = Date.now() - startTime;
          log.info(`CACHE_HIT: returning existing chart (${duration}ms)`, {
            userId: effectiveUserId,
            reason: checkResult.reason
          });

          const hasExactTime = !!(birthTime && String(birthTime).trim().length > 0);
          const mvpResponse = toMvpFormat(checkResult.existingChart.chart_data, hasExactTime);

          res.setHeader('X-Chart-Source', 'cache');
          res.setHeader('X-Chart-Reason', checkResult.reason);

          return res.status(200).json(mvpResponse);
        }

        log.info(`CACHE_MISS: need to calculate`, {
          userId: effectiveUserId,
          reason: checkResult.reason
        });
      } catch (cacheError: any) {
        log.warn('Cache check failed, proceeding to calculate', { error: cacheError.message });
      }
    } else if (forceRecalculate) {
      log.info('FORCE_RECALCULATE: skipping cache check');
    } else {
      log.info('DATABASE_URL not configured: skipping cache check');
    }

    // ШАГ 2: Пытаемся получить блокировку
    lockKey = LockKeys.natalChartCalculation(effectiveUserId);
    
    if (!tryAcquireLock(lockKey, 'natal-chart-calculation')) {
      log.info('LOCK_DENIED: calculation already in progress', {
        userId: effectiveUserId
      });
      
      // Ждём немного и пробуем взять из БД (если БД доступна)
      if (DATABASE_URL_CHECK) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const existingChart = await db.charts.get(effectiveUserId);
          if (existingChart && existingChart.chart_data) {
            const hasExactTime = !!(birthTime && String(birthTime).trim().length > 0);
            const mvpResponse = toMvpFormat(existingChart.chart_data, hasExactTime);
            res.setHeader('X-Chart-Source', 'cache-after-wait');
            return res.status(200).json(mvpResponse);
          }
        } catch (dbError: any) {
          log.warn('Failed to get chart from DB after wait', { error: dbError.message });
        }
      }
      
      return res.status(409).json({
        error: 'Calculation in progress',
        message: language === 'ru' 
          ? 'Расчёт уже выполняется. Пожалуйста, подождите.'
          : 'Calculation is already in progress. Please wait.'
      });
    }

    // ШАГ 3: Рассчитываем карту
    log.info('CALCULATING: starting Swiss Ephemeris calculation', {
      userId: effectiveUserId,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace
    });

    const calcStartTime = Date.now();
    
    const chartData = await calculateNatalChart(
      name,
      birthDate,
      normalizedBirthTime,
      birthPlace
    );

    const calcDuration = Date.now() - calcStartTime;

    // Валидация результата
    if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
      throw new Error('Invalid chart data: missing essential planets');
    }

    log.info('CALCULATED: chart calculation complete', {
      userId: effectiveUserId,
      durationMs: calcDuration,
      sunSign: chartData.sun.sign,
      moonSign: chartData.moon.sign,
      risingSign: chartData.rising.sign
    });

    // ШАГ 4: Сохраняем в БД (если БД доступна)
    // Проверяем наличие DATABASE_URL
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (DATABASE_URL) {
      try {
        // Сначала проверяем, существует ли пользователь (для FK constraint)
        const existingUser = await db.users.get(effectiveUserId);
        if (!existingUser) {
          // Создаём минимальную запись пользователя для FK constraint
          log.info('Creating minimal user record for chart FK constraint', { userId: effectiveUserId });
          await db.users.set(effectiveUserId, {
            id: effectiveUserId,
            name: name,
            birth_date: birthDate,
            birth_time: normalizedBirthTime,
            birth_place: birthPlace,
            is_setup: false,
            language: language || 'ru',
            theme: 'dark',
            is_premium: false,
            is_admin: false,
            evolution: null,
            generated_content: null,
            weather_city: null,
          });
          log.info('Minimal user record created', { userId: effectiveUserId });
        }
        
        await db.charts.set(
          effectiveUserId, 
          chartData, 
          birthDate, 
          normalizedBirthTime, 
          birthPlace
        );

        log.info('SAVED: chart saved to database', {
          userId: effectiveUserId
        });
      } catch (dbError: any) {
        log.warn('Failed to save chart to database, returning calculated data anyway', { 
          error: dbError.message,
          userId: effectiveUserId
        });
      }
    } else {
      log.warn('DATABASE_URL not configured, skipping database save');
    }

    // Освобождаем блокировку
    releaseLock(lockKey);
    lockKey = null;

    const totalDuration = Date.now() - startTime;
    log.info(`=== REQUEST COMPLETE (${totalDuration}ms) ===`, {
      userId: effectiveUserId,
      source: 'calculated',
      calcDuration: calcDuration
    });

    const hasExactTime = !!(birthTime && String(birthTime).trim().length > 0);
    const mvpResponse = toMvpFormat(chartData, hasExactTime);

    res.setHeader('X-Chart-Source', 'calculated');
    res.setHeader('X-Calculation-Time', calcDuration.toString());
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return res.status(200).json(mvpResponse);
    
  } catch (error: any) {
    // Освобождаем блокировку при ошибке
    if (lockKey) {
      releaseLock(lockKey);
    }

    const duration = Date.now() - startTime;
    log.error(`Request failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack
    });

    const userLanguage = req.body?.language === 'en' ? 'en' : 'ru';
    
    // Классификация ошибок
    const errorMsg = (error.message || '').toLowerCase();
    let errorMessage = '';
    let statusCode = 500;
    
    if (errorMsg.includes('location not found') || errorMsg.includes('coordinates') || errorMsg.includes('nominatim')) {
      statusCode = 400;
      errorMessage = userLanguage === 'ru'
        ? 'Не удалось найти указанное место рождения. Проверьте правильность написания.'
        : 'Location not found. Please check the spelling of your birth place.';
    } else if (errorMsg.includes('initialize') || errorMsg.includes('ephemeris')) {
      statusCode = 500;
      errorMessage = userLanguage === 'ru'
        ? 'Ошибка инициализации расчётов. Попробуйте позже.'
        : 'Calculation initialization error. Please try again later.';
    } else {
      errorMessage = userLanguage === 'ru'
        ? 'Не удалось рассчитать натальную карту. Попробуйте позже.'
        : 'Failed to calculate natal chart. Please try again later.';
    }
    
    return res.status(statusCode).json({ 
      error: 'Calculation failed',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Rate limiting: 10 запросов в минуту
export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
