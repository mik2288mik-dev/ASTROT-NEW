import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { SYSTEM_PROMPT_ASTRA, createBriefSynastryPrompt, addLanguageInstruction, BriefSynastryAIResponse } from '../../../lib/prompts';
import { validateSynastryInput, formatValidationErrors } from '../../../lib/validation';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry-brief] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry-brief] ERROR: ${message}`, error || '');
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
  log.info('Request received', {
    method: req.method,
    path: req.url
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, partnerName, partnerDate, partnerTime, partnerPlace, language, relationshipType } = req.body;

    // Строгая валидация входных данных
    const validation = validateSynastryInput({
      profile,
      partnerName,
      partnerDate,
      partnerTime,
      partnerPlace,
      language: language || profile?.language || 'ru'
    });

    if (!validation.isValid) {
      const userLanguage = (language || profile?.language || 'ru') === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);
      
      log.error('Validation failed', {
        errors: validation.errors,
        userLanguage
      });
      
      return res.status(400).json({ 
        error: 'Validation failed',
        message: errorMessage,
        errors: validation.errors
      });
    }

    log.info('Calculating brief synastry', {
      userId: profile?.id,
      partnerName,
      partnerDate,
      language,
      relationshipType
    });

    const lang = language === 'ru';

    // Получаем натальную карту пользователя
    let userChartData;
    try {
      userChartData = await calculateNatalChart(
        profile.name,
        profile.birthDate,
        profile.birthTime || '12:00',
        profile.birthPlace
      );
    } catch (error: any) {
      log.error('Failed to calculate user natal chart', { error: error.message });
      // Используем fallback данные
      userChartData = {
        sun: { planet: 'Sun', sign: 'Leo', degree: 15, description: '' },
        moon: { planet: 'Moon', sign: 'Cancer', degree: 10, description: '' },
        rising: { planet: 'Ascendant', sign: 'Aries', degree: 0, description: '' },
        mercury: null,
        venus: null,
        mars: null,
        element: 'Fire',
        rulingPlanet: 'Sun',
        summary: ''
      };
    }

    // Вычисляем натальную карту партнёра
    let partnerChartData;
    try {
      partnerChartData = await calculateNatalChart(
        partnerName,
        partnerDate,
        partnerTime || '12:00',
        partnerPlace || profile.birthPlace
      );
    } catch (error: any) {
      log.error('Failed to calculate partner natal chart', { error: error.message });
      // Используем fallback данные
      partnerChartData = {
        sun: { planet: 'Sun', sign: 'Aries', degree: 20, description: '' },
        moon: { planet: 'Moon', sign: 'Pisces', degree: 5, description: '' },
        rising: { planet: 'Ascendant', sign: 'Aries', degree: 0, description: '' },
        mercury: null,
        venus: null,
        mars: null,
        element: 'Fire',
        rulingPlanet: 'Mars',
        summary: ''
      };
    }

    log.info('Both natal charts calculated', {
      userSun: userChartData.sun?.sign,
      partnerSun: partnerChartData.sun?.sign
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackResult = {
        briefOverview: {
          introduction: lang 
            ? `${profile?.name} и ${partnerName} создают интересную динамику в отношениях. Каждый привносит свои уникальные качества.`
            : `${profile?.name} and ${partnerName} create interesting dynamics. Each brings unique qualities.`,
          harmony: lang
            ? 'В этой связи есть естественное понимание друг друга. Вы оба цените искренность и открытость.'
            : 'There is natural understanding in this connection. You both value honesty and openness.',
          challenges: lang
            ? 'Иногда может возникать недопонимание из-за разных темпераментов. Важно давать друг другу пространство.'
            : 'Sometimes misunderstandings may arise due to different temperaments. It\'s important to give each other space.',
          tips: lang
            ? [
                'Слушайте друг друга внимательно',
                'Цените различия как возможность для роста',
                'Находите компромиссы в спорных вопросах',
                'Поддерживайте открытую коммуникацию'
              ]
            : [
                'Listen to each other attentively',
                'Value differences as opportunities for growth',
                'Find compromises in disputed matters',
                'Maintain open communication'
              ]
        },
        summary: lang
          ? `Краткий обзор совместимости между ${profile?.name} и ${partnerName}.`
          : `Brief compatibility overview between ${profile?.name} and ${partnerName}.`
      };
      return res.status(200).json(fallbackResult);
    }

    // Создаём промпт для AI
    const userPrompt = createBriefSynastryPrompt(
      userChartData, 
      profile, 
      partnerChartData, 
      partnerName,
      relationshipType || 'романтика'
    );
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    let briefSynastry: BriefSynastryAIResponse;
    try {
      briefSynastry = JSON.parse(responseText);
      
      log.info('Brief synastry calculated successfully');

      const result = {
        briefOverview: briefSynastry,
        summary: briefSynastry.introduction
      };

      return res.status(200).json(result);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      
      const userLanguage = (language || profile?.language || 'ru') === 'en' ? 'en' : 'ru';
      const errorMessage = userLanguage === 'ru'
        ? 'Не удалось обработать ответ от AI. Пожалуйста, попробуйте позже.'
        : 'Failed to process AI response. Please try again later.';
      
      return res.status(500).json({ 
        error: 'AI response parsing failed',
        message: errorMessage
      });
    }
  } catch (error: any) {
    log.error('Error calculating brief synastry', {
      error: error.message,
      stack: error.stack
    });

    const userLanguage = (req.body.language || req.body.profile?.language || 'ru') === 'en' ? 'en' : 'ru';
    const errorMessage = userLanguage === 'ru'
      ? 'Не удалось рассчитать совместимость. Пожалуйста, проверьте данные и попробуйте снова.'
      : 'Failed to calculate compatibility. Please check your data and try again.';
    
    return res.status(500).json({ 
      error: 'Synastry calculation failed',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
