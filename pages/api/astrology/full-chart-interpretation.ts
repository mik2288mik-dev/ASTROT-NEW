import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createFullNatalChartPrompt, addLanguageInstruction } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/full-chart-interpretation] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/full-chart-interpretation] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint для генерации полной интерпретации натальной карты по блокам
 * 
 * Используется когда пользователь нажимает "Узнать больше" и хочет получить
 * подробный разбор своей карты с разделением на блоки:
 * - Личность и энергия
 * - Внутренний мир и эмоции
 * - Ум и общение
 * - Любовь и отношения
 * - Карьера и саморазвитие
 * - Сильные стороны
 * - Зоны роста
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

    log.info('Full chart interpretation request received', {
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
        ? `# Твоя натальная карта, ${profile.name}\n\n## ТВОЯ ЛИЧНОСТЬ И ЭНЕРГИЯ\n\nТвоя карта показывает уникальное сочетание энергий Солнца в ${chartData.sun.sign} и Луны в ${chartData.moon.sign}. Это создаёт интересную картину твоей личности.\n\n## ТВОЙ ВНУТРЕННИЙ МИР И ЭМОЦИИ\n\nТвои эмоции глубоки и многогранны.\n\n## ЛЮБОВЬ И ОТНОШЕНИЯ\n\nВ отношениях ты проявляешь искренность и преданность.`
        : `# Your Natal Chart, ${profile.name}\n\n## YOUR PERSONALITY AND ENERGY\n\nYour chart shows a unique combination of energies.\n\n## YOUR INNER WORLD AND EMOTIONS\n\nYour emotions are deep and multifaceted.`;
      return res.status(200).json({ interpretation: fallbackText });
    }

    // Создаём промпт
    const userPrompt = createFullNatalChartPrompt(chartData, profile);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI (используем gpt-4o для качественного анализа)
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      temperature: 0.75,
      max_tokens: 3000, // Больше токенов для подробного анализа
    });

    const duration = Date.now() - startTime;
    const interpretation = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      textLength: interpretation.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return res.status(200).json({ interpretation });
  } catch (error: any) {
    log.error('Error in full chart interpretation handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки OpenAI
    const { profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const fallbackText = lang
      ? `# Твоя натальная карта, ${profile?.name}\n\n## ТВОЯ ЛИЧНОСТЬ И ЭНЕРГИЯ\n\nТвоя карта показывает уникальное сочетание энергий Солнца в ${chartData?.sun?.sign} и Луны в ${chartData?.moon?.sign}. Это создаёт интересную картину твоей личности.\n\n## ТВОЙ ВНУТРЕННИЙ МИР И ЭМОЦИИ\n\nТвои эмоции глубоки и многогранны.\n\n## ЛЮБОВЬ И ОТНОШЕНИЯ\n\nВ отношениях ты проявляешь искренность и преданность.`
      : `# Your Natal Chart, ${profile?.name}\n\n## YOUR PERSONALITY AND ENERGY\n\nYour chart shows a unique combination of energies.\n\n## YOUR INNER WORLD AND EMOTIONS\n\nYour emotions are deep and multifaceted.`;

    return res.status(200).json({ interpretation: fallbackText });
  }
}
