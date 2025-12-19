import { UserProfile, NatalChartData, DailyHoroscope, ThreeKeys, SynastryResult, UserContext, UserEvolution } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";
import { getElementForSign, SIGN_ELEMENTS } from "../lib/zodiac-utils";

// Helper to select language prompt
const getLangPrompt = (lang: string) => lang === 'ru' ? "Response must be in Russian." : "Response must be in English.";

// API base URL - используем локальные Next.js API routes
const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[AstrologyService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[AstrologyService] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[AstrologyService] WARNING: ${message}`, data || '');
  }
};

// Log API configuration
log.info(`API_BASE_URL configured: ${API_BASE_URL}`);

/**
 * Calculate natal chart - calls backend API
 */
export const calculateNatalChart = async (profile: UserProfile): Promise<NatalChartData> => {
  const url = `${API_BASE_URL}/api/astrology/natal-chart`;
  log.info('[calculateNatalChart] Starting calculation', {
    name: profile.name,
    birthDate: profile.birthDate,
    birthPlace: profile.birthPlace
  });

  try {
    const requestBody = {
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      language: profile.language
    };

    log.info(`[calculateNatalChart] Sending POST request to: ${url}`);

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateNatalChart] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = '';
      let errorDetails: any = null;
      
      try {
        const errorData = await response.json();
        // Используем новую структуру ошибок с полем message
        errorMessage = errorData.message || errorData.error || 'Unknown error';
        errorDetails = errorData.errors || errorData.details;
      } catch (parseError) {
        // Если не удалось распарсить JSON, пробуем прочитать как текст
        try {
          errorMessage = await response.text();
        } catch {
          errorMessage = `Ошибка сервера: ${response.status} ${response.statusText}`;
        }
      }
      
      log.error(`[calculateNatalChart] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        errorDetails,
        url,
        contentType: response.headers.get('content-type')
      });
      
      // Для ошибок валидации (400) возвращаем понятное сообщение
      if (response.status === 400) {
        const validationError = errorMessage || 'Ошибка валидации данных';
        throw new Error(validationError);
      }
      
      // Для ошибок инициализации (500) возвращаем понятное сообщение
      if (response.status === 500 && errorMessage) {
        // Используем сообщение от сервера, если оно есть
        throw new Error(errorMessage);
      }
      
      // Для других ошибок возвращаем понятное сообщение
      const userFriendlyError = errorMessage || `Ошибка сервера: ${response.status}`;
      throw new Error(userFriendlyError);
    }

    let chartData: NatalChartData;
    try {
      chartData = await response.json() as NatalChartData;
    } catch (parseError: any) {
      log.error('[calculateNatalChart] Failed to parse response JSON', {
        error: parseError.message
      });
      throw new Error('Invalid response format from server');
    }

    // Валидация полученных данных
    if (!chartData || !chartData.sun) {
      log.error('[calculateNatalChart] Invalid chart data received', {
        hasData: !!chartData,
        hasSun: !!chartData?.sun
      });
      throw new Error('Invalid chart data received from server');
    }

    log.info('[calculateNatalChart] Successfully calculated natal chart', {
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      element: chartData.element
    });
    return chartData;
  } catch (error: any) {
    log.error('[calculateNatalChart] Error occurred', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Всегда пробрасываем ошибку - не используем mock данные
    throw error;
  }
};

/**
 * Get Natal Chart Introduction (новый формат вместо "трех ключей")
 */
export const getNatalIntro = async (profile: UserProfile, chartData: NatalChartData): Promise<string> => {
  const url = `${API_BASE_URL}/api/astrology/natal-intro`;
  log.info('[getNatalIntro] Starting request', { userId: profile.id });

  try {
    log.info(`[getNatalIntro] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    const duration = Date.now() - startTime;
    log.info(`[getNatalIntro] Response received in ${duration}ms`, {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getNatalIntro] Server returned error status ${response.status}`, {
        errorBody: errorText
      });
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const intro = data.intro;

    log.info('[getNatalIntro] Natal intro received', {
      introLength: intro?.length || 0
    });

    return intro;
  } catch (error: any) {
    log.error('[getNatalIntro] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    
    // Fallback
    const fallback = profile.language === 'ru' 
      ? `Привет, ${profile.name || 'друг'}! Я изучила твою натальную карту и готова рассказать о тебе много интересного.`
      : `Hi, ${profile.name || 'friend'}! I've studied your natal chart and I'm ready to tell you many interesting things.`;
    
    log.info('[getNatalIntro] Using fallback intro');
    return fallback;
  }
};

/**
 * УСТАРЕЛО: Get Three Keys (оставлено для совместимости)
 */
export const getThreeKeys = async (profile: UserProfile, chartData: NatalChartData): Promise<ThreeKeys> => {
  const url = `${API_BASE_URL}/api/astrology/three-keys`;
  log.info('[getThreeKeys] Starting request', { userId: profile.id });

  try {
    log.info(`[getThreeKeys] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    const duration = Date.now() - startTime;
    log.info(`[getThreeKeys] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getThreeKeys] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to get three keys: ${response.status} ${response.statusText}`);
    }

    const keys = await response.json() as ThreeKeys;
    log.info('[getThreeKeys] Successfully received three keys');
    return keys;
  } catch (error: any) {
    log.error('[getThreeKeys] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
};

// УДАЛЕНО: generatePersonalizedThreeKeysFallback - больше не используем fallback данные

/**
 * Краткий обзор синастрии (бесплатный) - тизер для всех пользователей
 */
export const calculateBriefSynastry = async (
  profile: UserProfile, 
  partnerName: string, 
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string
): Promise<SynastryResult> => {
  const url = `${API_BASE_URL}/api/astrology/synastry-brief`;
  log.info('[calculateBriefSynastry] Starting calculation', { partnerName, partnerDate });

  try {
    log.info(`[calculateBriefSynastry] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        language: profile.language,
        relationshipType
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateBriefSynastry] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateBriefSynastry] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate brief synastry: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SynastryResult;
    log.info('[calculateBriefSynastry] Successfully calculated brief synastry');
    return result;
  } catch (error: any) {
    log.error('[calculateBriefSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
};

/**
 * Полный анализ синастрии (премиум) - глубокий разбор для премиум пользователей
 */
export const calculateFullSynastry = async (
  profile: UserProfile, 
  partnerName: string, 
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string
): Promise<SynastryResult> => {
  const url = `${API_BASE_URL}/api/astrology/synastry-full`;
  log.info('[calculateFullSynastry] Starting calculation', { partnerName, partnerDate });

  try {
    log.info(`[calculateFullSynastry] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        language: profile.language,
        relationshipType
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateFullSynastry] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateFullSynastry] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate full synastry: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SynastryResult;
    log.info('[calculateFullSynastry] Successfully calculated full synastry');
    return result;
  } catch (error: any) {
    log.error('[calculateFullSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
};


export const getDailyHoroscope = async (profile: UserProfile, chartData: NatalChartData, context?: UserContext): Promise<DailyHoroscope> => {
  const url = `${API_BASE_URL}/api/astrology/daily-horoscope`;
  log.info('[getDailyHoroscope] Starting request', { userId: profile.id });

  try {
    log.info(`[getDailyHoroscope] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData, context })
    });

    const duration = Date.now() - startTime;
    log.info(`[getDailyHoroscope] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getDailyHoroscope] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to get daily horoscope: ${response.status} ${response.statusText}`);
    }

    const horoscope = await response.json() as DailyHoroscope;
    log.info('[getDailyHoroscope] Successfully received daily horoscope');
    return horoscope;
  } catch (error: any) {
    log.error('[getDailyHoroscope] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
};

export const updateUserEvolution = async (profile: UserProfile, chartData?: NatalChartData): Promise<UserEvolution> => {
  // If no evolution exists, initialize with personalized values based on natal chart
  if (!profile.evolution) {
    // Начальные значения зависят от натальной карты пользователя
    const initialStats = calculateInitialStats(profile, chartData);
    
    return {
      level: 1,
      title: profile.language === 'ru' ? "Искатель" : "Seeker",
      stats: initialStats,
      lastUpdated: Date.now()
    };
  }

  const currentEvo = profile.evolution;

  // Simulate growth based on usage - каждый пользователь растет по-своему
  const updatedStats = {
    intuition: Math.min(100, currentEvo.stats.intuition + Math.floor(Math.random() * 5)),
    confidence: Math.min(100, currentEvo.stats.confidence + Math.floor(Math.random() * 3)),
    awareness: Math.min(100, currentEvo.stats.awareness + Math.floor(Math.random() * 4)),
  };
  
  let newLevel = currentEvo.level;
  const avgStat = (updatedStats.intuition + updatedStats.confidence + updatedStats.awareness) / 3;
  if (avgStat > (newLevel * 30)) {
    newLevel += 1;
  }

  const titles = profile.language === 'ru' 
    ? ["Искатель", "Ученик", "Мистик", "Проводник", "Мастер"]
    : ["Seeker", "Apprentice", "Mystic", "Guide", "Master"];
  const newTitle = titles[Math.min(newLevel - 1, 4)];

  return {
    level: newLevel,
    title: newTitle,
    stats: updatedStats,
    lastUpdated: Date.now()
  };
};

// Вычисляет начальные статы на основе натальной карты пользователя
function calculateInitialStats(profile: UserProfile, chartData?: NatalChartData): { intuition: number, confidence: number, awareness: number } {
  if (!chartData) {
    // Если нет данных карты - используем случайные, но уникальные для каждого пользователя значения
    const seed = profile.name?.length || 0;
    return {
      intuition: 40 + (seed % 20),
      confidence: 40 + ((seed * 2) % 20),
      awareness: 40 + ((seed * 3) % 20)
    };
  }

  // Используем централизованные данные о знаках для избежания дублирования

  // Интуиция зависит от Луны и водных знаков
  let intuition = 50;
  const moonSign = chartData.moon?.sign;
  const moonElement = moonSign ? getElementForSign(moonSign as any) : null;
  if (moonElement === 'Water') {
    intuition += 15;
  } else if (moonElement === 'Air') {
    intuition += 10;
  }

  // Уверенность зависит от Солнца и огненных знаков
  let confidence = 50;
  const sunSign = chartData.sun?.sign;
  const sunElement = sunSign ? getElementForSign(sunSign as any) : null;
  if (sunElement === 'Fire') {
    confidence += 15;
  } else if (sunElement === 'Earth') {
    confidence += 10;
  }

  // Осознанность зависит от элемента и Меркурия
  let awareness = 50;
  const element = chartData.element;
  if (element === 'Air') {
    awareness += 15;
  } else if (element === 'Earth') {
    awareness += 12;
  } else if (element === 'Water') {
    awareness += 8;
  }

  log.info('[updateUserEvolution] Calculated personalized initial stats', {
    userId: profile.id,
    sunSign,
    moonSign,
    element,
    stats: { intuition, confidence, awareness }
  });

  return { intuition, confidence, awareness };
}



export const getDeepDiveAnalysis = async (profile: UserProfile, topic: string, chartData: NatalChartData): Promise<string> => {
  const url = `${API_BASE_URL}/api/astrology/deep-dive`;
  log.info('[getDeepDiveAnalysis] Starting request', { topic, userId: profile.id });

  try {
    log.info(`[getDeepDiveAnalysis] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, topic, chartData })
    });

    const duration = Date.now() - startTime;
    log.info(`[getDeepDiveAnalysis] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getDeepDiveAnalysis] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to get deep dive analysis: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log.info('[getDeepDiveAnalysis] Successfully received analysis');
    return data.analysis || "Stars are silent.";
  } catch (error: any) {
    log.error('[getDeepDiveAnalysis] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    const lang = profile.language === 'ru';
    return lang
      ? `Глубокий анализ по теме "${topic}" для ${profile.name}. Ваша карта показывает интересные аспекты в этой области.`
      : `Deep analysis on "${topic}" for ${profile.name}. Your chart shows interesting aspects in this area.`;
  }
};

export const chatWithAstra = async (history: { role: 'user' | 'model', text: string }[], message: string, profile: UserProfile): Promise<string> => {
  const url = `${API_BASE_URL}/api/astrology/chat`;
  log.info('[chatWithAstra] Starting chat request', {
    messageLength: message.length,
    historyLength: history.length,
    userId: profile.id
  });

  try {
    log.info(`[chatWithAstra] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        message,
        profile,
        systemInstruction: SYSTEM_INSTRUCTION_ASTRA
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[chatWithAstra] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[chatWithAstra] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to chat with Astra: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log.info('[chatWithAstra] Successfully received response', {
      responseLength: data.response?.length || 0
    });
    return data.response || "The stars are clouded.";
  } catch (error: any) {
    log.error('[chatWithAstra] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    const lang = profile.language === 'ru';
    return lang
      ? 'Звезды временно скрыты облаками. Попробуйте позже.'
      : 'The stars are temporarily clouded. Please try again later.';
  }
};
