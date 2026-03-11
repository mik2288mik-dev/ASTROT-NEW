
export type Language = 'ru' | 'en';
export type Theme = 'dark' | 'light';

export interface UserEvolution {
  level: number;
  title: string; // e.g. "Seeker", "Awakened", "Master"
  stats: {
    intuition: number; // 0-100
    confidence: number;
    awareness: number;
  };
  lastUpdated: number;
}

export interface UserContext {
  weather?: string; // e.g. "Rainy", "Sunny"
  weatherData?: {
    condition: string; // e.g. "Rainy", "Sunny"
    temp: number; // Температура в градусах Цельсия
    humidity: number; // Влажность в процентах
    city: string; // Название города
    moonPhase?: {
      phase: string; // Фаза луны
      illumination: number; // Освещенность в процентах
    };
  };
  moonPhase?: {
    phase: string; // Фаза луны
    illumination: number; // Освещенность в процентах
  };
  socialProof?: string; // e.g. "87% of Scorpios..."
  mood?: string; // e.g. "Anxious", "Excited" (detected from chat)
}

export interface UserProfile {
  id?: string; // Telegram ID
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM
  birthPlace: string;
  isSetup: boolean;
  language: Language;
  theme: Theme; 
  isPremium: boolean; 
  isAdmin?: boolean;
  evolution?: UserEvolution;
  lastContext?: UserContext;
  starsBalance?: number; // Баланс звёзд для платных регенераций
  weatherCity?: string; // Город для погоды (например, "Moscow" или "Москва")
  
  // Все генерации пользователя (кэшируются)
  generatedContent?: UserGeneratedContent;
}

export enum ZodiacSign {
  Aries = "Aries",
  Taurus = "Taurus",
  Gemini = "Gemini",
  Cancer = "Cancer",
  Leo = "Leo",
  Virgo = "Virgo",
  Libra = "Libra",
  Scorpio = "Scorpio",
  Sagittarius = "Sagittarius",
  Capricorn = "Capricorn",
  Aquarius = "Aquarius",
  Pisces = "Pisces"
}

export interface PlanetPosition {
  planet: string;
  sign: string;
  house?: string;
  description: string;
}

export interface NatalChartData {
  sun: PlanetPosition;
  moon: PlanetPosition;
  rising: PlanetPosition; 
  mercury: PlanetPosition | null;
  venus: PlanetPosition | null;
  mars: PlanetPosition | null;
  
  // New Personalization Fields
  element: string; // Fire, Water, Air, Earth
  rulingPlanet: string; // e.g. Mars for Aries
  
  summary: string; 
  keywords?: {
    love: string;
    career: string;
    karma: string;
  }
}

// Полное хранилище всех генераций пользователя
export interface UserGeneratedContent {
  // НОВОЕ: Вступление натальной карты (бесплатное)
  natalIntro?: string;
  
  // Гороскопы (обновляются по расписанию)
  dailyHoroscope?: DailyHoroscope;
  weeklyHoroscope?: WeeklyHoroscope;
  monthlyHoroscope?: MonthlyHoroscope;
  
  // Deep Dive анализы - полные секции натальной карты (премиум)
  deepDiveAnalyses?: {
    personality?: string;    // Личность и характер
    love?: string;          // Любовь и отношения
    career?: string;        // Карьера и самореализация
    weakness?: string;      // Зоны роста и вызовы
    karma?: string;         // Кармическая задача
  };
  
  // История синастрий (кэшируется по партнерам)
  synastries?: {
    [partnerId: string]: {
      partnerName: string;
      partnerDate: string;
      briefResult?: SynastryResult;
      fullResult?: SynastryResult;
      timestamp: number;
    };
  };
  
  // Временные метки для обновления
  timestamps: {
    natalIntroGenerated?: number;
    dailyHoroscopeGenerated?: number;
    weeklyHoroscopeGenerated?: number;
    monthlyHoroscopeGenerated?: number;
    deepDiveGenerated?: number;
  };
}

export interface SynastryResult {
  compatibilityScore?: number; // 0-100 (опционально для краткого режима)
  
  // Краткий режим (бесплатный) - тизер
  briefOverview?: {
    introduction: string; // 1 абзац - кто кому как ощущается
    harmony: string; // что гармонично и естественно
    challenges: string; // где могут быть недопонимания
    tips: string[]; // 3-4 подсказки как лучше обходиться друг с другом
  };
  
  // Полный режим (премиум) - глубокий разбор
  fullAnalysis?: {
    generalTheme: string; // Общая тема связи (1-2 абзаца)
    attraction: string; // Что притягивает (2-3 абзаца)
    difficulties: string; // Где могут быть сложности (2-3 абзаца)
    recommendations: string[]; // 3-6 конкретных рекомендаций
    potential: string; // Потенциал отношений (1-3 абзаца)
  };
  
  // Общие поля (для обратной совместимости)
  emotionalConnection?: string;
  intellectualConnection?: string;
  challenge?: string;
  summary: string;
}

export interface DailyHoroscope {
  date: string;
  mood: string;
  color: string;
  number: number;
  content: string;
  moonImpact?: string; 
  transitFocus?: string; 
}

export interface WeeklyHoroscope {
  weekRange: string;
  theme: string;
  advice: string;
  love?: string; 
  career?: string; 
}

export interface MonthlyHoroscope {
  month: string;
  theme: string;
  focus: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ViewState = 'onboarding' | 'hook' | 'paywall' | 'dashboard' | 'my-cards' | 'chart' | 'horoscope' | 'synastry' | 'oracle' | 'settings' | 'admin';

// Cached text types
export interface CachedText<T = any> {
  data: T;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}

// Regeneration types
export type ContentType = 'natal_summary' | 'full_natal' | 'synastry' | 'forecast' | 'natal_intro';

export interface RegenerationLimits {
  canRegenerate: boolean;
  isFree: boolean;
  costInStars: number;
  regenerationsToday: number;
  message?: string;
}

export interface RegenerationRequest {
  userId: string;
  contentType: ContentType;
}

export interface RegenerationResponse {
  success: boolean;
  data?: any;
  error?: string;
  newBalance?: number;
}

// MVP types
export interface UserBalanceResponse {
  balance: number;
  is_premium: boolean;
  premium_expires_at: string | null;
}

export interface Card {
  id: number;
  user_id: string;
  name: string;
  birth_date: string;
  birth_time: string | null;
  birth_place: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  data_json: any;
  is_purchased_full: boolean;
  is_purchased_pro: boolean;
  created_at: string;
}

export interface Purchase {
  id: number;
  user_id: string;
  type: string;
  amount_lumi: number | null;
  real_currency: string | null;
  real_amount: number | null;
  item_id: string | null;
  status: string;
  created_at: string;
}

export interface Referral {
  id: number;
  referrer_id: string;
  referred_id: string;
  bonus_given: boolean;
  created_at: string;
}

export interface NatalPlanetShort {
  sign: string;
  degree: number;
  retrograde?: boolean;
  description_short?: string;
}

export interface NatalChartApiResponse {
  success: boolean;
  data: {
    sun: NatalPlanetShort;
    moon: NatalPlanetShort;
    ascendant: { sign: string; degree: number; description_short?: string } | null;
    mercury: { sign: string; degree: number; retrograde?: boolean };
    venus: { sign: string; degree: number; retrograde?: boolean };
    mars: { sign: string; degree: number; retrograde?: boolean };
    jupiter?: { sign: string; degree: number; retrograde?: boolean } | null;
    saturn?: { sign: string; degree: number; retrograde?: boolean } | null;
    uranus?: { sign: string; degree: number; retrograde?: boolean } | null;
    neptune?: { sign: string; degree: number; retrograde?: boolean } | null;
    pluto?: { sign: string; degree: number; retrograde?: boolean } | null;
  };
  houses_available: boolean;
  message?: string;
}