/**
 * AI Prompts для Астры
 * 
 * Этот файл содержит все промпты для генерации астрологических интерпретаций
 * через AI (OpenAI, Gemini, Claude и т.д.)
 */


/**
 * FREE natal intro — hook, «это про меня», желание читать дальше
 * Максимум 1–2 астрологических термина. Фокус на сильном, читаемом, личном тексте.
 */
export const addLanguageInstruction = (prompt: string, language: 'ru' | 'en'): string => {
  if (language === 'en') {
    return prompt + '\n\n**LANGUAGE: Write in English only.**';
  }
  return prompt + '\n\n**ЯЗЫК: Пиши только на русском.**';
};

/**
 * Промпт для полной интерпретации натальной карты по блокам
 * 
 * Используется когда человек нажимает «Узнать больше» и попадает в подробный разбор.
 */
export interface DailyForecastV2AIResponse {
  headline: string;
  summary: string;
  chance: string;
  risk: string;
  focus: string;
  reading: string;
  context: string;
  advice: string[];
}

export interface DaypartForecastAIResponse {
  headline: string;
  summary: string;
  focus: string;
  relationships: string;
  money: string;
  guidance: string;
  risk?: string;
  chartReason?: string;
}

export interface WeeklyForecastAIResponse {
  theme: string;
  advice: string;
  love: string;
  career: string;
}

export interface MonthlyForecastAIResponse {
  theme: string;
  focus: string;
  content: string;
}









export interface SynastryAIResponse {
  compatibilityScore: number;
  emotionalConnection: string;
  intellectualConnection: string;
  challenge: string;
  summary: string;
}

export interface BriefSynastryAIResponse {
  introduction: string;
  harmony: string;
  challenges: string;
  tips: string[];
}

export interface FullSynastryAIResponse {
  generalTheme: string;
  attraction: string;
  difficulties: string;
  recommendations: string[];
  potential: string;
}

export interface ExtendedSynastryAIResponse {
  summary: string;
  connection: string;
  tension: string;
  navigation: string;
  bondContext: string;
  compatibilityScore?: number;
}

/** Content v2: free weekly (короткий разбор). */
export interface FreeWeeklyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
}

/** Content v2: premium weekly (полный разбор). */
export interface PremiumWeeklyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
  theme: string;
  opportunities: string;
  challenges: string;
  relationships: string;
  career: string;
  guidance: string;
  reading: string;
}

export interface FreeMonthlyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
}

export interface PremiumMonthlyForecastV2AIResponse {
  headline: string;
  summary: string;
  focus: string;
  theme: string;
  opportunities: string;
  challenges: string;
  relationships: string;
  money: string;
  guidance: string;
  reading: string;
}

