import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createDailyForecastPrompt, addLanguageInstruction, DailyForecastAIResponse } from '../../../lib/prompts';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { getSecondsUntilNextUpdate, CACHE_CONFIGS } from '../../../lib/cache';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/daily-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/daily-horoscope] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, context } = req.body;
    const lang = profile?.language === 'ru';
    // Всегда используем сегодняшнюю дату
    const today = new Date().toISOString().split('T')[0];

    // Валидация входных данных
    if (!profile || !chartData) {
      const errorMessage = lang
        ? 'Профиль и данные карты обязательны для расчета гороскопа'
        : 'Profile and chart data are required for horoscope calculation';
      
      return res.status(400).json({ 
        error: 'Bad request',
        message: errorMessage
      });
    }

    // Валидация структуры профиля
    if (!profile.name || !profile.birthDate || !profile.birthPlace) {
      const validation = validateNatalChartInput({
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        birthPlace: profile.birthPlace,
        language: profile.language || 'ru'
      });

      if (!validation.isValid) {
        const errorMessage = formatValidationErrors(validation.errors, lang ? 'ru' : 'en');
        return res.status(400).json({ 
          error: 'Invalid profile data',
          message: errorMessage,
          errors: validation.errors
        });
      }
    }

    log.info('Daily horoscope request received', {
      userId: profile.id,
      date: today,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем кэш БД за пользователем (персональный гороскоп)
    const userId = profile.id;
    if (userId) {
      try {
        // Загружаем профиль пользователя из БД для проверки кэша
        const dbUser = await db.users.get(userId);
        if (dbUser && dbUser.generated_content) {
          const cachedHoroscope = dbUser.generated_content.dailyHoroscope;
          const cachedDate = cachedHoroscope?.date;
          const cachedTimestamp = dbUser.generated_content.timestamps?.dailyHoroscopeGenerated;
          
          // Проверяем, есть ли гороскоп за сегодня
          if (cachedHoroscope && cachedDate === today) {
            // Проверяем время генерации - гороскоп должен быть сгенерирован после 00:01 МСК сегодня
            const now = new Date();
            const moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
            const todayStart = new Date(moscowTime);
            todayStart.setHours(0, 1, 0, 0); // 00:01 МСК сегодня
            todayStart.setMinutes(0);
            todayStart.setSeconds(0);
            todayStart.setMilliseconds(0);
            
            // Конвертируем в UTC для сравнения с timestamp
            const todayStartUTC = new Date(todayStart.getTime() - (3 * 60 * 60 * 1000));
            
            // Если гороскоп был сгенерирован после 00:01 сегодня (МСК) - используем его
            if (cachedTimestamp && cachedTimestamp >= todayStartUTC.getTime()) {
              log.info(`Using cached daily horoscope from DB for user ${userId} on ${today}`, {
                cachedTimestamp: new Date(cachedTimestamp).toISOString(),
                todayStartUTC: todayStartUTC.toISOString()
              });
              // Устанавливаем заголовки кэширования
              const cacheSeconds = getSecondsUntilNextUpdate();
              res.setHeader('Cache-Control', `private, s-maxage=${cacheSeconds}, stale-while-revalidate=3600`);
              res.setHeader('CDN-Cache-Control', `private, s-maxage=${cacheSeconds}`);
              res.setHeader('Vercel-CDN-Cache-Control', `private, s-maxage=${cacheSeconds}`);
              return res.status(200).json(cachedHoroscope);
            } else {
              log.info(`Cached horoscope found but generated before 00:01 today, will generate new`, {
                cachedTimestamp: cachedTimestamp ? new Date(cachedTimestamp).toISOString() : 'null',
                todayStartUTC: todayStartUTC.toISOString()
              });
            }
          } else if (cachedHoroscope && cachedDate) {
            log.info(`Cached horoscope found but outdated: ${cachedDate} vs ${today}, will generate new`);
          }
        }
      } catch (cacheError) {
        log.error('Error checking user cache in DB, will generate new horoscope', cacheError);
        // Продолжаем генерацию если кэш недоступен
      }
    }

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      // Всегда используем сегодняшнюю дату
      const currentDate = new Date().toISOString().split('T')[0];
      const fallbackHoroscope = {
        date: currentDate, // Всегда актуальная дата
        mood: lang ? 'Вдохновленный' : 'Inspired',
        color: 'Purple',
        number: 7,
        content: lang
          ? 'Сегодня звезды благоприятствуют новым начинаниям.'
          : 'Today the stars favor new beginnings.',
        moonImpact: lang
          ? 'Луна в вашем знаке усиливает интуицию.'
          : 'Moon in your sign enhances intuition.',
        transitFocus: lang
          ? 'Меркурий способствует общению.'
          : 'Mercury favors communication.'
      };
      return res.status(200).json(fallbackHoroscope);
    }

    // Создаём промпт
    const currentDate = new Date().toLocaleDateString(lang ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const userPrompt = createDailyForecastPrompt(chartData, profile, currentDate);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o-mini',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI
    const startTime = Date.now();
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

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let forecast: DailyForecastAIResponse;
    try {
      forecast = JSON.parse(responseText);
      
      // Всегда используем сегодняшнюю дату для гороскопа
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Добавляем дату и дополнительные поля
      const horoscope = {
        date: currentDate, // Всегда актуальная дата
        mood: forecast.mood || (lang ? 'Вдохновлённый' : 'Inspired'),
        color: forecast.color || 'Purple',
        number: forecast.number || 7,
        content: forecast.content || '',
        moonImpact: forecast.advice?.[0] || '',
        transitFocus: forecast.advice?.[1] || ''
      };
      
      // Сохраняем гороскоп за пользователем в БД (персональный кэш)
      if (userId) {
        try {
          // Загружаем текущий профиль пользователя
          const dbUser = await db.users.get(userId);
          const currentGeneratedContent = dbUser?.generated_content || {};
          
          // Обновляем гороскоп и timestamp
          const updatedGeneratedContent = {
            ...currentGeneratedContent,
            dailyHoroscope: horoscope,
            timestamps: {
              ...currentGeneratedContent.timestamps,
              dailyHoroscopeGenerated: Date.now()
            }
          };
          
          // Сохраняем обновленный профиль
          await db.users.set(userId, {
            ...dbUser,
            generated_content: updatedGeneratedContent
          });
          
          log.info(`Daily horoscope cached in DB for user ${userId} on ${today}`);
        } catch (cacheError) {
          log.error('Failed to cache horoscope in user DB', cacheError);
          // Продолжаем выполнение даже если кэширование не удалось
        }
      }
      
      // Устанавливаем заголовки кэширования для ежедневного гороскопа
      // Гороскоп обновляется раз в день в 00:01 МСК
      const cacheSeconds = getSecondsUntilNextUpdate();
      res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=3600`);
      res.setHeader('CDN-Cache-Control', `public, s-maxage=${cacheSeconds}`);
      res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${cacheSeconds}`);
      
      return res.status(200).json(horoscope);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      
      const lang = profile?.language === 'ru';
      const errorMessage = lang
        ? 'Не удалось обработать ответ от AI. Пожалуйста, попробуйте позже.'
        : 'Failed to process AI response. Please try again later.';
      
      return res.status(500).json({ 
        error: 'AI response parsing failed',
        message: errorMessage
      });
    }
  } catch (error: any) {
    log.error('Error getting daily horoscope', {
      error: error.message,
      stack: error.stack
    });

    const { profile } = req.body;
    const lang = profile?.language === 'ru';
    const today = new Date().toISOString().split('T')[0];
    
    // Возвращаем понятную ошибку вместо fallback
    const errorMessage = lang
      ? 'Не удалось получить гороскоп. Пожалуйста, попробуйте позже.'
      : 'Failed to get horoscope. Please try again later.';
    
    return res.status(500).json({ 
      error: 'Horoscope generation failed',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
