/**
 * AI Prompts для Астры
 * 
 * Этот файл содержит все промпты для генерации астрологических интерпретаций
 * через AI (OpenAI, Gemini, Claude и т.д.)
 */

import { AstroEvidenceItem, NatalChartData, NatalHumanSection, UserProfile } from "../types";

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

export interface NatalAnchorAIResponse {
  headline: string;
  lead: string;
  sections: NatalHumanSection[];
  dictionaryTerms: Array<{ term: string; meaning: string }>;
  astroEvidence?: AstroEvidenceItem[];
}

export interface NatalLivingAIResponse {
  periodKey: string;
  headline: string;
  summary: string;
  whyToday: string;
  situations: Array<{ title: string; body: string; evidenceIds?: string[] }>;
  relationships: string;
  workMoney: string;
  evening: string;
  questionOfDay: string;
  astroEvidence?: AstroEvidenceItem[];
}

export interface NatalFullAIResponse {
  headline: string;
  lead: string;
  sections: NatalHumanSection[];
  synthesis: string;
  astroEvidence?: AstroEvidenceItem[];
}

export interface PlanetInsightAIResponse {
  title: string;
  body: string;
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









function natalEvidenceJson(evidence: AstroEvidenceItem[] | undefined) {
  return JSON.stringify((evidence || []).slice(0, 8), null, 2);
}

import { getNatalAstrologySystemPrompt } from './voice/contracts/natal';
import { getNatalAstrologyExamples } from './voice/examples';

function natalTaskRules(language: string) {
  const lang: 'ru' | 'en' = language === 'ru' ? 'ru' : 'en';
  return `${getNatalAstrologySystemPrompt(lang)}

Task rules:
- Every section must clearly come from astroEvidence: planet/sign/house/aspect/transit -> human translation -> concrete life situation.
- Use only facts present in astroEvidence and the chart JSON. If a fact is not present, do not invent it.
- Do not greet the user and do not open with the user's name.
- Do not use internal product words: free, premium, layer, unlock, upsell, sale, trial, "бесплатный", "премиум", "слой", "живой слой", "твоя основа", "опорная карта".
- No medical, legal, or financial advice. For money/work, speak about state, focus, pressure, and decision hygiene.
- Short paragraphs. No emoji. No decorative symbols.
- Tie every statement to specific chart facts.`;
}

export const createNatalAnchorPromptV3 = (
  natalData: NatalChartData,
  profile: UserProfile,
  astroEvidence: AstroEvidenceItem[] = []
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const evidenceJson = natalEvidenceJson(astroEvidence);

  return `${natalTaskRules(profile.language)}

Task: create the canonical natal reading in a human planet-by-planet format.

This is a complete first reading, not a teaser. Ground it in planets, signs, houses, and aspects.

astroEvidence:
${evidenceJson}

Natal chart JSON:
${natalDataJson}

Required JSON shape:
{
  "headline": "max 80 chars",
  "lead": "1-2 sentences with the overall conclusion from the chart",
  "sections": [
    {
      "id": "character",
      "title": "Характер / localized equivalent",
      "subtitle": "short subtitle with placement, e.g. Солнце в Рыбах · 4 дом",
      "body": "2-4 short paragraphs. Must include astro source -> human meaning -> concrete life example.",
      "examples": ["exactly 2 short life examples"],
      "astroSource": "one compact plain-language astro source line",
      "evidenceIds": ["placement:sun", "aspect:sun:..."]
    }
  ],
  "dictionaryTerms": [
    { "term": "Sun/Moon/Rising/House/Aspect localized", "meaning": "plain-language meaning" }
  ],
  "astroEvidence": ${evidenceJson}
}

Rules for sections:
- exactly 6 sections in this order: character, emotions, first-impression, thoughts, love, action.
- section titles should be human, localized, and not theoretical.
- every section must include at least one concrete life example and at least one evidence id.
- do not repeat the same thesis between sections.
- do not explain astrology theory.

Rules for arrays:
- dictionaryTerms: 5-7.

Return only valid JSON.`;
};

export const createNatalFullPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  astroEvidence: AstroEvidenceItem[] = []
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const evidenceJson = natalEvidenceJson(astroEvidence);

  return `${natalTaskRules(profile.language)}

Task: create the canonical full natal personality interpretation in a human planet-by-planet format.

This is more detailed than the base reading. It must not repeat the base text. It should connect chart facts into behavior: how the person reacts, chooses, speaks, loves, acts, handles money, builds closeness, and what usually becomes difficult under pressure.

astroEvidence:
${evidenceJson}

Natal chart JSON:
${natalDataJson}

Required JSON shape:
{
  "headline": "max 80 chars",
  "lead": "1-2 sentences about what makes this chart recognizable",
  "sections": [
    {
      "id": "character",
      "title": "localized human section title",
      "subtitle": "compact placement line",
      "body": "2-4 short paragraphs",
      "examples": ["exactly 3 short life examples"],
      "astroSource": "compact astro source line",
      "evidenceIds": ["..."]
    }
  ],
  "synthesis": "2-3 short paragraphs tying the chart together without repeating all sections",
  "astroEvidence": ${evidenceJson}
}

Rules for sections:
- exactly 9 sections in this order: character, emotions, first-impression, thoughts-speech, love, action, money-stability, intimacy, when-hard.
- every section must include at least one explicit astrological source from astroEvidence and one concrete life example.
- do not use titles about power, tension, layers, lessons, or daily forecast.
- do not explain astrology theory.
- do not repeat the same sentence idea across sections.

Return only valid JSON.`;
};

export const createNatalLivingPromptV3 = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  transits?: any,
  astroEvidence: AstroEvidenceItem[] = []
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const evidenceJson = natalEvidenceJson(astroEvidence);

  return `${natalTaskRules(profile.language)}

Period: ${periodKey}

Task: create today's personal natal reading from real transit evidence.

Important:
- Use only astroEvidence for "why today".
- If astroEvidence contains no transit, be transparent and base the reading on the strongest natal facts plus today's general transits. Do not pretend there is a personal transit.
- The reading must not sound like a generic horoscope. It should name the actual transit/aspect/placement, then translate it into a concrete human situation.

astroEvidence:
${evidenceJson}

Current transits JSON:
${transitsJson}

Natal chart JSON:
${natalDataJson}

Required JSON shape:
{
  "periodKey": "${periodKey}",
  "headline": "max 80 chars",
  "summary": "1-2 sentences with the main factual reason for today",
  "whyToday": "2-4 paragraphs. Must name the exact transit/aspect/placement from astroEvidence and explain how it may appear in real life.",
  "situations": [
    { "title": "In conversation / В разговоре", "body": "specific scenario tied to evidence", "evidenceIds": ["..."] },
    { "title": "In work / В делах", "body": "specific scenario tied to evidence", "evidenceIds": ["..."] },
    { "title": "Inside yourself / Внутри себя", "body": "specific scenario tied to evidence", "evidenceIds": ["..."] }
  ],
  "relationships": "2-3 sentences about communication and closeness today, tied to evidence",
  "workMoney": "2-3 sentences about work/money state and focus, no financial advice",
  "evening": "2-3 sentences about what to review or release by evening",
  "questionOfDay": "one concrete self-observation question",
  "astroEvidence": ${evidenceJson}
}

Return only valid JSON.`;
};

export const createPlanetInsightPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  options: {
    planetLabel: string;
    planetSign: string;
    planetDegree: number | null;
    house: number | null;
    anchorSummary: string;
  }
): string => {
  const natalDataJson = JSON.stringify(
    {
      sun: natalData.sun,
      moon: natalData.moon,
      rising: natalData.rising,
      target: {
        planet: options.planetLabel,
        sign: options.planetSign,
        degree: options.planetDegree,
        house: options.house,
      },
    },
    null,
    2
  );
  const displayName = profile.name || 'the user';

  const lang: 'ru' | 'en' = profile.language === 'ru' ? 'ru' : 'en';

  const genderInstruction = profile.gender === 'male' ? (lang === 'ru' ? 'Пол пользователя: мужской (используй мужской род).' : 'User gender: male (use male pronouns).')
    : profile.gender === 'female' ? (lang === 'ru' ? 'Пол пользователя: женский (используй женский род).' : 'User gender: female (use female pronouns).')
    : (lang === 'ru' ? 'Пол пользователя: не указан (строй текст нейтрально, чтобы не угадывать род).' : 'User gender: unspecified (write gender-neutrally).');

  const examples = getNatalAstrologyExamples(lang);
  const examplesBlock = examples ? `\n\n## EXAMPLES\n${examples}` : '';

  return `${getNatalAstrologySystemPrompt(lang)}
${genderInstruction}${examplesBlock}

User: ${displayName}

Core chart anchors:
${natalDataJson}

Reference summary:
${options.anchorSummary}

Task: write a short personal natal insight for one placement in the app's dashboard insight panel.

Rules:
- Explain what ${options.planetLabel} in ${options.planetSign}${options.house ? ` in house ${options.house}` : ''} means in this person's life.
- Use second-person language: you / your.
- Include a recognizable emotional or daily-life example tied to the placement.
- No long astrology lectures.
- No bullet lists.
- Keep the body to 2-3 sentences.

Return strict JSON with:
- title: a short title for this placement, max 70 chars
- body: 2-3 sentences, compact but meaningful

Return only JSON.`;
};

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

