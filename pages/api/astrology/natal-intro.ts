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
 * Fallback function if OpenAI is unavailable
 */
function generateFallbackIntro(profile: any, chartData: any): string {
  const lang = profile?.language === 'ru';
  const name = profile.name || (lang ? 'друг' : 'friend');
  const sunSign = chartData.sun?.sign || 'Unknown';
  const moonSign = chartData.moon?.sign || 'Unknown';
  const rising = chartData.rising?.sign || 'Unknown';
  const element = chartData.element || 'Fire';
  
  if (lang) {
    return `**Привет, ${name}!**

Я изучила твою натальную карту, и вот что я вижу:

Твоё Солнце в ${sunSign}, Луна в ${moonSign}, а Асцендент в ${rising}. Это создаёт уникальное сочетание качеств — ты одновременно ${sunSign.toLowerCase()} в своей сути, ${moonSign.toLowerCase()} в эмоциях, и ${rising.toLowerCase()} в том, как мир тебя видит.

**Твои суперсилы:**
• Твоя стихия ${element} даёт тебе особый подход к жизни
• Ты легко находишь баланс между разными сторонами себя
• У тебя есть природная способность понимать людей
• Твоя интуиция сильнее, чем ты думаешь

**Что делает тебя особенным:**
• Твоё сочетание знаков создаёт редкую комбинацию качеств
• Ты можешь быть разным в зависимости от ситуации — и это твоя сила

Хочешь узнать больше о своей личности, любви, карьере и предназначении? Активируй Premium!`;
  } else {
    return `**Hi, ${name}!**

I've studied your natal chart, and here's what I see:

Your Sun is in ${sunSign}, Moon in ${moonSign}, and Ascendant in ${rising}. This creates a unique combination of qualities — you're ${sunSign.toLowerCase()} at your core, ${moonSign.toLowerCase()} in emotions, and ${rising.toLowerCase()} in how the world sees you.

**Your superpowers:**
• Your ${element} element gives you a special approach to life
• You easily find balance between different sides of yourself
• You have a natural ability to understand people
• Your intuition is stronger than you think

**What makes you special:**
• Your sign combination creates a rare mix of qualities
• You can be different depending on the situation — and that's your strength

Want to learn more about your personality, love, career and life purpose? Activate Premium!`;
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
    const { profile, chartData } = req.body;

    if (!profile || !chartData) {
      log.error('Missing required fields', { hasProfile: !!profile, hasChartData: !!chartData });
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile and chartData are required'
      });
    }

    const userId = profile.id || profile.name;
    log.info('Natal intro request received', {
      userId,
      language: profile.language,
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      hasRising: !!chartData.rising
    });

    // Генерируем вступление
    const intro = await generateNatalIntroWithAI(profile, chartData);

    // Сохраняем в профиль пользователя
    if (userId) {
      try {
        const existingProfile = await db.users.get(userId);
        if (existingProfile) {
          const existingContent = existingProfile.generated_content && typeof existingProfile.generated_content === 'object' 
            ? existingProfile.generated_content 
            : {};
          const updatedContent = {
            ...existingContent,
            natalIntro: intro,
            timestamps: {
              ...(existingContent.timestamps || {}),
              natalIntroGenerated: Date.now()
            }
          };

          await db.users.set(userId, {
            ...existingProfile,
            generated_content: updatedContent
          });

          log.info('Natal intro saved to user profile', { userId });
        }
      } catch (dbError: any) {
        log.error('Error saving intro to database', { error: dbError.message, userId });
        // Не падаем, если не удалось сохранить в БД
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
