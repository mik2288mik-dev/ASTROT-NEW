import { UserProfile, NatalChartData, DailyHoroscope, WeeklyHoroscope, MonthlyHoroscope, ThreeKeys, SynastryResult, UserContext, UserEvolution } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";

// Helper to select language prompt
const getLangPrompt = (lang: string) => lang === 'ru' ? "Response must be in Russian." : "Response must be in English.";

// API base URL - будет использоваться для вызовов к backend API
const API_BASE_URL = process.env.DATABASE_URL ? `${process.env.DATABASE_URL}/api` : '/api';

/**
 * Calculate natal chart - calls backend API
 */
export const calculateNatalChart = async (profile: UserProfile): Promise<NatalChartData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/natal-chart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        birthPlace: profile.birthPlace,
        language: profile.language
      })
    });

    if (!response.ok) {
      throw new Error('Failed to calculate natal chart');
    }

    return await response.json() as NatalChartData;
  } catch (error) {
    console.error('Error calculating natal chart:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/three-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    if (!response.ok) {
      throw new Error('Failed to get three keys');
    }

    return await response.json() as ThreeKeys;
  } catch (error) {
    console.error('Error getting three keys:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/synastry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        language: profile.language
      })
    });

    if (!response.ok) {
      throw new Error('Failed to calculate synastry');
    }

    return await response.json() as SynastryResult;
  } catch (error) {
    console.error('Error calculating synastry:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/daily-horoscope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData, context })
    });

    if (!response.ok) {
      throw new Error('Failed to get daily horoscope');
    }

    return await response.json() as DailyHoroscope;
  } catch (error) {
    console.error('Error getting daily horoscope:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/weekly-horoscope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    if (!response.ok) {
      throw new Error('Failed to get weekly horoscope');
    }

    return await response.json() as WeeklyHoroscope;
  } catch (error) {
    console.error('Error getting weekly horoscope:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/monthly-horoscope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData })
    });

    if (!response.ok) {
      throw new Error('Failed to get monthly horoscope');
    }

    return await response.json() as MonthlyHoroscope;
  } catch (error) {
    console.error('Error getting monthly horoscope:', error);
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
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/deep-dive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, topic, chartData })
    });

    if (!response.ok) {
      throw new Error('Failed to get deep dive analysis');
    }

    const data = await response.json();
    return data.analysis || "Stars are silent.";
  } catch (error) {
    console.error('Error getting deep dive analysis:', error);
    const lang = profile.language === 'ru';
    return lang
      ? `Глубокий анализ по теме "${topic}" для ${profile.name}. Ваша карта показывает интересные аспекты в этой области.`
      : `Deep analysis on "${topic}" for ${profile.name}. Your chart shows interesting aspects in this area.`;
  }
};

export const chatWithAstra = async (history: { role: 'user' | 'model', text: string }[], message: string, profile: UserProfile): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/astrology/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        message,
        profile,
        systemInstruction: SYSTEM_INSTRUCTION_ASTRA
      })
    });

    if (!response.ok) {
      throw new Error('Failed to chat with Astra');
    }

    const data = await response.json();
    return data.response || "The stars are clouded.";
  } catch (error) {
    console.error('Error chatting with Astra:', error);
    const lang = profile.language === 'ru';
    return lang
      ? 'Звезды временно скрыты облаками. Попробуйте позже.'
      : 'The stars are temporarily clouded. Please try again later.';
  }
};
