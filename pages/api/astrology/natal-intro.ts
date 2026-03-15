import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createFullNatalChartIntroPrompt, addLanguageInstruction } from '../../../lib/prompts';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/natal-intro] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API/astrology/natal-intro] WARN: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/natal-intro] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

/**
 * Generate natal chart intro using OpenAI
 */
async function generateNatalIntroWithAI(profile: any, chartData: any): Promise<string> {
  const lang = profile?.language === 'ru';
  
  if (!openai) {
    log.warn('OpenAI not configured, using fallback');
    return generateFallbackIntro(profile, chartData);
  }

  try {
    const userPrompt = createFullNatalChartIntroPrompt(chartData, profile);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: addLanguageInstruction(SYSTEM_PROMPT_ASTRA, lang ? 'ru' : 'en')
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    log.info('Sending request to OpenAI for natal intro', { userId: profile.id });
    
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // Используем более умную модель для качественного вступления
      messages,
      temperature: 0.8,
      max_tokens: 1500,
    });

    const duration = Date.now() - startTime;
    const intro = completion.choices[0]?.message?.content || '';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      introLength: intro.length,
      tokensUsed: completion.usage?.total_tokens
    });

    return intro;
  } catch (error: any) {
    log.error('Error calling OpenAI', {
      error: error.message,
      code: error.code,
      type: error.type
    });
    
    // Fallback при ошибке
    return generateFallbackIntro(profile, chartData);
  }
}

/**
 * Fallback intro when OpenAI is unavailable.
 * Lumia style: max 1–2 astrology terms, personal, warm.
 */
function generateFallbackIntro(profile: any, chartData: any): string {
  const lang = profile?.language === 'ru';
  const name = profile.name || (lang ? 'друг' : 'friend');
  const element = chartData.element || 'Fire';
  
  if (lang) {
    return `**Привет, ${name}!**

Я изучила твою карту, и вот что вижу: у тебя сильная, узнаваемая энергия. Ты чувствуешь людей и ситуации глубже, чем кажется со стороны.

**Твои сильные стороны:**
• Твоя стихия ${element} даёт тебе особый подход к жизни
• Ты легко находишь баланс между разными сторонами себя
• У тебя есть природная способность понимать людей

**Что делает тебя особенным:**
Ты можешь быть разным в зависимости от ситуации — и это твоя сила. Хочешь узнать больше о личности, любви, карьере и предназначении? Активируй Premium!`;
  } else {
    return `**Hi, ${name}!**

I've studied your chart, and here's what I see: you have a strong, recognizable energy. You feel people and situations more deeply than it might seem from the outside.

**Your strengths:**
• Your ${element} element gives you a special approach to life
• You easily find balance between different sides of yourself
• You have a natural ability to understand people

**What makes you special:**
You can be different depending on the situation — and that's your strength. Want to learn more about your personality, love, career and life purpose? Activate Premium!`;
  }
}

/**
 * Main API handler
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, chartId } = req.body;

    if (!profile || !chartData) {
      log.error('Missing required fields', { hasProfile: !!profile, hasChartData: !!chartData });
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and chartData are required'
      });
    }

    const userId = profile.id || profile.name;
    const effectiveChartId = chartId != null ? parseInt(String(chartId), 10) : null;
    const cacheKey = effectiveChartId ?? userId;

    log.info('Natal intro request received', {
      userId,
      chartId: effectiveChartId,
      language: profile.language,
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      hasRising: !!chartData.rising
    });

    // Проверяем кэш в interpretations (chart-level или user/primary)
    if (cacheKey) {
      try {
        const cached = await db.interpretations.getByHash(cacheKey, 'natal_intro', 'default');
        if (cached?.content && cached.content.length > 50) {
          log.info('Returning cached natal intro', { chartId: effectiveChartId, userId });
          res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
          return res.status(200).json({ intro: cached.content, timestamp: Date.now() });
        }
      } catch (_e) {}
    }

    // Генерируем вступление
    const intro = await generateNatalIntroWithAI(profile, chartData);

    // Сохраняем в interpretations (Lumia schema) — chart-level или user-level
    if (cacheKey) {
      try {
        await db.interpretations.set(cacheKey, 'natal_intro', 'default', intro);
        log.info('Natal intro saved to interpretations', { chartId: effectiveChartId, userId });
      } catch (dbError: any) {
        log.error('Error saving intro to database', { error: dbError.message, chartId: effectiveChartId, userId });
      }
    }

    // Cache header (1 day - вступление может регенерироваться)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');

    return res.status(200).json({
      intro,
      timestamp: Date.now()
    });
  } catch (error: any) {
    log.error('Unexpected error in handler', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Rate limiting: AI операции - 5 запросов в минуту для free
export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_FREE);
