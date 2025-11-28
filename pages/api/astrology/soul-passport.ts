import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createSoulPassportPrompt, addLanguageInstruction } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/soul-passport] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/soul-passport] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint для генерации "паспорта души" - краткого общего описания человека
 * на основе его натальной карты
 */
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

    if (!profile || !chartData || !chartData.sun || !chartData.moon) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and valid chartData are required'
      });
    }

    log.info('Soul passport request received', {
      userId: profile.id,
      name: profile.name,
      language: lang ? 'ru' : 'en',
      sunSign: chartData.sun.sign,
      moonSign: chartData.moon.sign
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackText = lang
        ? `${profile.name}, твоя карта показывает уникальное сочетание энергий. Солнце в ${chartData.sun.sign} и Луна в ${chartData.moon.sign} создают интересную картину твоей личности.`
        : `${profile.name}, your chart shows a unique combination of energies. Sun in ${chartData.sun.sign} and Moon in ${chartData.moon.sign} create an interesting picture of your personality.`;
      return res.status(200).json({ soulPassport: fallbackText });
    }

    // Создаём промпт
    const userPrompt = createSoulPassportPrompt(chartData, profile);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI (используем gpt-4o для более качественных текстов)
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      temperature: 0.8, // Чуть выше для более творческого текста
      max_tokens: 1500,
    });

    const duration = Date.now() - startTime;
    const soulPassport = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      textLength: soulPassport.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return res.status(200).json({ soulPassport });
  } catch (error: any) {
    log.error('Error in soul passport handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки OpenAI
    const { profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const fallbackText = lang
      ? `${profile?.name}, твоя карта показывает уникальное сочетание энергий. Солнце в ${chartData?.sun?.sign} и Луна в ${chartData?.moon?.sign} создают интересную картину твоей личности.`
      : `${profile?.name}, your chart shows a unique combination of energies. Sun in ${chartData?.sun?.sign} and Moon in ${chartData?.moon?.sign} create an interesting picture of your personality.`;

    return res.status(200).json({ soulPassport: fallbackText });
  }
}
