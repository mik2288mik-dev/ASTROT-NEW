import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createWeeklyForecastPrompt, addLanguageInstruction, WeeklyForecastAIResponse } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/weekly-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/weekly-horoscope] ERROR: ${message}`, error || '');
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
    
    const weekStart = new Date();
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const weekRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

    if (!profile || !chartData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and chartData are required'
      });
    }

    log.info('Weekly horoscope request received', {
      userId: profile.id,
      weekRange,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackHoroscope = {
        weekRange,
        theme: lang ? 'Новые возможности' : 'New Opportunities',
        advice: lang ? 'Эта неделя принесет важные изменения.' : 'This week will bring important changes.',
        love: lang ? 'В отношениях наступит период гармонии.' : 'A period of harmony in relationships.',
        career: lang ? 'Профессиональный рост ожидается.' : 'Professional growth is expected.'
      };
      return res.status(200).json(fallbackHoroscope);
    }

    // Создаём промпт
    const userPrompt = createWeeklyForecastPrompt(chartData, profile, weekRange);
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
      max_tokens: 1200,
    });

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let forecast: WeeklyForecastAIResponse;
    try {
      forecast = JSON.parse(responseText);
      
      const horoscope = {
        weekRange,
        theme: forecast.theme || (lang ? 'Новая неделя' : 'New Week'),
        advice: forecast.advice || '',
        love: forecast.love || '',
        career: forecast.career || ''
      };
      
      return res.status(200).json(horoscope);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      throw new Error('Invalid JSON response from AI');
    }
  } catch (error: any) {
    log.error('Error getting weekly horoscope', {
      error: error.message,
      stack: error.stack
    });

    // Fallback на случай ошибки
    const { profile } = req.body;
    const lang = profile?.language === 'ru';
    const weekStart = new Date();
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const weekRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    
    const fallbackHoroscope = {
      weekRange,
      theme: lang ? 'Новые возможности' : 'New Opportunities',
      advice: lang ? 'Эта неделя принесет важные изменения.' : 'This week will bring important changes.',
      love: lang ? 'В отношениях наступит период гармонии.' : 'A period of harmony in relationships.',
      career: lang ? 'Профессиональный рост ожидается.' : 'Professional growth is expected.'
    };
    
    return res.status(200).json(fallbackHoroscope);
  }
}
