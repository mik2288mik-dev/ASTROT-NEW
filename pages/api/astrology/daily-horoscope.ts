import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createDailyForecastPrompt, addLanguageInstruction, DailyForecastAIResponse } from '../../../lib/prompts';
import { db } from '../../../lib/db';
import { getCurrentTransits } from '../../../lib/transits-calculator';
import { tryAcquireLock, releaseLock, LockKeys } from '../../../lib/serverLocks';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/daily-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/daily-horoscope] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

/**
 * Получить ключ даты в формате YYYY-MM-DD
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * API для ежедневного гороскопа
 * 
 * Логика:
 * 1. Проверяем БД на наличие гороскопа за сегодня для userId
 * 2. Если есть - возвращаем (DB_HIT)
 * 3. Если нет - генерируем, сохраняем, возвращаем (GENERATED)
 * 
 * Гороскоп генерируется ОДИН РАЗ В СУТКИ на пользователя
 */
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

    // Валидация
    if (!userId || !profile || !chartData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'userId, profile and chartData are required'
      });
    }

    const zodiacSign = chartData?.sun?.sign;
    if (!zodiacSign) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'chartData must contain sun.sign'
      });
    }

    log.info(`=== REQUEST START === userId=${userId}, date=${dateKey}, sign=${zodiacSign}`);

    // ШАГ 1: Проверяем БД
    const existing = await db.dailyHoroscope.get(userId, dateKey);
    
    if (existing && existing.content) {
      const duration = Date.now() - startTime;
      log.info(`DB_HIT: returning cached horoscope (${duration}ms)`, {
        userId,
        dateKey,
        zodiacSign
      });

      res.setHeader('X-Horoscope-Source', 'cache');
      res.setHeader('X-Horoscope-Date', dateKey);
      
      return res.status(200).json(existing.content);
    }

    log.info(`DB_MISS: no horoscope for date=${dateKey}, will generate`);

    // ШАГ 2: Защита от двойных вызовов
    const lockKey = LockKeys.dailyHoroscope(userId, dateKey);
    
    if (!tryAcquireLock(lockKey, 'daily-horoscope-generation')) {
      log.info(`LOCK_DENIED: generation already in progress`);
      
      // Ждём и пробуем взять из БД
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const afterWait = await db.dailyHoroscope.get(userId, dateKey);
      if (afterWait && afterWait.content) {
        res.setHeader('X-Horoscope-Source', 'cache-after-wait');
        return res.status(200).json(afterWait.content);
      }
      
      return res.status(409).json({
        error: 'Generation in progress',
        message: lang ? 'Гороскоп генерируется. Подождите.' : 'Horoscope is being generated. Please wait.'
      });
    }

    try {
      // ШАГ 3: Проверяем OpenAI
      if (!openai) {
        log.error('OpenAI API key not configured');
        releaseLock(lockKey);
        
        // Fallback гороскоп
        const fallback = {
          date: dateKey,
          mood: lang ? 'Вдохновленный' : 'Inspired',
          color: 'Purple',
          number: 7,
          content: lang
            ? 'Сегодня звезды благоприятствуют новым начинаниям.'
            : 'Today the stars favor new beginnings.',
          moonImpact: lang ? 'Луна усиливает интуицию.' : 'Moon enhances intuition.',
          transitFocus: lang ? 'Меркурий способствует общению.' : 'Mercury favors communication.'
        };
        
        return res.status(200).json(fallback);
      }

      // ШАГ 4: Получаем транзиты
      let transits = null;
      try {
        transits = await getCurrentTransits();
        log.info('Transits calculated', { sunSign: transits?.sun?.sign });
      } catch (error) {
        log.error('Failed to calculate transits', error);
      }

      // ШАГ 5: Генерируем гороскоп
      log.info('GENERATING: calling OpenAI');
      
      const currentDateStr = new Date().toLocaleDateString(lang ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const userPrompt = createDailyForecastPrompt(chartData, profile, currentDateStr, transits);
      const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

      const genStartTime = Date.now();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_ASTRA },
          { role: 'user', content: promptWithLang }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const genDuration = Date.now() - genStartTime;
      const responseText = completion.choices[0]?.message?.content || '{}';

      log.info('OpenAI response received', {
        durationMs: genDuration,
        tokensUsed: completion.usage?.total_tokens
      });

      // ШАГ 6: Парсим и форматируем ответ
      const forecast: DailyForecastAIResponse = JSON.parse(responseText);
      
      const horoscope = {
        date: dateKey,
        mood: forecast.mood || (lang ? 'Вдохновлённый' : 'Inspired'),
        color: forecast.color || 'Purple',
        number: forecast.number || 7,
        content: forecast.content || '',
        moonImpact: forecast.advice?.[0] || '',
        transitFocus: forecast.advice?.[1] || ''
      };

      // ШАГ 7: Сохраняем в БД
      await db.dailyHoroscope.set(userId, dateKey, horoscope, zodiacSign);
      
      releaseLock(lockKey);

      const totalDuration = Date.now() - startTime;
      log.info(`GENERATED & SAVED: horoscope created (${totalDuration}ms)`, {
        userId,
        dateKey,
        genDuration
      });

      res.setHeader('X-Horoscope-Source', 'generated');
      res.setHeader('X-Horoscope-Date', dateKey);
      res.setHeader('X-Generation-Time', genDuration.toString());
      
      return res.status(200).json(horoscope);

    } catch (error) {
      releaseLock(lockKey);
      throw error;
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log.error(`Request failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack
    });

    const lang = req.body?.profile?.language === 'ru';
    
    return res.status(500).json({ 
      error: 'Horoscope generation failed',
      message: lang 
        ? 'Не удалось получить гороскоп. Попробуйте позже.'
        : 'Failed to get horoscope. Please try again later.'
    });
  }
}
