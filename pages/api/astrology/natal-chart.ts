import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import { db } from '../../../lib/db';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';

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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  log.info('=== REQUEST START ===', {
    method: req.method,
    path: req.url,
  });

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST method is allowed',
    });
  }

  let lockKey: string | null = null;

  try {
    const { userId, name, birthDate, birthTime, birthPlace, language, forceRecalculate } = req.body;

    const validation = validateNatalChartInput({
      name,
      birthDate,
      birthTime,
      birthPlace,
      language: language || 'ru',
    });

    if (!validation.isValid) {
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);

      log.error('Validation failed', { errors: validation.errors });

      return res.status(400).json({
        error: 'Validation failed',
        message: errorMessage,
        errors: validation.errors,
      });
    }

    const normalizedBirthTime = birthTime || '12:00';
    const effectiveUserId = userId || 'anonymous';
    const hasDatabase = !!process.env.DATABASE_URL;

    log.info('Request validated', {
      userId: effectiveUserId,
      name,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace,
      forceRecalculate,
    });

    if (!forceRecalculate && hasDatabase) {
      let checkResult;
      try {
        checkResult = await db.natal_charts.needsRecalculation(
          effectiveUserId,
          birthDate,
          normalizedBirthTime,
          birthPlace
        );
      } catch (cacheError: any) {
        log.error('Cache check failed, aborting calculation', {
          error: cacheError.message,
          userId: effectiveUserId,
        });
        return res.status(500).json({
          error: 'Cache check failed',
          message: language === 'ru'
            ? 'Не удалось проверить сохранённую карту. Попробуйте ещё раз.'
            : 'Failed to verify the saved chart. Please try again.',
        });
      }

      if (!checkResult.needsCalc && checkResult.existingChart) {
        const duration = Date.now() - startTime;
        log.info(`CACHE_HIT: returning existing chart (${duration}ms)`, {
          userId: effectiveUserId,
          reason: checkResult.reason,
        });

        res.setHeader('X-Chart-Source', 'cache');
        res.setHeader('X-Chart-Reason', checkResult.reason);

        return res.status(200).json(checkResult.existingChart.chart_data);
      }

      log.info('CACHE_MISS: need to calculate', {
        userId: effectiveUserId,
        reason: checkResult.reason,
      });
    } else if (forceRecalculate) {
      log.info('FORCE_RECALCULATE: skipping cache check');
    } else {
      log.info('DATABASE_URL not configured: skipping cache check');
    }

    lockKey = LockKeys.natalChartCalculation(effectiveUserId);

    if (!tryAcquireLock(lockKey, 'natal-chart-calculation')) {
      log.info('LOCK_DENIED: calculation already in progress', {
        userId: effectiveUserId,
      });

      if (hasDatabase) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const existingChart = await db.natal_charts.get(effectiveUserId);
          if (existingChart && existingChart.chart_data) {
            res.setHeader('X-Chart-Source', 'cache-after-wait');
            return res.status(200).json(existingChart.chart_data);
          }
        } catch (dbError: any) {
          log.error('Failed to get chart from DB after wait', {
            error: dbError.message,
            userId: effectiveUserId,
          });
          return res.status(500).json({
            error: 'Database error',
            message: language === 'ru'
              ? 'Не удалось получить карту из хранилища. Попробуйте ещё раз.'
              : 'Failed to load the chart from storage. Please try again.',
          });
        }
      }

      return res.status(409).json({
        error: 'Calculation in progress',
        message: language === 'ru'
          ? 'Расчёт уже выполняется. Пожалуйста, подождите.'
          : 'Calculation is already in progress. Please wait.',
      });
    }

    log.info('CALCULATING: starting Swiss Ephemeris calculation', {
      userId: effectiveUserId,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace,
    });

    const calcStartTime = Date.now();
    const chartData = await calculateNatalChart(
      name,
      birthDate,
      normalizedBirthTime,
      birthPlace
    );
    const calcDuration = Date.now() - calcStartTime;

    if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
      throw new Error('Invalid chart data: missing essential planets');
    }

    log.info('CALCULATED: chart calculation complete', {
      userId: effectiveUserId,
      durationMs: calcDuration,
      sunSign: chartData.sun.sign,
      moonSign: chartData.moon.sign,
      risingSign: chartData.rising.sign,
    });

    if (hasDatabase) {
      try {
        const existingUser = await db.users.get(effectiveUserId);
        if (!existingUser) {
          log.info('Creating minimal user record for chart FK constraint', { userId: effectiveUserId });
          await db.users.set(effectiveUserId, {
            name,
            birth_date: birthDate,
            birth_time: normalizedBirthTime,
            birth_place: birthPlace,
            is_setup: false,
            language: language || 'ru',
            theme: 'dark',
            is_admin: false,
          });
          log.info('Minimal user record created', { userId: effectiveUserId });
        }

        await db.natal_charts.set(
          effectiveUserId,
          chartData,
          birthDate,
          normalizedBirthTime,
          birthPlace
        );

        log.info('SAVED: chart saved to database', {
          userId: effectiveUserId,
        });
      } catch (dbError: any) {
        log.error('Failed to save chart to database', {
          error: dbError.message,
          userId: effectiveUserId,
        });
        throw new Error(`CHART_PERSIST_FAILED:${dbError.message}`);
      }
    } else {
      log.warn('DATABASE_URL not configured, skipping database save');
    }

    releaseLock(lockKey);
    lockKey = null;

    const totalDuration = Date.now() - startTime;
    log.info(`=== REQUEST COMPLETE (${totalDuration}ms) ===`, {
      userId: effectiveUserId,
      source: 'calculated',
      calcDuration,
    });

    res.setHeader('X-Chart-Source', 'calculated');
    res.setHeader('X-Calculation-Time', calcDuration.toString());
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return res.status(200).json(chartData);
  } catch (error: any) {
    if (lockKey) {
      releaseLock(lockKey);
    }

    const duration = Date.now() - startTime;
    log.error(`Request failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack,
    });

    const userLanguage = req.body?.language === 'en' ? 'en' : 'ru';
    const errorMsg = (error.message || '').toLowerCase();
    let errorMessage = '';
    let statusCode = 500;

    if (errorMsg.includes('location not found') || errorMsg.includes('coordinates') || errorMsg.includes('nominatim')) {
      statusCode = 400;
      errorMessage = userLanguage === 'ru'
        ? 'Не удалось найти указанное место рождения. Проверьте правильность написания.'
        : 'Location not found. Please check the spelling of your birth place.';
    } else if (errorMsg.includes('initialize') || errorMsg.includes('ephemeris')) {
      errorMessage = userLanguage === 'ru'
        ? 'Ошибка инициализации расчётов. Попробуйте позже.'
        : 'Calculation initialization error. Please try again later.';
    } else if (error.message?.startsWith('CHART_PERSIST_FAILED:')) {
      errorMessage = userLanguage === 'ru'
        ? 'Карта рассчитана, но не сохранилась в базе. Повторите попытку.'
        : 'The chart was calculated but could not be saved. Please try again.';
    } else {
      errorMessage = userLanguage === 'ru'
        ? 'Не удалось рассчитать натальную карту. Попробуйте позже.'
        : 'Failed to calculate natal chart. Please try again later.';
    }

    return res.status(statusCode).json({
      error: 'Calculation failed',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
