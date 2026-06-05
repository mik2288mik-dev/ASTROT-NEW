import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createWeeklyForecastPrompt, addLanguageInstruction, WeeklyForecastAIResponse } from '../../../lib/prompts';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { CACHE_CONFIGS } from '../../../lib/cache';

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
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('X-Lumia-Legacy-Endpoint', 'weekly-horoscope');
  res.setHeader('Warning', '299 - "Deprecated: prefer /api/content/forecast/weekly"');

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
    const userId = String(profile.id || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'Bad request', message: 'User id is required' });
    }
    requireTelegramUserId(req, userId);
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
        message: lang
          ? 'Weekly forecast is available in Lumia Premium.'
          : 'The weekly forecast is available in Lumia Premium.',
      });
    }

    log.info('Weekly horoscope request received', {
      userId,
      weekRange,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем наличие API ключа
    if (!openai) {
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

    const { model: modelId } = await getOpenAIModelForContent({
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: 'weekly',
    });
    log.info('Sending request to OpenAI', {
      model: modelId,
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: modelId,
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
      
      // Еженедельный гороскоп кэшируется на неделю
      const cacheConfig = CACHE_CONFIGS.weeklyHoroscope;
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
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }

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
