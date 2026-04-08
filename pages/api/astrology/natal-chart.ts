import type { NextApiRequest, NextApiResponse } from 'next';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import { repairCanonicalChartForUser, ensureCanonicalPrimaryChart } from '../../../lib/natalChartPersistence';
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST method is allowed',
    });
  }

  let lockKey: string | null = null;

  try {
    const { userId, name, birthDate, birthTime, birthPlace, language, forceRecalculate } = req.body || {};
    if (!userId || !String(userId).trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'userId is required',
      });
    }
    const normalizedBirthTime = birthTime || '12:00';
    const effectiveUserId = String(userId).trim();
    const userLanguage = language === 'en' ? 'en' : 'ru';

    const validation = validateNatalChartInput({
      name,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace,
      language: userLanguage,
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        message: formatValidationErrors(validation.errors, userLanguage),
        errors: validation.errors,
      });
    }

    lockKey = LockKeys.natalChartCalculation(effectiveUserId);

    if (!tryAcquireLock(lockKey, 'natal-chart-calculation')) {
      log.info('LOCK_DENIED: calculation already in progress', { userId: effectiveUserId });

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const repaired = await repairCanonicalChartForUser(effectiveUserId);
      if (repaired?.chart?.chart_data?.sun && repaired.chart.chart_data?.moon && repaired.chart.chart_data?.rising) {
        res.setHeader('X-Chart-Source', 'cache-after-wait');
        return res.status(200).json(repaired.chart.chart_data);
      }

      return res.status(409).json({
        error: 'Calculation in progress',
        message: userLanguage === 'ru'
          ? 'Расчёт уже выполняется. Пожалуйста, подождите.'
          : 'Calculation is already in progress. Please wait.',
      });
    }

    const result = await ensureCanonicalPrimaryChart({
      userId: effectiveUserId,
      name,
      birthDate,
      birthTime: normalizedBirthTime,
      birthPlace,
      language: userLanguage,
      forceRecalculate: !!forceRecalculate,
    });

    releaseLock(lockKey);
    lockKey = null;

    const totalDuration = Date.now() - startTime;
    log.info('Canonical natal chart ready', {
      userId: effectiveUserId,
      source: result.source,
      durationMs: totalDuration,
      sunSign: result.chart?.sun_sign,
      moonSign: result.chart?.moon_sign,
      ascendantSign: result.chart?.ascendant_sign,
    });

    res.setHeader('X-Chart-Source', result.source);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.status(200).json(result.chart.chart_data);
  } catch (error: any) {
    if (lockKey) {
      releaseLock(lockKey);
    }

    log.error('Request failed', {
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });

    const userLanguage = req.body?.language === 'en' ? 'en' : 'ru';
    const errorMsg = String(error.message || '').toLowerCase();
    let statusCode = 500;
    let message = userLanguage === 'ru'
      ? 'Не удалось рассчитать натальную карту. Попробуйте позже.'
      : 'Failed to calculate natal chart. Please try again later.';

    if (errorMsg.includes('location') || errorMsg.includes('coordinates') || errorMsg.includes('nominatim')) {
      statusCode = 400;
      message = userLanguage === 'ru'
        ? 'Не удалось найти место рождения. Проверьте правильность написания.'
        : 'Location not found. Please check the spelling of your birth place.';
    } else if (errorMsg.includes('chart slots limit')) {
      statusCode = 403;
    } else if (errorMsg.includes('ephemeris') || errorMsg.includes('initialize')) {
      message = userLanguage === 'ru'
        ? 'Ошибка астрологических расчётов. Попробуйте позже.'
        : 'Astrology calculation error. Please try again later.';
    }

    return res.status(statusCode).json({
      error: 'Calculation failed',
      message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
