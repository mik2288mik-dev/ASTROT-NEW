import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createMonthlyForecastPrompt, addLanguageInstruction, MonthlyForecastAIResponse } from '../../../lib/prompts';
import { CACHE_CONFIGS } from '../../../lib/cache';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/monthly-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/monthly-horoscope] ERROR: ${message}`, error || '');
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
    const { profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const month = new Date().toLocaleString(lang ? 'ru' : 'en', { month: 'long' });

    if (!profile || !chartData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and chartData are required'
      });
    }

    log.info('Monthly horoscope request received', {
      userId: profile.id,
      month,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackHoroscope = {
        month,
        theme: lang ? 'Трансформация' : 'Transformation',
        focus: lang ? 'Личностный рост и развитие' : 'Personal growth and development',
        content: lang
          ? `Этот месяц ${month} принесет важные изменения в вашей жизни.`
          : `This ${month} will bring important changes to your life.`
      };
      return res.status(200).json(fallbackHoroscope);
    }

    // Создаём промпт
    const userPrompt = createMonthlyForecastPrompt(chartData, profile, month);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI (используем gpt-4o для более глубокого месячного прогноза)
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 1500,
    });

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let forecast: MonthlyForecastAIResponse;
    try {
      forecast = JSON.parse(responseText);
      
      const horoscope = {
        month,
        theme: forecast.theme || (lang ? 'Новый месяц' : 'New Month'),
        focus: forecast.focus || '',
        content: forecast.content || ''
      };
      
      // Ежемесячный гороскоп кэшируется на месяц
      const cacheConfig = CACHE_CONFIGS.monthlyHoroscope;
      res.setHeader('Cache-Control', `public, s-maxage=${cacheConfig.revalidate}, stale-while-revalidate=86400`);
      res.setHeader('CDN-Cache-Control', `public, s-maxage=${cacheConfig.revalidate}`);
      
      return res.status(200).json(horoscope);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      throw new Error('Invalid JSON response from AI');
    }
  } catch (error: any) {
    log.error('Error getting monthly horoscope', {
      error: error.message,
      stack: error.stack
    });

    // Fallback на случай ошибки
    const { profile } = req.body;
    const lang = profile?.language === 'ru';
    const month = new Date().toLocaleString(lang ? 'ru' : 'en', { month: 'long' });
    
    const fallbackHoroscope = {
      month,
      theme: lang ? 'Трансформация' : 'Transformation',
      focus: lang ? 'Личностный рост и развитие' : 'Personal growth and development',
      content: lang
        ? `Этот месяц ${month} принесет важные изменения в вашей жизни.`
        : `This ${month} will bring important changes to your life.`
    };
    
    return res.status(200).json(fallbackHoroscope);
  }
}
