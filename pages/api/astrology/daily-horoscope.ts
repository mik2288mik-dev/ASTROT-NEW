import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createDailyForecastPrompt, addLanguageInstruction, DailyForecastAIResponse } from '../../../lib/prompts';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { db } from '../../../lib/db';
import { hasDatabaseUrl } from '../../../lib/database-url';
import { getCurrentTransits } from '../../../lib/transits-calculator';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';
import { getMoscowTodayKey } from '../../../lib/date-utils';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/daily-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/daily-horoscope] ERROR: ${message}`, error || '');
  },
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type DailyErrorCode =
  | 'PRIMARY_CHART_MISSING'
  | 'GENERATION_IN_PROGRESS'
  | 'DAILY_CACHE_READ_FAILED'
  | 'DAILY_PERSIST_FAILED';

type DailySource = 'cache' | 'generated' | 'generated-not-persisted' | 'cache-after-wait';

function buildFallbackHoroscope(lang: boolean, dateKey: string) {
  return {
    date: dateKey,
    mood: lang ? 'Собранный день' : 'Steady day',
    color: 'Purple',
    number: 7,
    content: lang
      ? 'Сегодня тебе полезнее не разбрасываться, а держаться за один ясный приоритет. Чем меньше лишнего шума и поспешных реакций, тем легче увидеть, где у дня есть реальная опора.\n\nВ разговорах и решениях поможет спокойный темп. Сначала пойми, что для тебя действительно важно, и уже потом отвечай миру.'
      : 'Today it will help more to stay with one clear priority than to scatter yourself. The less noise and rushed reaction you allow in, the easier it becomes to notice where the day is actually giving you support.\n\nA calmer pace will help in both conversation and decision-making. First notice what truly matters to you, then respond.',
    moonImpact: lang ? 'Эмоциональный фон делает интуицию точнее, если не спешить.' : 'The emotional tone sharpens intuition when you do not rush.',
    transitFocus: lang ? 'Главный акцент дня — ясность в выборе и спокойствие в контактах.' : 'The main emphasis of the day is clarity in choices and calm in contact.',
  };
}

function getErrorMessage(lang: boolean, code: DailyErrorCode): string {
  switch (code) {
    case 'PRIMARY_CHART_MISSING':
      return lang
        ? 'Для гороскопа не найдена основная карта. Откройте приложение ещё раз или пересоздайте карту.'
        : 'Primary chart was not found for this horoscope. Please reopen the app or recreate the chart.';
    case 'GENERATION_IN_PROGRESS':
      return lang
        ? 'Гороскоп генерируется. Подождите.'
        : 'Horoscope is being generated. Please wait.';
    case 'DAILY_PERSIST_FAILED':
      return lang
        ? 'Показываем свежий гороскоп, но он пока не сохранился в базе.'
        : 'Showing a fresh horoscope, but it has not been saved yet.';
    case 'DAILY_CACHE_READ_FAILED':
    default:
      return lang
        ? 'Не удалось получить гороскоп. Попробуйте позже.'
        : 'Failed to get horoscope. Please try again later.';
  }
}

function withHoroscopeMeta(
  horoscope: any,
  meta: {
    persisted: boolean;
    source: DailySource;
    code?: DailyErrorCode;
    message?: string;
  }
) {
  return {
    ...horoscope,
    persisted: meta.persisted,
    source: meta.source,
    ...(meta.code ? { code: meta.code } : {}),
    ...(meta.message ? { message: meta.message } : {}),
  };
}

function sendDailyError(
  res: NextApiResponse,
  lang: boolean,
  status: number,
  code: DailyErrorCode,
  details?: string,
  message?: string
) {
  return res.status(status).json({
    error: 'Horoscope generation failed',
    code,
    message: message || getErrorMessage(lang, code),
    details: process.env.NODE_ENV === 'development' ? details : undefined,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('X-Lumia-Legacy-Endpoint', 'daily-horoscope');
  res.setHeader('Warning', '299 - "Deprecated: prefer /api/content/forecast/daily"');

  const startTime = Date.now();
  const dateKey = getMoscowTodayKey();

  try {
    if (req.method === 'GET') {
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const lang = req.query.lang === 'en' ? false : true;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'userId is required',
        });
      }

      if (!hasDatabaseUrl()) {
        return sendDailyError(
          res,
          lang,
          500,
          'DAILY_CACHE_READ_FAILED',
          'DATABASE_URL is not configured'
        );
      }

      try {
        const existingContent = await db.daily_natal_cards.getForPrimaryUser(userId, dateKey);
        if (!existingContent) {
          return res.status(404).json({
            error: 'NOT_FOUND',
            code: 'DAILY_NOT_FOUND',
            message: lang
              ? 'Гороскоп на сегодня ещё не сохранён.'
              : 'No horoscope cached for today.',
          });
        }

        const payload = withHoroscopeMeta(existingContent, {
          persisted: true,
          source: 'cache',
        });
        res.setHeader('X-Horoscope-Source', payload.source);
        res.setHeader('X-Horoscope-Date', dateKey);
        res.setHeader('X-Horoscope-Persisted', 'true');
        return res.status(200).json(payload);
      } catch (readError: any) {
        return sendDailyError(
          res,
          lang,
          500,
          'DAILY_CACHE_READ_FAILED',
          readError.message
        );
      }
    }

    const { userId, profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const hasDatabase = hasDatabaseUrl();

    if (!userId || !profile || !chartData) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'userId, profile and chartData are required',
      });
    }

    const effectiveUserId = String(userId).trim();
    const zodiacSign = chartData?.sun?.sign;
    if (!zodiacSign) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'chartData must contain sun.sign',
      });
    }

    log.info(`=== REQUEST START === userId=${effectiveUserId}, date=${dateKey}, sign=${zodiacSign}`);

    let primaryChartId: number | null = null;
    let usesChartScope = false;

    if (hasDatabase) {
      try {
        usesChartScope = await db.daily_natal_cards.supportsChartScope();
      } catch (scopeError: any) {
        log.error('Failed to detect daily storage scope', {
          error: scopeError.message,
          userId: effectiveUserId,
        });
        return sendDailyError(
          res,
          lang,
          500,
          'DAILY_CACHE_READ_FAILED',
          scopeError.message,
          lang
            ? 'Не удалось проверить хранилище гороскопа. Попробуйте позже.'
            : 'Failed to verify horoscope storage. Please try again later.'
        );
      }

      if (usesChartScope) {
        const primaryChart = await db.natal_charts.getPrimary(effectiveUserId);
        if (!primaryChart) {
          return sendDailyError(res, lang, 409, 'PRIMARY_CHART_MISSING');
        }
        primaryChartId = primaryChart.id;
      }

      try {
        const existingContent = await db.daily_natal_cards.getForPrimaryUser(effectiveUserId, dateKey);
        if (existingContent) {
          const duration = Date.now() - startTime;
          log.info(`DB_HIT: returning cached horoscope (${duration}ms)`, {
            userId: effectiveUserId,
            chartId: primaryChartId,
            dateKey,
            zodiacSign,
            usesChartScope,
          });

          const payload = withHoroscopeMeta(existingContent, {
            persisted: true,
            source: 'cache',
          });
          res.setHeader('X-Horoscope-Source', payload.source);
          res.setHeader('X-Horoscope-Date', dateKey);
          res.setHeader('X-Horoscope-Persisted', 'true');
          return res.status(200).json(payload);
        }
      } catch (readError: any) {
        log.error('Failed to read horoscope from DB', {
          error: readError.message,
          userId: effectiveUserId,
          chartId: primaryChartId,
          dateKey,
        });
        return sendDailyError(
          res,
          lang,
          500,
          'DAILY_CACHE_READ_FAILED',
          readError.message,
          lang
            ? 'Не удалось загрузить сохранённый гороскоп. Попробуйте позже.'
            : 'Failed to load the saved horoscope. Please try again later.'
        );
      }
    }

    log.info(`DB_MISS: no horoscope for date=${dateKey}, will generate`);

    const lockKey = LockKeys.dailyHoroscope(effectiveUserId, dateKey);
    if (!tryAcquireLock(lockKey, 'daily-horoscope-generation')) {
      log.info('LOCK_DENIED: generation already in progress');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (hasDatabase) {
        try {
          const afterWait = await db.daily_natal_cards.getForPrimaryUser(effectiveUserId, dateKey);
          if (afterWait) {
            const payload = withHoroscopeMeta(afterWait, {
              persisted: true,
              source: 'cache-after-wait',
            });
            res.setHeader('X-Horoscope-Source', payload.source);
            res.setHeader('X-Horoscope-Date', dateKey);
            res.setHeader('X-Horoscope-Persisted', 'true');
            return res.status(200).json(payload);
          }
        } catch (readAfterWaitError: any) {
          log.error('Failed to read horoscope after waiting for lock', {
            error: readAfterWaitError.message,
            userId: effectiveUserId,
            chartId: primaryChartId,
            dateKey,
          });
          return sendDailyError(
            res,
            lang,
            500,
            'DAILY_CACHE_READ_FAILED',
            readAfterWaitError.message,
            lang
              ? 'Не удалось дочитать гороскоп после ожидания. Попробуйте позже.'
              : 'Failed to load the horoscope after waiting. Please try again later.'
          );
        }
      }

      return sendDailyError(res, lang, 409, 'GENERATION_IN_PROGRESS');
    }

    try {
      let horoscope;

      if (!openai) {
        log.error('OpenAI API key not configured');
        horoscope = buildFallbackHoroscope(lang, dateKey);
      } else {
        let transits = null;
        try {
          transits = await getCurrentTransits();
          log.info('Transits calculated', { sunSign: transits?.sun?.sign });
        } catch (error) {
          log.error('Failed to calculate transits', error);
        }

        log.info('GENERATING: calling OpenAI');

        const currentDateStr = new Date().toLocaleDateString(lang ? 'ru-RU' : 'en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const userPrompt = createDailyForecastPrompt(chartData, profile, currentDateStr, transits);
        const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');
        const { model: modelId } = await getOpenAIModelForContent({
          accessTier: 'free',
          contentSurface: 'forecast',
          contentVariant: 'daily',
        });

        const genStartTime = Date.now();
        const completion = await openai.chat.completions.create({
          model: modelId,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_ASTRA },
            { role: 'user', content: promptWithLang },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1200,
        });

        const genDuration = Date.now() - genStartTime;
        const responseText = completion.choices[0]?.message?.content || '{}';

        log.info('OpenAI response received', {
          durationMs: genDuration,
          tokensUsed: completion.usage?.total_tokens,
          model: modelId,
        });

        const forecast: DailyForecastAIResponse = JSON.parse(responseText);
        const moonLine =
          (typeof forecast.moonFocus === 'string' && forecast.moonFocus.trim()) ||
          (Array.isArray(forecast.advice) ? forecast.advice[0] : '') ||
          '';
        const transitLine =
          (typeof forecast.transitFocus === 'string' && forecast.transitFocus.trim()) ||
          (Array.isArray(forecast.advice) ? forecast.advice[1] : '') ||
          '';
        const adviceArr = Array.isArray(forecast.advice)
          ? forecast.advice.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
          : [];

        horoscope = {
          date: dateKey,
          mood: forecast.mood || (lang ? 'Вдохновленный' : 'Inspired'),
          color: forecast.color || 'Purple',
          number: forecast.number || 7,
          content: forecast.content || '',
          ...(adviceArr.length > 0 ? { advice: adviceArr } : {}),
          moonImpact: moonLine,
          transitFocus: transitLine,
        };
      }

      let persisted = false;
      if (hasDatabase) {
        try {
          await db.daily_natal_cards.setForPrimaryUser(effectiveUserId, dateKey, horoscope);
          persisted = true;
          log.info('Horoscope saved to DB', {
            chartId: primaryChartId,
            userId: effectiveUserId,
            dateKey,
            usesChartScope,
          });
        } catch (saveError: any) {
          log.error('Failed to save horoscope to DB', {
            error: saveError.message,
            chartId: primaryChartId,
            userId: effectiveUserId,
            dateKey,
            code: 'DAILY_PERSIST_FAILED',
          });
        }
      }

      releaseLock(lockKey);

      const totalDuration = Date.now() - startTime;
      log.info(`GENERATED: horoscope created (${totalDuration}ms)`, {
        userId: effectiveUserId,
        chartId: primaryChartId,
        dateKey,
        persisted,
      });

      const payload = withHoroscopeMeta(horoscope, persisted
        ? {
            persisted: true,
            source: 'generated',
          }
        : {
            persisted: false,
            source: 'generated-not-persisted',
            code: 'DAILY_PERSIST_FAILED',
            message: getErrorMessage(lang, 'DAILY_PERSIST_FAILED'),
          });

      res.setHeader('X-Horoscope-Source', payload.source);
      res.setHeader('X-Horoscope-Date', dateKey);
      res.setHeader('X-Horoscope-Persisted', String(payload.persisted));
      return res.status(200).json(payload);
    } catch (error) {
      releaseLock(lockKey);
      throw error;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    log.error(`Request failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack,
    });

    const lang = req.body?.profile?.language === 'ru';
    return sendDailyError(
      res,
      lang,
      500,
      'DAILY_CACHE_READ_FAILED',
      error.message
    );
  }
}
