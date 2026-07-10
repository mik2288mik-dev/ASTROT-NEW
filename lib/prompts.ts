/**
 * AI Prompts для Астры
 * 
 * Этот файл содержит все промпты для генерации астрологических интерпретаций
 * через AI (OpenAI, Gemini, Claude и т.д.)
 */

import { AstroEvidenceItem, NatalChartData, NatalHumanSection, UserProfile } from "../types";
import { getAppSystemVoice } from "./appVoice";

/**
 * Глобальный SYSTEM-слой для всех интерпретаций = ЕДИНЫЙ голос приложения
 * (lib/appVoice.ts, из docs/APP_VOICE.md). Отдельного тона у Астры больше нет —
 * голос описан в одном месте; task-промпты ниже только добавляют свою задачу поверх.
 */
export const SYSTEM_PROMPT_APP = getAppSystemVoice('ru');

/**
 * Языкозависимый SYSTEM-голос. Предпочтительнее захардкоженной ru-константы
 * SYSTEM_PROMPT_APP: EN-генерации должны получать англоязычный голос, иначе
 * модель видит русский system при английском задании. Используй в местах, где
 * известен язык пользователя.
 */
export const getAppSystemPrompt = (language: 'ru' | 'en'): string => getAppSystemVoice(language);

/**
 * FREE natal intro — hook, «это про меня», желание читать дальше
 * Максимум 1–2 астрологических термина. Фокус на сильном, читаемом, личном тексте.
 */
export const addLanguageInstruction = (prompt: string, language: 'ru' | 'en'): string => {
  if (language === 'en') {
    return prompt + '\n\n**LANGUAGE: Write in English only.** Use natural, fluent English as if native. Avoid a translated feel. The tone (warm, precise, personal, soft) must work in English.';
  }
  return prompt + '\n\n**ЯЗЫК: Пиши только на русском.** Используй естественный, живой русский как родной. Избегай ощущения перевода. Тон (тёплый, точный, личный, мягкий) должен сохраняться.';
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

export const createDailyForecastV2Prompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  currentDate: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Current date: ${currentDate}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: create a serious personal daily forecast.

Rules:
- Speak to the user as a real person, not as a zodiac sign.
- The result must feel personal, emotionally precise, modern, and useful.
- Focus on emotions, relationships, money, decisions, pressure, opportunity, and direction.
- This free daily flow contains two layers inside one response:
  1) a short daily horoscope layer in headline / summary / chance / risk / focus
  2) a free daily natal card layer in reading / context / advice
- This is the free daily layer: one coherent reading for the whole day. Do not split the day into morning/day/evening here — that is reserved for premium.
- The user should feel "yes, this is exactly what my day feels like."
- Free layer should already help, not tease. But do not try to map every nuance, every scenario, or every part of the day — richer situational detail belongs to premium.
- The daily natal card part should mix the user's inner background with a few recognizable moments or triggers the day may bring.
- No mystical fluff.
- No "color of the day", "number of the day", moon gimmicks, or decorative astrology.
- No vague filler. Be concrete and human.
- Free layer should still feel valuable and real.

Return strict JSON with these fields:
- headline: one strong personal line for today, max 90 chars
- summary: 1-2 sentences explaining the tone of the day like a short horoscope
- chance: one practical opening of the day
- risk: one practical risk of the day
- focus: one clear focus for the day
- reading: 2-4 short paragraphs separated by "\\n\\n" as a free daily natal card for today
- context: 1-2 sentences explaining what is being activated today through the natal chart and current influences
- advice: exactly 3 short practical strings

Return only JSON.`;
};

export const createDaypartForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  currentDate: string,
  slot: 'morning' | 'day' | 'evening',
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';
  const genderNote = profile.gender === 'male'
    ? 'мужской — пиши в мужском роде'
    : profile.gender === 'female'
      ? 'женский — пиши в женском роде'
      : 'не указан — пиши нейтрально, не выдавай пол';

  return `Current date: ${currentDate}
Time slot: ${slot}

User: ${displayName}
Language: ${profile.language}
Пол пользователя: ${genderNote}.

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: create a premium-quality personal forecast for this specific part of the day.

Rules:
- This is the full daily reading used by Premium. It must feel meaningfully stronger than the free daily reading through richer nuance, sharper situational precision, and a clearer sense of what is happening in real life.
- It should feel close to the user's real state, decisions, relationships, money, and tension points in this exact part of the day.
- Explicitly differ from a single-day summary: this slice is about how the day *feels and behaves* in this part of the day (energy, social tone, practical risk, inner tempo).
- Treat it like a full daily natal card segment: mix the user's inner state with concrete situations, triggers, and moments that may surface in this slot.
- When relevant, surface one concrete scenario or behavioral pattern the user may actually run into in this slot.
- Keep it personal, emotionally accurate, modern, and composed.
- No mystical fluff, no gimmicks, no vague empty reassurance.
- The text should feel like a calm personal consultation, not a generic horoscope.
- Use the slot (${slot}) to change the rhythm and practical emphasis.

Return strict JSON with these fields:
- headline: one strong slot-specific line, max 90 chars
- summary: 1-2 sentences for this part of the day
- focus: the main thing to hold today in this slot
- relationships: short guidance for closeness, communication, or emotional contact
- money: short guidance for work, money, or practical decisions
- guidance: 1-2 sentences with the action of the day
- risk: one short concrete risk of the day
- chartReason: one short plain-language reason based on the natal chart and current transits

Return only JSON.`;
};

export const createNatalAnchorPrompt = (
  natalData: NatalChartData,
  profile: UserProfile
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const displayName = profile.name || 'the user';

  return `User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Task: create the user's natal chart reading.

Rules:
- This is the first complete natal reading a user sees. It must feel valuable on its own.
- It must feel personal, emotionally accurate, modern, and grounded in real natal calculation.
- The user should immediately feel "this is about me", not just "this sounds nice".
- Explain the person, not astrology mechanics.
- Focus on character, emotional habits, first impression, strengths, decision style, and what is worth noticing.
- Include recognizable everyday examples inside the reading: choices, closeness, conflict, rhythm, self-perception.
- No mystical fluff, no fate spam, no empty praise, no cheap sales language.
- No long lists of planets/houses/aspects. Translate the chart into human language.
- Do not greet the user. Do not write "hello", "hi", "привет", or the user's name as an opener.
- Do not use user-facing internal words: free, premium, layer, unlock, upsell, sale, trial, "бесплатный", "премиум", "слой", "живой слой", "твоя основа", "опорная карта".
- Follow the app voice: no mystical, fatalistic, or bureaucratic wording.
- Keep language human and mature. No slang, no theatrical phrasing, no astrological conspiracy wording.

Return strict JSON with these fields:
- headline: one strong user-facing title, max 80 chars
- summary: 1-2 quiet sentences explaining the overall tone of the chart
- reading: 5-7 short paragraphs separated by "\\n\\n"; no greeting and no name opener
- threeAnchors: exactly 3 objects with title/body. Titles must be Sun/Moon/Rising in the response language; bodies explain them as human roles: character, emotions, first impression.
- perceivedByOthers: 2-3 sentences about how people usually read this person and what they may misunderstand.
- strengths: exactly 3 short observations with life examples.
- watchouts: exactly 3 soft warnings without drama.
- dictionaryTerms: 5-7 objects with term/meaning. Explain simple terms such as Sun, Moon, Rising, Sign, Aspect, House in everyday language.

Return only JSON.`;
};

export const createNatalLivingPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Period: ${periodKey}
User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits and live influences:
${transitsJson}

Task: create today's personal natal reading.

Rules:
- This is a fuller daily reading inside the user's natal chart. It should feel precise, useful, and current.
- Explain what is activated right now and how it may show up in real life today.
- Focus on today's personal rhythm, concrete situations, relationships, work/money state, evening decompression, one repeating pattern, and one honest question.
- Show how this period may affect choices, closeness, work rhythm, confidence, or pressure points with recognizable examples.
- Be personal, emotionally precise, serious, modern, and useful.
- No mystical fluff, no vague filler, no decorative astrology language.
- Write like a calm, intelligent personal guide, not a therapist and not a fortune-teller.
- Do not greet the user. Do not open with the user's name.
- Do not use user-facing internal words: free, premium, layer, unlock, upsell, sale, trial, "бесплатный", "премиум", "слой", "живой слой", "твоя основа", "опорная карта".
- Do not give medical, legal, or financial instructions. For work/money, speak about state, focus, pressure, and decision hygiene.

Return strict JSON with these fields:
- headline: one strong title for today, max 80 chars
- summary: 1-2 sentences on today's tone
- fullPersonality: 4-6 short paragraphs about how this person lives, reacts, chooses, and builds contact. This is a fuller but still readable personality interpretation.
- today: 2-4 short paragraphs about what is activated today.
- daySituations: exactly 3 objects with title/body. Titles should be concrete, e.g. "In conversation", "In work", "Inside yourself" / "В разговоре", "В делах", "Внутри себя".
- relationshipsToday: 2-3 sentences on how to communicate today, where not to guess, where to ask directly.
- workMoneyToday: 2-3 sentences about focus, state, decisions, anxiety, and practical rhythm. No financial advice.
- evening: 2-3 sentences about what to release or understand by evening.
- repeatingScenario: 2-3 sentences about one pattern especially worth seeing now.
- questionOfDay: one honest question for self-observation.

Return only JSON.`;
};

const NATAL_EDITORIAL_BANNED = [
  'это читается через',
  'может проявляться',
  'здесь описывается',
  'полезно проверить',
  'тема связана с',
  'день просит',
  'внутренняя точность',
  'чужой шум',
  'выбрать из ясности',
  'пространство',
  'слой',
  'премиум',
  'day asks',
  'inner precision',
  'outside noise',
  'choose from clarity',
];

function natalEvidenceJson(evidence: AstroEvidenceItem[] | undefined) {
  return JSON.stringify((evidence || []).slice(0, 8), null, 2);
}

function natalEditorialRules(language: string) {
  return `Language: ${language}

Editorial standard:
- Write as an astrologer-editor, not as a motivational quote generator.
- Every section must clearly come from astroEvidence: planet/sign/house/aspect/transit -> human translation -> concrete life situation -> soft orientation.
- Use only facts present in astroEvidence and the chart JSON. If a fact is not present, do not invent it.
- Do not greet the user and do not open with the user's name.
- Do not use internal product words: free, premium, layer, unlock, upsell, sale, trial, "бесплатный", "премиум", "слой", "живой слой", "твоя основа", "опорная карта".
- Follow the app voice: no fatalistic, mystical, or bureaucratic wording.
- Avoid these exact empty formulas: ${NATAL_EDITORIAL_BANNED.map((item) => `"${item}"`).join(', ')}.
- No medical, legal, or financial advice. For money/work, speak about state, focus, pressure, and decision hygiene.
- Short paragraphs. No emoji. No decorative symbols.
- The text should feel personal because the chart facts are specific, not because it uses vague intimacy.`;
}

export const createNatalAnchorPromptV3 = (
  natalData: NatalChartData,
  profile: UserProfile,
  astroEvidence: AstroEvidenceItem[] = []
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const evidenceJson = natalEvidenceJson(astroEvidence);

  return `${natalEditorialRules(profile.language)}

Task: create the canonical natal reading in a human planet-by-planet format.

This is a complete first reading, not a teaser. It should feel like a real personal chart, grounded in planets, signs, houses, and aspects, but written in clean human language.

astroEvidence:
${evidenceJson}

Natal chart JSON:
${natalDataJson}

Required JSON shape:
{
  "headline": "max 80 chars",
  "lead": "1-2 sentences about the tone of the whole chart",
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

  return `${natalEditorialRules(profile.language)}

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

  return `${natalEditorialRules(profile.language)}

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

  return `User: ${displayName}
Language: ${profile.language}

Core chart anchors:
${natalDataJson}

Reference summary:
${options.anchorSummary}

Task: write a short personal natal insight for one placement in the app's dashboard insight panel.

Rules:
- You are an astrologer-psychologist writing for a real person.
- Explain what ${options.planetLabel} in ${options.planetSign}${options.house ? ` in house ${options.house}` : ''} means in this person's life.
- Use warm, modern second-person language: you / your.
- Keep it personal and concrete, with recognizable emotional or daily-life texture.
- No mystical fluff, no fear language, no long astrology lectures.
- No bullet lists.
- The result should feel clear and intimate inside a compact mobile panel.
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

export const createFreeWeeklyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast period (ISO week): ${periodKey}
Human-readable range: ${periodLabel}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits (context):
${transitsJson}

Task: FREE weekly layer — one honest, compact orientation for this calendar week.

Rules:
- Short and useful: this is not the premium deep layer.
- Personal, modern, emotionally precise; no mystical fluff.
- User should feel recognized, not just informed.
- Give one clear emotional pattern for the week and one practical focus that is worth carrying through the week.
- Make it useful now, but do not try to cover every domain or every scenario. Premium adds more examples and maps more nuance.
- No color/number/lucky day gimmicks. No moon-sign fluff for entertainment.
- Speak to the real person; connect week-scale tone to chart + transits.

Return strict JSON:
- headline: max 90 chars, one strong line for the week
- summary: 1-2 sentences
- focus: one clear practical focus for the week

Return only JSON.`;
};

export const createPremiumWeeklyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast period (ISO week): ${periodKey}
Human-readable range: ${periodLabel}

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Current transits:
${transitsJson}

Task: PREMIUM weekly layer — full-class forecast for the week (stronger than free, not just longer).

Rules:
- This is a premium weekly consultation, not a teaser expanded for length.
- Combine depth, situational precision, and recognizable life scenarios across the week.
- Be emotionally precise and useful for decisions, relationships, work/money, tension, opportunity, and timing.
- Clearly richer than the free weekly layer; different class of interpretation.
- When relevant, show how the week may unfold in actual behavior, conversations, pressure, or momentum.
- Write with the tone of a calm personal consultation.
- No gimmicks (no color/number games). No vague filler.

Return strict JSON:
- headline: max 90 chars
- summary: 2-3 sentences
- focus: one line
- theme: 2-5 words naming the week
- opportunities: 2-3 sentences
- challenges: 2-3 sentences
- relationships: 2-3 sentences
- career: 2-3 sentences (work, money, direction)
- guidance: 3-4 sentences direct orientation
- reading: 4-6 short paragraphs separated by "\\n\\n"

Return only JSON.`;
};

export const createFreeMonthlyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast month: ${periodKey} (${periodLabel})

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Transits context:
${transitsJson}

Task: FREE monthly layer — compact month orientation.

Rules:
- Brief but serious; personal; no gimmicks.
- User should feel "yes, this is my month", not just get a decorative summary.
- Give one recognizable monthly tension or emphasis and one practical focus.
- Free layer should already orient the month, but not replace the fuller premium month reading with more nuance, examples, and situational detail.

Return strict JSON:
- headline: max 90 chars
- summary: 1-2 sentences
- focus: one line for the month

Return only JSON.`;
};

export const createPremiumMonthlyForecastPrompt = (
  natalData: NatalChartData,
  profile: UserProfile,
  periodKey: string,
  periodLabel: string,
  transits?: any
): string => {
  const natalDataJson = JSON.stringify(natalData, null, 2);
  const transitsJson = JSON.stringify(transits || {}, null, 2);
  const displayName = profile.name || 'the user';

  return `Forecast month: ${periodKey} (${periodLabel})

User: ${displayName}
Language: ${profile.language}

Natal chart:
${natalDataJson}

Transits:
${transitsJson}

Task: PREMIUM monthly layer — deep month reading (premium class, not inflated length).

Rules:
- This is a premium monthly consultation: dense, nuanced, and grounded in how the month is actually likely to unfold.
- Combine depth, situational precision, and real-life scenarios across relationships, money/work, energy, and choices.
- Show tradeoffs, emotional undercurrents, and where momentum may build or stall.
- Write with the tone of a calm personal consultation.
- No gimmicks.

Return strict JSON:
- headline: max 90 chars
- summary: 2-3 sentences
- focus: one line
- theme: 2-5 words
- opportunities: 2-3 sentences
- challenges: 2-3 sentences
- relationships: 2-4 sentences
- money: 2-4 sentences
- guidance: 3-4 sentences
- reading: 5-7 short paragraphs separated by "\\n\\n"

Return only JSON.`;
};

