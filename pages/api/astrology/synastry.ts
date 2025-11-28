import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { SYSTEM_PROMPT_ASTRA, createSynastryPrompt, addLanguageInstruction, SynastryAIResponse } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry] ERROR: ${message}`, error || '');
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
    const { profile, partnerName, partnerDate, language } = req.body;

    if (!profile || !partnerName || !partnerDate) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile, partnerName, and partnerDate are required'
      });
    }

    log.info('Calculating synastry', {
      userId: profile?.id,
      partnerName,
      partnerDate,
      language
    });

    const lang = language === 'ru';

    // Получаем натальную карту пользователя из профиля или вычисляем
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
        moon: { planet: 'Moon', sign: 'Cancer', degree: 10, description: '' }
      };
    }

    // Вычисляем натальную карту партнёра
    let partnerChartData;
    try {
      // Для партнёра используем упрощённые данные (только дата, без времени и места)
      // Это ограничение, но для базовой совместимости достаточно
      partnerChartData = await calculateNatalChart(
        partnerName,
        partnerDate,
        '12:00', // Используем полдень по умолчанию
        profile.birthPlace // Используем место пользователя как приближение
      );
    } catch (error: any) {
      log.error('Failed to calculate partner natal chart', { error: error.message });
      // Используем fallback данные
      partnerChartData = {
        sun: { planet: 'Sun', sign: 'Aries', degree: 20, description: '' },
        moon: { planet: 'Moon', sign: 'Pisces', degree: 5, description: '' }
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
        compatibilityScore: Math.floor(Math.random() * 40) + 60,
        emotionalConnection: lang 
          ? 'Глубокая эмоциональная связь между вами.'
          : 'Deep emotional connection between you.',
        intellectualConnection: lang
          ? 'Интеллектуальное взаимопонимание и общие интересы.'
          : 'Intellectual understanding and shared interests.',
        challenge: lang
          ? 'Основной вызов - найти баланс между независимостью и близостью.'
          : 'Main challenge - finding balance between independence and closeness.',
        summary: lang
          ? `Синастрия между ${profile?.name} и ${partnerName} показывает интересную динамику.`
          : `Synastry between ${profile?.name} and ${partnerName} shows interesting dynamics.`
      };
      return res.status(200).json(fallbackResult);
    }

    // Создаём промпт для AI
    const userPrompt = createSynastryPrompt(userChartData, profile, partnerChartData, partnerName);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI (используем gpt-4o для более точного анализа)
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let synastry: SynastryAIResponse;
    try {
      synastry = JSON.parse(responseText);
      
      log.info('Synastry calculated successfully', {
        compatibilityScore: synastry.compatibilityScore
      });

      return res.status(200).json(synastry);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      throw new Error('Invalid JSON response from AI');
    }
  } catch (error: any) {
    log.error('Error calculating synastry', {
      error: error.message,
      stack: error.stack
    });

    // Fallback на случай ошибки
    const { profile, partnerName, language } = req.body;
    const lang = language === 'ru';
    
    const fallbackResult = {
      compatibilityScore: Math.floor(Math.random() * 40) + 60,
      emotionalConnection: lang 
        ? 'Глубокая эмоциональная связь между вами.'
        : 'Deep emotional connection between you.',
      intellectualConnection: lang
        ? 'Интеллектуальное взаимопонимание и общие интересы.'
        : 'Intellectual understanding and shared interests.',
      challenge: lang
        ? 'Основной вызов - найти баланс между независимостью и близостью.'
        : 'Main challenge - finding balance between independence and closeness.',
      summary: lang
        ? `Синастрия между ${profile?.name} и ${partnerName} показывает интересную динамику.`
        : `Synastry between ${profile?.name} and ${partnerName} shows interesting dynamics.`
    };

    return res.status(200).json(fallbackResult);
  }
}
