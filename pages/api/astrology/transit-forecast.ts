import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createTransitForecastPrompt, addLanguageInstruction } from '../../../lib/prompts';
import { getOpenAIInterpretationModel } from '../../../lib/appSettings';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { getCurrentTransits, getTransitsForPeriod } from '../../../lib/transits-calculator';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/transit-forecast] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/transit-forecast] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * API endpoint для генерации прогнозов с учётом транзитов
 * 
 * Универсальный endpoint для day/week/month прогнозов
 * с реальным расчётом текущих транзитов планет
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, period } = req.body;
    const lang = profile?.language === 'ru';

    // Валидация
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

    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Period must be one of: day, week, month'
      });
    }
    if (period !== 'day') {
      const entitlement = await getPremiumEntitlementState(userId);
      if (!entitlement.isPremium) {
        return res.status(403).json({
          error: 'Premium required',
          code: 'PREMIUM_REQUIRED',
          premiumRequired: true,
          message: period === 'week'
            ? 'Weekly forecast is available in Lumia Premium.'
            : 'Monthly forecast is available in Lumia Premium.',
        });
      }
    }

    log.info('Transit forecast request received', {
      userId,
      period,
      language: lang ? 'ru' : 'en'
    });

    // Рассчитываем транзиты для нужного периода
    let transits: any;
    const today = new Date();

    if (period === 'day') {
      // Текущие транзиты на сегодня
      transits = await getCurrentTransits(today);
    } else if (period === 'week') {
      // Транзиты на неделю (сегодня + 7 дней)
      const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      transits = await getTransitsForPeriod(today, endDate);
    } else {
      // Транзиты на месяц (сегодня + 30 дней)
      const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      transits = await getTransitsForPeriod(today, endDate);
    }

    log.info('Transits calculated', {
      period,
      sunSign: transits.sun?.sign || transits.startTransits?.sun?.sign
    });

    // Проверяем наличие API ключа
    if (!openai) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackText = lang
        ? `# Прогноз на ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}\n\nСейчас Солнце в ${transits.sun?.sign || transits.startTransits?.sun?.sign}, что создаёт определённую энергию.\n\nРекомендации:\n- Прислушивайся к своей интуиции\n- Будь открыт новым возможностям\n- Заботься о себе`
        : `# Forecast for ${period}\n\nThe Sun is currently in ${transits.sun?.sign || transits.startTransits?.sun?.sign}.\n\nRecommendations:\n- Listen to your intuition\n- Be open to new opportunities\n- Take care of yourself`;
      return res.status(200).json({ forecast: fallbackText });
    }

    // Создаём промпт с транзитами
    const userPrompt = createTransitForecastPrompt(
      chartData,
      profile,
      transits,
      period as 'day' | 'week' | 'month'
    );
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    const modelId = await getOpenAIInterpretationModel();
    log.info('Sending request to OpenAI', {
      model: modelId,
      promptLength: promptWithLang.length
    });

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      temperature: 0.75,
      max_tokens: period === 'day' ? 1000 : period === 'week' ? 1500 : 2000,
    });

    const duration = Date.now() - startTime;
    const forecast = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      forecastLength: forecast.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return res.status(200).json({ forecast });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }

    log.error('Error in transit forecast handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки
    const { period, profile } = req.body;
    const lang = profile?.language === 'ru';
    
    const fallbackText = lang
      ? `# Прогноз на ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}\n\nСейчас звёзды создают особую энергию. Будь внимателен к знакам вокруг.\n\nРекомендации:\n- Прислушивайся к своей интуиции\n- Будь открыт новым возможностям\n- Заботься о себе`
      : `# Forecast for ${period}\n\nThe stars are creating special energy now. Be attentive to signs around you.\n\nRecommendations:\n- Listen to your intuition\n- Be open to new opportunities\n- Take care of yourself`;

    return res.status(200).json({ forecast: fallbackText });
  }
}
