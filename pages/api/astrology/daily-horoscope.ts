import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createDailyForecastPrompt, addLanguageInstruction, DailyForecastAIResponse } from '../../../lib/prompts';
import { db } from '../../../lib/db';
import { getCurrentTransits } from '../../../lib/transits-calculator';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';

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

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildFallbackHoroscope(lang: boolean, dateKey: string) {
  return {
    date: dateKey,
    mood: lang ? 'Вдохновлённый' : 'Inspired',
    color: 'Purple',
    number: 7,
    content: lang
      ? 'Сегодня звёзды благоприятствуют новым начинаниям.'
      : 'Today the stars favor new beginnings.',
    moonImpact: lang ? 'Луна усиливает интуицию.' : 'Moon enhances intuition.',
    transitFocus: lang ? 'Меркурий способствует общению.' : 'Mercury favors communication.',
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const dateKey = getTodayKey();

  try {
    const { userId, profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const hasDatabase = !!process.env.DATABASE_URL;

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
    if (hasDatabase) {
      const primaryChart = await db.natal_charts.getPrimary(effectiveUserId);
      if (!primaryChart) {
        return res.status(409).json({
          error: 'Primary chart missing',
          message: lang
            ? 'Для гороскопа не найдена основная карта. Откройте приложение ещё раз или пересоздайте карту.'
            : 'Primary chart was not found for this horoscope. Please reopen the app or recreate the chart.',
        });
      }
      primaryChartId = primaryChart.id;
    }

    if (primaryChartId != null) {
      const existingContent = await db.daily_natal_cards.getByChart(primaryChartId, dateKey);
      if (existingContent) {
        const duration = Date.now() - startTime;
        log.info(`DB_HIT: returning cached horoscope (${duration}ms)`, {
          userId: effectiveUserId,
          chartId: primaryChartId,
          dateKey,
          zodiacSign,
        });

        res.setHeader('X-Horoscope-Source', 'cache');
        res.setHeader('X-Horoscope-Date', dateKey);
        return res.status(200).json(existingContent);
      }
    }

    log.info(`DB_MISS: no horoscope for date=${dateKey}, will generate`);

    const lockKey = LockKeys.dailyHoroscope(effectiveUserId, dateKey);
    if (!tryAcquireLock(lockKey, 'daily-horoscope-generation')) {
      log.info('LOCK_DENIED: generation already in progress');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (primaryChartId != null) {
        const afterWait = await db.daily_natal_cards.getByChart(primaryChartId, dateKey);
        if (afterWait) {
          res.setHeader('X-Horoscope-Source', 'cache-after-wait');
          res.setHeader('X-Horoscope-Date', dateKey);
          return res.status(200).json(afterWait);
        }
      }

      return res.status(409).json({
        error: 'Generation in progress',
        message: lang ? 'Гороскоп генерируется. Подождите.' : 'Horoscope is being generated. Please wait.',
      });
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

        const genStartTime = Date.now();
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_ASTRA },
            { role: 'user', content: promptWithLang },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1000,
        });

        const genDuration = Date.now() - genStartTime;
        const responseText = completion.choices[0]?.message?.content || '{}';

        log.info('OpenAI response received', {
          durationMs: genDuration,
          tokensUsed: completion.usage?.total_tokens,
        });

        const forecast: DailyForecastAIResponse = JSON.parse(responseText);
        horoscope = {
          date: dateKey,
          mood: forecast.mood || (lang ? 'Вдохновлённый' : 'Inspired'),
          color: forecast.color || 'Purple',
          number: forecast.number || 7,
          content: forecast.content || '',
          moonImpact: forecast.advice?.[0] || '',
          transitFocus: forecast.advice?.[1] || '',
        };
      }

      if (primaryChartId != null) {
        try {
          await db.daily_natal_cards.setByChart(primaryChartId, dateKey, horoscope);
          log.info('Horoscope saved to DB', { chartId: primaryChartId });
        } catch (saveError: any) {
          log.error('Failed to save horoscope to DB', {
            error: saveError.message,
            chartId: primaryChartId,
            userId: effectiveUserId,
          });
          throw new Error(`HOROSCOPE_PERSIST_FAILED:${saveError.message}`);
        }
      }

      releaseLock(lockKey);

      const totalDuration = Date.now() - startTime;
      log.info(`GENERATED: horoscope created (${totalDuration}ms)`, {
        userId: effectiveUserId,
        chartId: primaryChartId,
        dateKey,
      });

      res.setHeader('X-Horoscope-Source', 'generated');
      res.setHeader('X-Horoscope-Date', dateKey);
      return res.status(200).json(horoscope);
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
    const message = error.message?.startsWith('HOROSCOPE_PERSIST_FAILED:')
      ? (lang
          ? 'Гороскоп сгенерирован, но не сохранился в базе. Повторите попытку.'
          : 'The horoscope was generated but could not be saved. Please try again.')
      : (lang
          ? 'Не удалось получить гороскоп. Попробуйте позже.'
          : 'Failed to get horoscope. Please try again later.');

    return res.status(500).json({
      error: 'Horoscope generation failed',
      message,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
