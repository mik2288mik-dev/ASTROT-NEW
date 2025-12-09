import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createDailyForecastPrompt, addLanguageInstruction, DailyForecastAIResponse } from '../../../lib/prompts';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';
import { getSecondsUntilNextUpdate, CACHE_CONFIGS } from '../../../lib/cache';

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

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackHoroscope = {
        date: today,
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
      
      // Добавляем дату и дополнительные поля
      const horoscope = {
        date: today,
        mood: forecast.mood || (lang ? 'Вдохновлённый' : 'Inspired'),
        color: forecast.color || 'Purple',
        number: forecast.number || 7,
        content: forecast.content || '',
        moonImpact: forecast.advice?.[0] || '',
        transitFocus: forecast.advice?.[1] || ''
      };
      
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
