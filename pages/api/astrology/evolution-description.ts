import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createEvolutionPrompt, addLanguageInstruction } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/evolution-description] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/evolution-description] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint для генерации описания эволюции пользователя
 * 
 * На основе уровня и натальной карты создаёт красивое описание
 * текущего этапа внутреннего развития с рекомендациями по росту
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, evolution } = req.body;
    const lang = profile?.language === 'ru';

    if (!profile || !chartData || !evolution) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile, chartData, and evolution are required'
      });
    }

    log.info('Evolution description request received', {
      userId: profile.id,
      level: evolution.level,
      title: evolution.title,
      language: lang ? 'ru' : 'en'
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackText = lang
        ? `# ${evolution.title} — Уровень ${evolution.level}\n\nТы находишься на пути внутреннего развития. Твоя интуиция развита на ${evolution.stats.intuition}%, уверенность — ${evolution.stats.confidence}%, осознанность — ${evolution.stats.awareness}%.\n\nПродолжай развиваться и прислушиваться к своей внутренней мудрости.`
        : `# ${evolution.title} — Level ${evolution.level}\n\nYou are on a path of inner development. Your intuition is at ${evolution.stats.intuition}%, confidence at ${evolution.stats.confidence}%, awareness at ${evolution.stats.awareness}%.\n\nContinue growing and listening to your inner wisdom.`;
      return res.status(200).json({ description: fallbackText });
    }

    // Создаём промпт
    const userPrompt = createEvolutionPrompt(chartData, profile, evolution);
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
      temperature: 0.7,
      max_tokens: 1200,
    });

    const duration = Date.now() - startTime;
    const description = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      textLength: description.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return res.status(200).json({ description });
  } catch (error: any) {
    log.error('Error in evolution description handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки OpenAI
    const { profile, evolution } = req.body;
    const lang = profile?.language === 'ru';
    const fallbackText = lang
      ? `# ${evolution?.title || 'Искатель'} — Уровень ${evolution?.level || 1}\n\nТы находишься на пути внутреннего развития. Твоя интуиция развита на ${evolution?.stats?.intuition || 50}%, уверенность — ${evolution?.stats?.confidence || 50}%, осознанность — ${evolution?.stats?.awareness || 50}%.\n\nПродолжай развиваться и прислушиваться к своей внутренней мудрости.`
      : `# ${evolution?.title || 'Seeker'} — Level ${evolution?.level || 1}\n\nYou are on a path of inner development. Your intuition is at ${evolution?.stats?.intuition || 50}%, confidence at ${evolution?.stats?.confidence || 50}%, awareness at ${evolution?.stats?.awareness || 50}%.\n\nContinue growing and listening to your inner wisdom.`;

    return res.status(200).json({ description: fallbackText });
  }
}
