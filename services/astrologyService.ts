import { UserProfile, NatalChartData, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope, ThreeKeys, SynastryResult, UserContext, UserEvolution } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";

// Helper to select language prompt
const getLangPrompt = (lang: string) => lang === 'ru' ? "Response must be in Russian." : "Response must be in English.";

// API base URL - будет использоваться для вызовов к backend API
const API_BASE_URL = process.env.DATABASE_URL ? `${process.env.DATABASE_URL}/api` : '/api';

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
  const url = `${API_BASE_URL}/astrology/natal-chart`;
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
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateNatalChart] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate natal chart: ${response.status} ${response.statusText}`);
    }

    const chartData = await response.json() as NatalChartData;
    log.info('[calculateNatalChart] Successfully calculated natal chart', {
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      element: chartData.element
    });
    return chartData;
  } catch (error: any) {
    log.error('[calculateNatalChart] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    log.warn('[calculateNatalChart] Falling back to mock data');
    // Fallback to mock data if API fails
    return generateMockNatalChart(profile);
  }
};

/**
 * Generate mock natal chart as fallback
 */
const generateMockNatalChart = (profile: UserProfile): NatalChartData => {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const randomSign = () => signs[Math.floor(Math.random() * signs.length)];
  const elements = ['Fire', 'Water', 'Air', 'Earth'];
  const planets = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Jupiter'];
  
  return {
    sun: { planet: 'Sun', sign: randomSign(), description: 'Your core essence and identity.' },
    moon: { planet: 'Moon', sign: randomSign(), description: 'Your emotional nature and inner self.' },
    rising: { planet: 'Ascendant', sign: randomSign(), description: 'Your outer personality and first impressions.' },
    mercury: { planet: 'Mercury', sign: randomSign(), description: 'Your communication style and thinking patterns.' },
    venus: { planet: 'Venus', sign: randomSign(), description: 'Your love language and values.' },
    mars: { planet: 'Mars', sign: randomSign(), description: 'Your drive and passion.' },
    element: elements[Math.floor(Math.random() * elements.length)],
    rulingPlanet: planets[Math.floor(Math.random() * planets.length)],
    summary: `This is a mystical reading for ${profile.name}. The stars reveal a complex and beautiful soul journey.`
  };
};

export const getThreeKeys = async (profile: UserProfile, chartData: NatalChartData): Promise<ThreeKeys> => {
  const url = `${API_BASE_URL}/astrology/three-keys`;
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
    log.warn('[getThreeKeys] Falling back to mock data');
    // Fallback to mock data
    return {
      key1: {
        title: profile.language === 'ru' ? 'ТВОЯ ЭНЕРГИЯ' : 'YOUR ENERGY',
        text: profile.language === 'ru' 
          ? 'Твоя уникальная энергия сочетает силу Солнца и глубину Луны.'
          : 'Your unique energy combines the strength of the Sun and the depth of the Moon.'
      },
      key2: {
        title: profile.language === 'ru' ? 'ТВОЙ СТИЛЬ ЛЮБВИ' : 'YOUR LOVE STYLE',
        text: profile.language === 'ru'
          ? 'В любви ты ищешь глубокую связь и взаимопонимание.'
          : 'In love, you seek deep connection and understanding.'
      },
      key3: {
        title: profile.language === 'ru' ? 'ТВОЯ КАРЬЕРА' : 'YOUR CAREER',
        text: profile.language === 'ru'
          ? 'Твоя карьера связана с творчеством и самовыражением.'
          : 'Your career is connected to creativity and self-expression.'
      }
    };
  }
};

export const calculateSynastry = async (profile: UserProfile, partnerName: string, partnerDate: string): Promise<SynastryResult> => {
  const url = `${API_BASE_URL}/astrology/synastry`;
  log.info('[calculateSynastry] Starting calculation', { partnerName, partnerDate });

  try {
    log.info(`[calculateSynastry] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        language: profile.language
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateSynastry] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateSynastry] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate synastry: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SynastryResult;
    log.info('[calculateSynastry] Successfully calculated synastry', {
      compatibilityScore: result.compatibilityScore
    });
    return result;
  } catch (error: any) {
    log.error('[calculateSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    log.warn('[calculateSynastry] Falling back to mock data');
    // Fallback to mock data
    const lang = profile.language === 'ru';
    return {
      compatibilityScore: Math.floor(Math.random() * 40) + 60,
      emotionalConnection: lang 
        ? 'Глубокая эмоциональная связь между вами.'
        : 'Deep emotional connection between you.',
      intellectualConnection: lang
        ? 'Интеллектуальное взаимопонимание и общие интересы.'
        : 'Intellectual understanding and shared interests.',
      challenge: lang
        ? 'Основной вызов - найти баланс между независимостью и близостью.'
        : 'Main challenge - finding balance between independence and closeness.',
      summary: lang
        ? `Синастрия между ${profile.name} и ${partnerName} показывает интересную динамику.`
        : `Synastry between ${profile.name} and ${partnerName} shows interesting dynamics.`
    };
  }
};

export const getDailyHoroscope = async (profile: UserProfile, chartData: NatalChartData, context?: UserContext): Promise<DailyHoroscope> => {
  const url = `${API_BASE_URL}/astrology/daily-horoscope`;
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
    log.warn('[getDailyHoroscope] Falling back to mock data');
    // Fallback to mock data
    const lang = profile.language === 'ru';
    return {
      date: new Date().toISOString().split('T')[0],
      mood: lang ? 'Вдохновленный' : 'Inspired',
      color: 'Purple',
      number: 7,
      content: lang
        ? 'Сегодня звезды благоприятствуют новым начинаниям.'
        : 'Today the stars favor new beginnings.',
      moonImpact: lang
        ? 'Луна в вашем знаке усиливает интуицию.'
        : 'Moon in your sign enhances intuition.',
      transitFocus: lang
        ? 'Меркурий способствует общению.'
        : 'Mercury favors communication.'
    };
  }
};

export const updateUserEvolution = async (profile: UserProfile): Promise<UserEvolution> => {
  // If no evolution exists, initialize
  const currentEvo = profile.evolution || {
    level: 1,
    title: "Seeker",
    stats: { intuition: 50, confidence: 50, awareness: 50 },
    lastUpdated: Date.now()
  };

  // Simulate growth based on usage
  const updatedStats = {
    intuition: Math.min(100, currentEvo.stats.intuition + Math.floor(Math.random() * 5)),
    confidence: Math.min(100, currentEvo.stats.confidence + Math.floor(Math.random() * 3)),
    awareness: Math.min(100, currentEvo.stats.awareness + Math.floor(Math.random() * 4)),
  };
  
  let newLevel = currentEvo.level;
  if ((updatedStats.intuition + updatedStats.confidence + updatedStats.awareness) / 3 > (newLevel * 30)) {
    newLevel += 1;
  }

  const titles = ["Seeker", "Apprentice", "Mystic", "Guide", "Master"];
  const newTitle = titles[Math.min(newLevel - 1, 4)];

  return {
    level: newLevel,
    title: newTitle,
    stats: updatedStats,
    lastUpdated: Date.now()
  };
};

export const getWeeklyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<WeeklyHoroscope> => {
  const url = `${API_BASE_URL}/astrology/weekly-horoscope`;
  log.info('[getWeeklyHoroscope] Starting request', { userId: profile.id });

  try {
    log.info(`[getWeeklyHoroscope] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    const duration = Date.now() - startTime;
    log.info(`[getWeeklyHoroscope] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getWeeklyHoroscope] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to get weekly horoscope: ${response.status} ${response.statusText}`);
    }

    const horoscope = await response.json() as WeeklyHoroscope;
    log.info('[getWeeklyHoroscope] Successfully received weekly horoscope');
    return horoscope;
  } catch (error: any) {
    log.error('[getWeeklyHoroscope] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    log.warn('[getWeeklyHoroscope] Falling back to mock data');
    // Fallback to mock data
    const lang = profile.language === 'ru';
    return {
      weekRange: `${new Date().toLocaleDateString()} - ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      theme: lang ? 'Новые возможности' : 'New Opportunities',
      advice: lang ? 'Эта неделя принесет важные изменения.' : 'This week will bring important changes.',
      love: lang ? 'В отношениях наступит период гармонии.' : 'A period of harmony in relationships.',
      career: lang ? 'Профессиональный рост ожидается.' : 'Professional growth is expected.'
    };
  }
};

export const getMonthlyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<MonthlyHoroscope> => {
  const url = `${API_BASE_URL}/astrology/monthly-horoscope`;
  log.info('[getMonthlyHoroscope] Starting request', { userId: profile.id });

  try {
    log.info(`[getMonthlyHoroscope] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    const duration = Date.now() - startTime;
    log.info(`[getMonthlyHoroscope] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[getMonthlyHoroscope] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to get monthly horoscope: ${response.status} ${response.statusText}`);
    }

    const horoscope = await response.json() as MonthlyHoroscope;
    log.info('[getMonthlyHoroscope] Successfully received monthly horoscope');
    return horoscope;
  } catch (error: any) {
    log.error('[getMonthlyHoroscope] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    log.warn('[getMonthlyHoroscope] Falling back to mock data');
    // Fallback to mock data
    const lang = profile.language === 'ru';
    const month = new Date().toLocaleString(lang ? 'ru' : 'en', { month: 'long' });
    return {
      month,
      theme: lang ? 'Трансформация' : 'Transformation',
      focus: lang ? 'Личностный рост и развитие' : 'Personal growth and development',
      content: lang
        ? `Этот месяц ${month} принесет важные изменения в вашей жизни.`
        : `This ${month} will bring important changes to your life.`
    };
  }
};

export const getDeepDiveAnalysis = async (profile: UserProfile, topic: string, chartData: NatalChartData): Promise<string> => {
  const url = `${API_BASE_URL}/astrology/deep-dive`;
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
  const url = `${API_BASE_URL}/astrology/chat`;
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
