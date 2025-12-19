import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createFullNatalChartIntroPrompt, createThreeKeysPrompt, addLanguageInstruction, ThreeKeysAIResponse } from '../../../lib/prompts';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/three-keys] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/three-keys] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API/astrology/three-keys] WARNING: ${message}`, data || '');
  }
};

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Personalized descriptions based on natal chart data
function generatePersonalizedThreeKeys(profile: any, chartData: any) {
  const lang = profile?.language === 'ru';
  // Проверяем наличие обязательных данных
  if (!chartData?.sun?.sign || !chartData?.moon?.sign) {
    throw new Error('Invalid chart data: sun or moon sign is missing');
  }
  
  const sunSign = chartData.sun.sign;
  const moonSign = chartData.moon.sign;
  const risingSign = chartData.rising?.sign || sunSign;
  const venusSign = chartData.venus?.sign || sunSign;
  const marsSign = chartData.mars?.sign || sunSign;
  const element = chartData.element || 'Fire';

  // Key 1: Energy - based on Sun, Moon, and Element
  const energyDescriptions = {
    'ru': {
      'Fire': `Твоя энергия ${sunSign} с Луной в ${moonSign} создает мощную огненную силу. Ты вдохновляешь других своей страстью и уверенностью.`,
      'Water': `Твоя энергия ${sunSign} с Луной в ${moonSign} дарует глубину эмоций и интуицию. Ты чувствуешь мир на уровне души.`,
      'Air': `Твоя энергия ${sunSign} с Луной в ${moonSign} создает легкость мысли и общения. Твой ум быстр и находчив.`,
      'Earth': `Твоя энергия ${sunSign} с Луной в ${moonSign} дает практичность и стабильность. Ты создаешь реальные результаты.`,
    },
    'en': {
      'Fire': `Your ${sunSign} energy with Moon in ${moonSign} creates a powerful fiery force. You inspire others with your passion and confidence.`,
      'Water': `Your ${sunSign} energy with Moon in ${moonSign} grants emotional depth and intuition. You feel the world at a soul level.`,
      'Air': `Your ${sunSign} energy with Moon in ${moonSign} creates lightness of thought and communication. Your mind is quick and resourceful.`,
      'Earth': `Your ${sunSign} energy with Moon in ${moonSign} provides practicality and stability. You create real tangible results.`,
    }
  };

  // Key 2: Love Style - based on Venus and Moon
  const loveDescriptions = {
    'ru': {
      'Aries': `В любви ты страстен и прямолинеен. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает яркие, незабываемые отношения.`,
      'Taurus': `В любви ты ищешь стабильность и чувственность. Твоя Венера в ${venusSign} с Луной в ${moonSign} дарит преданность и нежность.`,
      'Gemini': `В любви ты ценишь интеллект и общение. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает живые, разнообразные отношения.`,
      'Cancer': `В любви ты ищешь глубокую эмоциональную связь. Твоя Венера в ${venusSign} с Луной в ${moonSign} дарит заботу и преданность.`,
      'Leo': `В любви ты щедр и романтичен. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает королевские, яркие отношения.`,
      'Virgo': `В любви ты заботлив и внимателен к деталям. Твоя Венера в ${venusSign} с Луной в ${moonSign} проявляется в служении любимым.`,
      'Libra': `В любви ты ищешь гармонию и баланс. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает изящные, равноправные отношения.`,
      'Scorpio': `В любви ты страстен и глубок. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает трансформирующие, интенсивные отношения.`,
      'Sagittarius': `В любви ты ценишь свободу и приключения. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает вдохновляющие отношения.`,
      'Capricorn': `В любви ты серьезен и верен. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает надежные, долгосрочные отношения.`,
      'Aquarius': `В любви ты уникален и независим. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает необычные, дружеские отношения.`,
      'Pisces': `В любви ты романтичен и сострадателен. Твоя Венера в ${venusSign} с Луной в ${moonSign} создает мистические, глубокие отношения.`,
    },
    'en': {
      'Aries': `In love you are passionate and direct. Your Venus in ${venusSign} with Moon in ${moonSign} creates bright, unforgettable relationships.`,
      'Taurus': `In love you seek stability and sensuality. Your Venus in ${venusSign} with Moon in ${moonSign} brings devotion and tenderness.`,
      'Gemini': `In love you value intellect and communication. Your Venus in ${venusSign} with Moon in ${moonSign} creates lively, diverse relationships.`,
      'Cancer': `In love you seek deep emotional connection. Your Venus in ${venusSign} with Moon in ${moonSign} brings care and devotion.`,
      'Leo': `In love you are generous and romantic. Your Venus in ${venusSign} with Moon in ${moonSign} creates royal, brilliant relationships.`,
      'Virgo': `In love you are caring and attentive to details. Your Venus in ${venusSign} with Moon in ${moonSign} manifests in serving loved ones.`,
      'Libra': `In love you seek harmony and balance. Your Venus in ${venusSign} with Moon in ${moonSign} creates graceful, equal relationships.`,
      'Scorpio': `In love you are passionate and deep. Your Venus in ${venusSign} with Moon in ${moonSign} creates transformative, intense relationships.`,
      'Sagittarius': `In love you value freedom and adventure. Your Venus in ${venusSign} with Moon in ${moonSign} creates inspiring relationships.`,
      'Capricorn': `In love you are serious and loyal. Your Venus in ${venusSign} with Moon in ${moonSign} creates reliable, long-term relationships.`,
      'Aquarius': `In love you are unique and independent. Your Venus in ${venusSign} with Moon in ${moonSign} creates unusual, friendly relationships.`,
      'Pisces': `In love you are romantic and compassionate. Your Venus in ${venusSign} with Moon in ${moonSign} creates mystical, deep relationships.`,
    }
  };

  // Key 3: Career - based on Mars, Sun, and Ruling Planet
  const careerDescriptions = {
    'ru': {
      'Aries': `Твоя карьера связана с лидерством и инициативой. Марс в ${marsSign} с Солнцем в ${sunSign} дают энергию первопроходца.`,
      'Taurus': `Твоя карьера связана с созданием материальных ценностей. Марс в ${marsSign} с Солнцем в ${sunSign} дают упорство и практичность.`,
      'Gemini': `Твоя карьера связана с коммуникацией и обменом информацией. Марс в ${marsSign} с Солнцем в ${sunSign} дают ловкость ума.`,
      'Cancer': `Твоя карьера связана с заботой о других и созданием уюта. Марс в ${marsSign} с Солнцем в ${sunSign} дают эмоциональный интеллект.`,
      'Leo': `Твоя карьера связана с творчеством и самовыражением. Марс в ${marsSign} с Солнцем в ${sunSign} дают харизму и уверенность.`,
      'Virgo': `Твоя карьера связана с анализом и служением. Марс в ${marsSign} с Солнцем в ${sunSign} дают точность и мастерство.`,
      'Libra': `Твоя карьера связана с искусством и дипломатией. Марс в ${marsSign} с Солнцем в ${sunSign} дают чувство гармонии.`,
      'Scorpio': `Твоя карьера связана с трансформацией и глубинными процессами. Марс в ${marsSign} с Солнцем в ${sunSign} дают силу воли.`,
      'Sagittarius': `Твоя карьера связана с обучением и путешествиями. Марс в ${marsSign} с Солнцем в ${sunSign} дают стремление к росту.`,
      'Capricorn': `Твоя карьера связана с достижениями и управлением. Марс в ${marsSign} с Солнцем в ${sunSign} дают амбиции и дисциплину.`,
      'Aquarius': `Твоя карьера связана с инновациями и технологиями. Марс в ${marsSign} с Солнцем в ${sunSign} дают оригинальность мышления.`,
      'Pisces': `Твоя карьера связана с искусством и помощью людям. Марс в ${marsSign} с Солнцем в ${sunSign} дают интуицию и сочувствие.`,
    },
    'en': {
      'Aries': `Your career is connected to leadership and initiative. Mars in ${marsSign} with Sun in ${sunSign} give pioneer energy.`,
      'Taurus': `Your career is connected to creating material values. Mars in ${marsSign} with Sun in ${sunSign} give persistence and practicality.`,
      'Gemini': `Your career is connected to communication and information exchange. Mars in ${marsSign} with Sun in ${sunSign} give mental agility.`,
      'Cancer': `Your career is connected to caring for others and creating comfort. Mars in ${marsSign} with Sun in ${sunSign} give emotional intelligence.`,
      'Leo': `Your career is connected to creativity and self-expression. Mars in ${marsSign} with Sun in ${sunSign} give charisma and confidence.`,
      'Virgo': `Your career is connected to analysis and service. Mars in ${marsSign} with Sun in ${sunSign} give precision and mastery.`,
      'Libra': `Your career is connected to art and diplomacy. Mars in ${marsSign} with Sun in ${sunSign} give sense of harmony.`,
      'Scorpio': `Your career is connected to transformation and deep processes. Mars in ${marsSign} with Sun in ${sunSign} give willpower.`,
      'Sagittarius': `Your career is connected to teaching and travel. Mars in ${marsSign} with Sun in ${sunSign} give drive for growth.`,
      'Capricorn': `Your career is connected to achievement and management. Mars in ${marsSign} with Sun in ${sunSign} give ambition and discipline.`,
      'Aquarius': `Your career is connected to innovation and technology. Mars in ${marsSign} with Sun in ${sunSign} give original thinking.`,
      'Pisces': `Your career is connected to art and helping people. Mars in ${marsSign} with Sun in ${sunSign} give intuition and compassion.`,
    }
  };

  const langCode = lang ? 'ru' : 'en';
  
  // Типобезопасное получение описаний
  type LangKey = 'ru' | 'en';
  type ElementKey = 'Fire' | 'Water' | 'Air' | 'Earth';
  
  const getEnergyText = (lang: LangKey, elem: string): string => {
    const descriptions = energyDescriptions[lang] as Record<string, string>;
    return descriptions[elem] || descriptions['Fire'];
  };
  
  const getLoveText = (lang: LangKey, sign: string): string => {
    const descriptions = loveDescriptions[lang] as Record<string, string>;
    return descriptions[sign] || descriptions['Aries'];
  };
  
  const getCareerText = (lang: LangKey, sign: string): string => {
    const descriptions = careerDescriptions[lang] as Record<string, string>;
    return descriptions[sign] || descriptions['Aries'];
  };

  return {
    key1: {
      title: lang ? 'ТВОЯ ЭНЕРГИЯ' : 'YOUR ENERGY',
      text: getEnergyText(langCode as LangKey, element),
      advice: []
    },
    key2: {
      title: lang ? 'ТВОЙ СТИЛЬ ЛЮБВИ' : 'YOUR LOVE STYLE',
      text: getLoveText(langCode as LangKey, sunSign),
      advice: []
    },
    key3: {
      title: lang ? 'ТВОЯ КАРЬЕРА' : 'YOUR CAREER',
      text: getCareerText(langCode as LangKey, sunSign),
      advice: []
    }
  };
}

/**
 * Generate three keys using OpenAI
 */
async function generateThreeKeysWithAI(profile: any, chartData: any): Promise<any> {
  const lang = profile?.language === 'ru';
  
  if (!openai) {
    log.warn('OpenAI not configured, using fallback');
    return generatePersonalizedThreeKeys(profile, chartData);
  }

  try {
    const userPrompt = createThreeKeysPrompt(chartData, profile);
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI for three keys generation');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const threeKeys: ThreeKeysAIResponse = JSON.parse(responseText);
    
    if (!threeKeys.key1 || !threeKeys.key2 || !threeKeys.key3) {
      throw new Error('Invalid JSON structure from OpenAI');
    }
    
    log.info('Successfully generated three keys with OpenAI');
    return threeKeys;
  } catch (error: any) {
    log.error('Error generating with OpenAI, using fallback', { error: error.message });
    return generatePersonalizedThreeKeys(profile, chartData);
  }
}

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
    const { profile, chartData } = req.body;
    const userId = profile?.id;

    if (!chartData || !chartData.sun || !chartData.moon) {
      log.error('Invalid chart data provided');
      return res.status(400).json({ 
        error: 'Invalid chart data',
        message: 'Chart data with sun and moon is required'
      });
    }

    log.info('Processing three keys request', {
      userId,
      language: profile?.language,
      sunSign: chartData.sun.sign,
      moonSign: chartData.moon.sign
    });

    // 1. Проверяем наличие кешированного текста в БД
    if (userId) {
      try {
        const cached = await db.cachedTexts.getThreeKeys(userId);
        if (cached && cached.data) {
          log.info('Returning cached three keys', { 
            userId, 
            updatedAt: cached.updatedAt 
          });
          return res.status(200).json(cached.data);
        }
      } catch (error: any) {
        log.warn('Error checking cache, proceeding with generation', { error: error.message });
      }
    }

    // 2. Генерируем новый текст (если кеша нет)
    log.info('No cached data found, generating new three keys', { userId });
    const keys = await generateThreeKeysWithAI(profile, chartData);

    // 3. Сохраняем в БД для будущих запросов
    if (userId) {
      try {
        await db.cachedTexts.setThreeKeys(userId, keys);
        log.info('Cached three keys saved to DB', { userId });
      } catch (error: any) {
        log.error('Error saving to cache', { error: error.message });
        // Не прерываем выполнение, просто логируем ошибку
      }
    }

    log.info('Three keys generated successfully', {
      userId,
      hasUniqueKeys: true
    });

    return res.status(200).json(keys);
  } catch (error: any) {
    log.error('Error generating three keys', {
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
