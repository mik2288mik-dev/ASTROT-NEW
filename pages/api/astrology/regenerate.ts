import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import OpenAI from 'openai';
import { 
  SYSTEM_PROMPT_ASTRA, 
  createThreeKeysPrompt, 
  createSoulPassportPrompt,
  createFullNatalChartPrompt,
  createBriefSynastryPrompt,
  createFullSynastryPrompt,
  addLanguageInstruction 
} from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/regenerate] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/regenerate] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API/astrology/regenerate] WARNING: ${message}`, data || '');
  }
};

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Константа стоимости регенерации
const REGENERATION_COST_STARS = 50;

/**
 * Проверить лимиты регенерации для пользователя
 * 
 * Логика:
 * - Премиум пользователи: 1 бесплатная регенерация в НЕДЕЛЮ
 * - Все последующие регенерации: 50 звёзд
 */
async function checkRegenerationLimits(userId: string, contentType: string, isPremium: boolean) {
  if (!isPremium) {
    return {
      canRegenerate: false,
      isFree: false,
      costInStars: 0,
      regenerationsThisWeek: 0,
      message: 'Регенерация доступна только для премиум-пользователей'
    };
  }

  // Получаем количество регенераций за неделю (последние 7 дней)
  const countThisWeek = await db.regenerations.getCountThisWeek(userId, contentType);
  
  // Первая регенерация в неделю - бесплатная (включена в премиум)
  if (countThisWeek === 0) {
    return {
      canRegenerate: true,
      isFree: true,
      costInStars: 0,
      regenerationsThisWeek: 0,
      message: 'Первая регенерация в неделю включена в премиум'
    };
  }

  // Последующие регенерации - 50 звёзд
  const starsBalance = await db.starsBalance.get(userId);
  
  if (starsBalance < REGENERATION_COST_STARS) {
    return {
      canRegenerate: false,
      isFree: false,
      costInStars: REGENERATION_COST_STARS,
      regenerationsThisWeek: countThisWeek,
      message: `Недостаточно звёзд. Нужно: ${REGENERATION_COST_STARS}, у вас: ${starsBalance}`
    };
  }

  return {
    canRegenerate: true,
    isFree: false,
    costInStars: REGENERATION_COST_STARS,
    regenerationsThisWeek: countThisWeek,
    message: 'Регенерация будет стоить 50 звёзд'
  };
}

/**
 * Регенерировать три ключа
 */
async function regenerateThreeKeys(profile: any, chartData: any): Promise<any> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const lang = profile?.language === 'ru';
  const userPrompt = createThreeKeysPrompt(chartData, profile);
  const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_ASTRA },
      { role: 'user', content: promptWithLang }
    ],
    response_format: { type: "json_object" },
    temperature: 0.85, // Немного выше для разнообразия
    max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const result = JSON.parse(responseText);
  
  if (!result.key1 || !result.key2 || !result.key3) {
    throw new Error('Invalid response structure from OpenAI');
  }
  
  return result;
}

/**
 * Регенерировать краткое описание (soul passport)
 */
async function regenerateNatalSummary(profile: any, chartData: any): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const lang = profile?.language === 'ru';
  const userPrompt = createSoulPassportPrompt(chartData, profile);
  const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_ASTRA },
      { role: 'user', content: promptWithLang }
    ],
    temperature: 0.85,
    max_tokens: 1500,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Регенерировать полный разбор натальной карты
 */
async function regenerateFullNatal(profile: any, chartData: any): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI not configured');
  }

  const lang = profile?.language === 'ru';
  const userPrompt = createFullNatalChartPrompt(chartData, profile);
  const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_ASTRA },
      { role: 'user', content: promptWithLang }
    ],
    temperature: 0.85,
    max_tokens: 3000,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * API endpoint для регенерации астрологических текстов
 * 
 * Логика:
 * 1. Проверить что пользователь премиум
 * 2. Проверить лимиты (первая регенерация в день бесплатна, последующие - 50 звёзд)
 * 3. Списать звёзды если нужно
 * 4. Регенерировать текст через OpenAI
 * 5. Сохранить в БД
 * 6. Записать в таблицу регенераций
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, contentType, profile, chartData, partnerData } = req.body;

    log.info('Regeneration request received', {
      userId,
      contentType,
      isPremium: profile?.isPremium
    });

    // Валидация
    if (!userId || !contentType || !profile) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'userId, contentType, and profile are required'
      });
    }

    if (!profile.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        message: 'Регенерация доступна только для премиум-пользователей'
      });
    }

    // Проверяем лимиты
    const limits = await checkRegenerationLimits(userId, contentType, profile.isPremium);
    
    if (!limits.canRegenerate) {
      return res.status(403).json({
        error: 'Regeneration not allowed',
        message: limits.message,
        limits
      });
    }

    log.info('Regeneration limits checked', {
      userId,
      contentType,
      isFree: limits.isFree,
      cost: limits.costInStars
    });

    // Списываем звёзды если нужно
    let newBalance = await db.starsBalance.get(userId);
    
    if (!limits.isFree) {
      try {
        const result = await db.starsBalance.deduct(userId, REGENERATION_COST_STARS);
        newBalance = result.newBalance;
        log.info('Stars deducted successfully', {
          userId,
          amount: REGENERATION_COST_STARS,
          newBalance
        });
      } catch (error: any) {
        log.error('Failed to deduct stars', { error: error.message });
        return res.status(400).json({
          error: 'Payment failed',
          message: 'Не удалось списать звёзды'
        });
      }
    }

    // Регенерируем текст
    let regeneratedData: any;
    
    try {
      switch (contentType) {
        case 'three_keys':
          if (!chartData) {
            throw new Error('chartData required for three_keys regeneration');
          }
          regeneratedData = await regenerateThreeKeys(profile, chartData);
          await db.cachedTexts.setThreeKeys(userId, regeneratedData);
          break;

        case 'natal_summary':
          if (!chartData) {
            throw new Error('chartData required for natal_summary regeneration');
          }
          regeneratedData = await regenerateNatalSummary(profile, chartData);
          await db.cachedTexts.setNatalSummary(userId, regeneratedData);
          break;

        case 'full_natal':
          if (!chartData) {
            throw new Error('chartData required for full_natal regeneration');
          }
          regeneratedData = await regenerateFullNatal(profile, chartData);
          await db.cachedTexts.setFullNatal(userId, regeneratedData);
          break;

        default:
          return res.status(400).json({
            error: 'Invalid content type',
            message: `Unsupported content type: ${contentType}`
          });
      }

      log.info('Text regenerated successfully', {
        userId,
        contentType,
        dataLength: typeof regeneratedData === 'string' ? regeneratedData.length : JSON.stringify(regeneratedData).length
      });
    } catch (error: any) {
      log.error('Failed to regenerate text', {
        error: error.message,
        contentType
      });

      // Возвращаем звёзды если регенерация не удалась
      if (!limits.isFree) {
        await db.starsBalance.add(userId, REGENERATION_COST_STARS);
        log.info('Stars refunded due to regeneration failure');
      }

      return res.status(500).json({
        error: 'Regeneration failed',
        message: error.message
      });
    }

    // Записываем регенерацию в таблицу
    try {
      await db.regenerations.add(userId, contentType, !limits.isFree, limits.isFree ? 0 : REGENERATION_COST_STARS);
      log.info('Regeneration recorded', { userId, contentType });
    } catch (error: any) {
      log.warn('Failed to record regeneration', { error: error.message });
      // Не критично, продолжаем
    }

    return res.status(200).json({
      success: true,
      data: regeneratedData,
      newBalance,
      wasPaid: !limits.isFree,
      costInStars: limits.isFree ? 0 : REGENERATION_COST_STARS
    });
  } catch (error: any) {
    log.error('Error in regeneration handler', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
