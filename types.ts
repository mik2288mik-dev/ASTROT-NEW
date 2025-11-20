
export type Language = 'ru' | 'en';
export type Theme = 'dark' | 'light';

export interface ThreeKeys {
  key1: { title: string; text: string; }; // Energy
  key2: { title: string; text: string; }; // Love
  key3: { title: string; text: string; }; // Career
}

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
  threeKeys?: ThreeKeys;
  evolution?: UserEvolution;
  lastContext?: UserContext;
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
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  
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

export interface SynastryResult {
  compatibilityScore: number; // 0-100
  emotionalConnection: string;
  intellectualConnection: string;
  challenge: string;
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

export type ViewState = 'onboarding' | 'hook' | 'paywall' | 'dashboard' | 'chart' | 'synastry' | 'oracle' | 'settings' | 'admin';