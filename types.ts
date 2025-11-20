
export type Language = 'ru' | 'en';
export type Theme = 'dark' | 'light';

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

export interface DailyHoroscope {
  date: string;
  mood: string;
  color: string;
  number: number;
  content: string;
  moonImpact?: string; // Personalized Moon phase analysis
  transitFocus?: string; // Premium feature: Impact of today's sky on natal chart
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

export type ViewState = 'onboarding' | 'dashboard' | 'chart' | 'oracle' | 'settings' | 'admin';