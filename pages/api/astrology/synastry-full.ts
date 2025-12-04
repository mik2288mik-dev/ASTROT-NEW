import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { SYSTEM_PROMPT_ASTRA, createFullSynastryPrompt, addLanguageInstruction, FullSynastryAIResponse } from '../../../lib/prompts';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/synastry-full] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/synastry-full] ERROR: ${message}`, error || '');
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
    const { profile, partnerName, partnerDate, partnerTime, partnerPlace, language, relationshipType } = req.body;

    if (!profile || !partnerName || !partnerDate) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Profile, partnerName, and partnerDate are required'
      });
    }

    // Проверяем премиум статус
    if (!profile.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        message: 'Full synastry analysis is available only for premium users'
      });
    }

    log.info('Calculating full synastry', {
      userId: profile?.id,
      partnerName,
      partnerDate,
      language,
      relationshipType
    });

    const lang = language === 'ru';

    // Получаем натальную карту пользователя
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
        moon: { planet: 'Moon', sign: 'Cancer', degree: 10, description: '' },
        rising: { planet: 'Ascendant', sign: 'Aries', degree: 0, description: '' },
        mercury: null,
        venus: null,
        mars: null,
        element: 'Fire',
        rulingPlanet: 'Sun',
        summary: ''
      };
    }

    // Вычисляем натальную карту партнёра
    let partnerChartData;
    try {
      partnerChartData = await calculateNatalChart(
        partnerName,
        partnerDate,
        partnerTime || '12:00',
        partnerPlace || profile.birthPlace
      );
    } catch (error: any) {
      log.error('Failed to calculate partner natal chart', { error: error.message });
      // Используем fallback данные
      partnerChartData = {
        sun: { planet: 'Sun', sign: 'Aries', degree: 20, description: '' },
        moon: { planet: 'Moon', sign: 'Pisces', degree: 5, description: '' },
        rising: { planet: 'Ascendant', sign: 'Aries', degree: 0, description: '' },
        mercury: null,
        venus: null,
        mars: null,
        element: 'Fire',
        rulingPlanet: 'Mars',
        summary: ''
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
        fullAnalysis: {
          generalTheme: lang 
            ? `Ваша связь с ${partnerName} создаёт особую атмосферу взаимного роста и понимания. Это отношения, которые учат вас обоих быть более открытыми и принимающими.`
            : `Your connection with ${partnerName} creates a special atmosphere of mutual growth and understanding. This is a relationship that teaches both of you to be more open and accepting.`,
          attraction: lang
            ? `Вас притягивает друг к другу естественная гармония характеров. ${profile?.name}, ты чувствуешь себя понятым и принятым рядом с ${partnerName}. Ваши различия дополняют друг друга, создавая баланс между спокойствием и динамикой, мечтательностью и практичностью.`
            : `You are attracted to each other by the natural harmony of characters. ${profile?.name}, you feel understood and accepted next to ${partnerName}. Your differences complement each other, creating balance between calm and dynamics, dreaminess and practicality.`,
          difficulties: lang
            ? `Иногда ваши разные темпы жизни могут создавать напряжение. Один из вас предпочитает действовать быстро и решительно, другой - обдумывать и взвешивать. Важно не воспринимать это как недостаток, а видеть возможность учиться друг у друга.`
            : `Sometimes your different life paces can create tension. One of you prefers to act quickly and decisively, the other - to think and weigh. It's important not to perceive this as a flaw, but to see an opportunity to learn from each other.`,
          recommendations: lang
            ? [
                'Регулярно проговаривайте свои чувства и потребности',
                'Давайте друг другу пространство для личных интересов',
                'Находите общие цели и двигайтесь к ним вместе',
                'Учитесь принимать разные темпы и стили действий',
                'Создавайте ритуалы близости - совместные прогулки, вечера, разговоры'
              ]
            : [
                'Regularly express your feelings and needs',
                'Give each other space for personal interests',
                'Find common goals and move towards them together',
                'Learn to accept different paces and action styles',
                'Create intimacy rituals - joint walks, evenings, conversations'
              ],
          potential: lang
            ? `Если вы оба будете внимательны к потребностям друг друга, эта связь может стать источником глубокого личностного роста. Вы можете научиться видеть мир глазами другого человека, развить качества, которых вам не хватало. ${partnerName} поможет ${profile?.name} стать более решительным и уверенным, а ${profile?.name} научит ${partnerName} чувствовать и понимать эмоции. Вместе вы создаёте нечто большее, чем каждый из вас по отдельности.`
            : `If you both are attentive to each other's needs, this connection can become a source of deep personal growth. You can learn to see the world through another person's eyes, develop qualities you were lacking. ${partnerName} will help ${profile?.name} become more decisive and confident, and ${profile?.name} will teach ${partnerName} to feel and understand emotions. Together you create something greater than each of you separately.`
        },
        summary: lang
          ? `Глубокий анализ совместимости между ${profile?.name} и ${partnerName}.`
          : `Deep compatibility analysis between ${profile?.name} and ${partnerName}.`
      };
      return res.status(200).json(fallbackResult);
    }

    // Создаём промпт для AI
    const userPrompt = createFullSynastryPrompt(
      userChartData, 
      profile, 
      partnerChartData, 
      partnerName,
      relationshipType || 'романтические отношения'
    );
    const promptWithLang = addLanguageInstruction(userPrompt, lang ? 'ru' : 'en');

    log.info('Sending request to OpenAI', {
      model: 'gpt-4o',
      promptLength: promptWithLang.length
    });

    // Отправляем запрос в OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: promptWithLang }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2500,
    });

    const duration = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';

    log.info('OpenAI response received', {
      duration: `${duration}ms`,
      tokensUsed: completion.usage?.total_tokens
    });

    // Парсим JSON ответ
    let fullSynastry: FullSynastryAIResponse;
    try {
      fullSynastry = JSON.parse(responseText);
      
      log.info('Full synastry calculated successfully');

      const result = {
        fullAnalysis: fullSynastry,
        summary: fullSynastry.generalTheme
      };

      return res.status(200).json(result);
    } catch (parseError: any) {
      log.error('Failed to parse JSON response', {
        error: parseError.message
      });
      throw new Error('Invalid JSON response from AI');
    }
  } catch (error: any) {
    log.error('Error calculating full synastry', {
      error: error.message,
      stack: error.stack
    });

    // Fallback на случай ошибки
    const { profile, partnerName, language } = req.body;
    const lang = language === 'ru';
    
    const fallbackResult = {
      fullAnalysis: {
        generalTheme: lang 
          ? `Ваша связь с ${partnerName} создаёт особую атмосферу взаимного роста и понимания.`
          : `Your connection with ${partnerName} creates a special atmosphere of mutual growth and understanding.`,
        attraction: lang
          ? 'Вас притягивает друг к другу естественная гармония характеров.'
          : 'You are attracted to each other by the natural harmony of characters.',
        difficulties: lang
          ? 'Иногда ваши разные темпы жизни могут создавать напряжение.'
          : 'Sometimes your different life paces can create tension.',
        recommendations: lang
          ? ['Проговаривайте свои чувства', 'Давайте друг другу пространство', 'Находите общие цели']
          : ['Express your feelings', 'Give each other space', 'Find common goals'],
        potential: lang
          ? 'Эта связь может стать источником глубокого личностного роста.'
          : 'This connection can become a source of deep personal growth.'
      },
      summary: lang
        ? `Глубокий анализ совместимости между ${profile?.name} и ${partnerName}.`
        : `Deep compatibility analysis between ${profile?.name} and ${partnerName}.`
    };

    return res.status(200).json(fallbackResult);
  }
}
