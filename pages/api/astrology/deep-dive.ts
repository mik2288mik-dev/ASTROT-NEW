import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { db } from '../../../lib/db';
import { SYSTEM_PROMPT_ASTRA, createDeepDivePrompt, addLanguageInstruction } from '../../../lib/prompts';

const TITLE_TO_KEY: Record<string, string> = {
  personality: 'personality', love: 'love', career: 'career', weakness: 'weakness', weaknesses: 'weakness', karma: 'karma',
  'личность': 'personality', 'любовь': 'love', 'карьера': 'career', 'слабости': 'weakness', 'карма': 'karma',
};

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/deep-dive] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/deep-dive] ERROR: ${message}`, error || '');
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
    const { profile, topic, chartData } = req.body;
    const lang = profile?.language === 'ru';

    if (!profile || !topic || !chartData) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile, topic, and chartData are required'
      });
    }

    log.info('Deep dive request received', {
      userId: profile.id,
      topic,
      language: lang ? 'ru' : 'en'
    });

    const topicForLookup = typeof topic === 'string' ? (TITLE_TO_KEY[topic.toLowerCase()] || topic.toLowerCase()) : 'personality';
    const validTopics = ['personality', 'love', 'career', 'weakness', 'karma'];
    const topicKey = validTopics.includes(topicForLookup) ? topicForLookup : 'personality';

    if (profile?.id && process.env.DATABASE_URL) {
      try {
        const cached = await db.interpretations.getByHash(profile.id, `deep_dive_${topicKey}`, topicKey);
        if (cached?.content && cached.content.length > 50) {
          return res.status(200).json({ analysis: cached.content });
        }
      } catch (_e) {}
    }

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, using fallback');
      const fallbackAnalysis = lang
        ? `Глубокий анализ по теме "${topic}" для ${profile?.name}. Ваша карта показывает интересные аспекты в этой области.`
        : `Deep analysis on "${topic}" for ${profile?.name}. Your chart shows interesting aspects in this area.`;
      return res.status(200).json({ analysis: fallbackAnalysis });
    }

    // Создаём промпт с использованием нашей системы промптов
    const userPrompt = createDeepDivePrompt(chartData, profile, topic);
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
      max_tokens: 1500,
    });

    const duration = Date.now() - startTime;
    const analysis = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      analysisLength: analysis.length,
      tokensUsed: completion.usage?.total_tokens
    });

    const topicForDb = topicKey;
    const userId = profile?.id;
    if (userId && process.env.DATABASE_URL) {
      try {
        await db.interpretations.set(userId, `deep_dive_${topicForDb}`, topicForDb, analysis);
      } catch (e) {
        log.error('Failed to save deep dive to interpretations', e);
      }
    }

    return res.status(200).json({ analysis });
  } catch (error: any) {
    log.error('Error in deep dive handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки OpenAI
    const { profile, topic } = req.body;
    const lang = profile?.language === 'ru';
    const fallbackAnalysis = lang
      ? `Глубокий анализ по теме "${topic}" для ${profile?.name}. Ваша карта показывает интересные аспекты в этой области.`
      : `Deep analysis on "${topic}" for ${profile?.name}. Your chart shows interesting aspects in this area.`;

    return res.status(200).json({ analysis: fallbackAnalysis });
  }
}
