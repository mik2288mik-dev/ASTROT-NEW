import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createThreeKeysPrompt, addLanguageInstruction, ThreeKeysAIResponse } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/ai-three-keys] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/ai-three-keys] ERROR: ${message}`, error || '');
  },
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * API endpoint для генерации "трёх ключей" через AI
 * Возвращает более глубокие и персонализированные интерпретации с советами
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

    if (!chartData || !chartData.sun || !chartData.moon) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Valid chartData with sun and moon is required'
      });
    }

    log.info('AI three keys request received', {
      userId: profile?.id,
      language: lang ? 'ru' : 'en',
      sunSign: chartData.sun.sign,
      moonSign: chartData.moon.sign
    });

    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      log.error('OpenAI API key not configured, falling back to regular three-keys');
      
      // Возвращаем fallback структуру
      const fallback = {
        key1: {
          title: lang ? 'ТВОЯ ЭНЕРГИЯ' : 'YOUR ENERGY',
          text: lang 
            ? `Твоя энергия ${chartData.sun.sign} с Луной в ${chartData.moon.sign} создаёт уникальное сочетание.`
            : `Your ${chartData.sun.sign} energy with Moon in ${chartData.moon.sign} creates a unique combination.`,
          advice: [
            lang ? 'Прислушивайся к своей интуиции' : 'Listen to your intuition',
            lang ? 'Будь верен себе' : 'Be true to yourself'
          ]
        },
        key2: {
          title: lang ? 'ТВОЙ СТИЛЬ ЛЮБВИ' : 'YOUR LOVE STYLE',
          text: lang
            ? `В любви ты проявляешь глубину и искренность.`
            : `In love you show depth and sincerity.`,
          advice: [
            lang ? 'Открывайся постепенно' : 'Open up gradually',
            lang ? 'Цени эмоциональную связь' : 'Value emotional connection'
          ]
        },
        key3: {
          title: lang ? 'ТВОЯ КАРЬЕРА' : 'YOUR CAREER',
          text: lang
            ? `Твоя карьера связана с самовыражением и ростом.`
            : `Your career is connected to self-expression and growth.`,
          advice: [
            lang ? 'Выбирай то, что вдохновляет' : 'Choose what inspires you',
            lang ? 'Развивай свои таланты' : 'Develop your talents'
          ]
        }
      };
      
      return res.status(200).json(fallback);
    }

    // Создаём промпт
    const userPrompt = createThreeKeysPrompt(chartData, profile);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI (используем gpt-4o для лучшего качества)
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: "json_object" }, // Требуем JSON ответ
      temperature: 0.75,
      max_tokens: 2000,
    });

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      responseLength: responseText.length,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let threeKeys: ThreeKeysAIResponse;
    try {
      threeKeys = JSON.parse(responseText);
      
      // Валидируем структуру
      if (!threeKeys.key1 || !threeKeys.key2 || !threeKeys.key3) {
        throw new Error('Invalid JSON structure');
      }
      
      log.info('Successfully parsed three keys', {
        hasAllKeys: true,
        key1Length: threeKeys.key1.text.length,
        key2Length: threeKeys.key2.text.length,
        key3Length: threeKeys.key3.text.length
      });
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message,
        responseText: responseText.substring(0, 200)
      });
      throw new Error('Invalid JSON response from AI');
    }

    return res.status(200).json(threeKeys);
  } catch (error: any) {
    log.error('Error in AI three keys handler', {
      error: error.message,
      code: error.code,
      type: error.type
    });

    // Fallback на случай ошибки
    const { profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    
    const fallback = {
      key1: {
        title: lang ? 'ТВОЯ ЭНЕРГИЯ' : 'YOUR ENERGY',
        text: lang 
          ? `Твоя энергия ${chartData?.sun?.sign} с Луной в ${chartData?.moon?.sign} создаёт уникальное сочетание.`
          : `Your ${chartData?.sun?.sign} energy with Moon in ${chartData?.moon?.sign} creates a unique combination.`,
        advice: [
          lang ? 'Прислушивайся к своей интуиции' : 'Listen to your intuition',
          lang ? 'Будь верен себе' : 'Be true to yourself'
        ]
      },
      key2: {
        title: lang ? 'ТВОЙ СТИЛЬ ЛЮБВИ' : 'YOUR LOVE STYLE',
        text: lang
          ? `В любви ты проявляешь глубину и искренность.`
          : `In love you show depth and sincerity.`,
        advice: [
          lang ? 'Открывайся постепенно' : 'Open up gradually',
          lang ? 'Цени эмоциональную связь' : 'Value emotional connection'
        ]
      },
      key3: {
        title: lang ? 'ТВОЯ КАРЬЕРА' : 'YOUR CAREER',
        text: lang
          ? `Твоя карьера связана с самовыражением и ростом.`
          : `Your career is connected to self-expression and growth.`,
        advice: [
          lang ? 'Выбирай то, что вдохновляет' : 'Choose what inspires you',
          lang ? 'Развивай свои таланты' : 'Develop your talents'
        ]
      }
    };

    return res.status(200).json(fallback);
  }
}
