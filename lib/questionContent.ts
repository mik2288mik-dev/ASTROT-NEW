import OpenAI from 'openai';
import { createHash } from 'crypto';
import type { AskLumiaState, AskLumiaTier } from '../types';
import { SYSTEM_PROMPT_ASTRA, addLanguageInstruction } from './prompts';
import { appendLumiaVoice, LUMIA_VOICE_BLOCK_EN } from './lumiaVoice';
import { getOpenAIModelForContent } from './appSettings';
import { db } from './db';
import { getPremiumEntitlementState } from './contentArchitecture';
import { normalizeAskLumiaTier } from './contentAccessTier';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const ASK_LUMIA_FREE_STARTER_CACHE_KEY = 'starter';

/** Чат с астрологом — премиум-функция, не больше 3 вопросов в день. */
export const ASK_LUMIA_DAILY_LIMIT = 3;

type AskLumiaHistoryMessage = {
  role: 'user' | 'model';
  text: string;
};

type GenerateAskLumiaAnswerOptions = {
  language: 'ru' | 'en';
  tier: AskLumiaTier;
  question: string;
  chartContext: string;
  history: AskLumiaHistoryMessage[];
};

function getTierLabel(tier: AskLumiaTier, language: 'ru' | 'en') {
  if (language === 'ru') {
    if (tier === 'premium') return 'Premium';
    return 'стартовый бесплатный вопрос';
  }
  if (tier === 'premium') return 'Premium';
  return 'starter free question';
}

async function getQuestionModel(tier: AskLumiaTier) {
  return getOpenAIModelForContent({
    accessTier: tier === 'premium' ? 'premium' : 'free',
    contentSurface: 'question',
    contentVariant: tier === 'free' ? 'brief' : 'full',
  });
}

function buildAskLumiaPrompt(options: GenerateAskLumiaAnswerOptions) {
  const historyBlock = options.history.length
    ? options.history
        .slice(-6)
        .map((item) => `${item.role === 'user' ? 'User' : 'Lumia'}: ${item.text}`)
        .join('\n')
    : 'No relevant prior conversation.';

  // Ответы — короткие и ёмкие (премиум), без эзотерики. Free-ветка почти не используется
  // (чат премиум-only), но держим её ещё короче.
  const tierInstruction = options.tier === 'free'
    ? `Answer as a short Lumia reading.

Requirements:
- VERY short: 1 short paragraph, ~25-45 words.
- One honest read of the core issue + one concrete next step. Nothing else.
- No mystical/esoteric language at all. Plain, warm, direct.`
    : `Answer as Lumia Premium — short and sharp, like a smart friend who gets straight to the point.

Requirements:
- VERY concise: 2-3 short paragraphs, ~60-110 words TOTAL. No padding, no preamble.
- Give one clear read of the core issue + one concrete, doable next step. That's it.
- Ground it honestly in the chart context; speak directly to "you".
- Warm and a little personality is good; fake certainty and filler are not.
- Frame conclusions as tendencies, not verdicts.
- Do not write like a therapist or a fortune-teller.`;

  return appendLumiaVoice(`The user is asking Lumia a personal question.

Question tier: ${getTierLabel(options.tier, options.language)}

Natal chart context:
${options.chartContext || 'Chart context is temporarily unavailable. Be honest about uncertainty.'}

Recent conversation:
${historyBlock}

User question:
${options.question}

${tierInstruction}

HARD STYLE RULES:
- Keep it SHORT. If in doubt, cut. No long essays.
- Absolutely NO esoteric or cosmic language: no космос/Вселенная/карма/судьба/энергии/вибрации/чакры/предназначение/духовный путь. Plain human talk only.
- No mystical fluff, no decorative astrology terms, no fake certainty.

Output:
- plain text only, no markdown headings, no bullet lists
- 1-3 short paragraphs, arc: core issue -> what it means -> next step
- talk directly to the user, do not sound like a rigid template`, options.language);
}

function buildQuestionFallback(question: string, language: 'ru' | 'en', tier: AskLumiaTier) {
  if (language === 'ru') {
    if (tier === 'premium') {
      return `Главное здесь — не пытаться решить всё сразу, а назвать одну вещь, которая тревожит сильнее всего. Обычно напряжение держится не на самой ситуации, а на том, что ты тянешь с честным ответом самому себе.

Ближайший шаг простой: сузь вопрос до одного ядра и сделай по нему одно понятное действие. Остальное станет яснее уже после этого.`;
    }

    return `Сейчас важнее не спешить с выводом, а честно назвать, что тревожит сильнее всего. Когда увидишь главное — следующий шаг станет понятнее.`;
  }

  if (tier === 'premium') {
    return `The point here isn't to solve everything at once — it's to name the one thing that actually weighs on you most. Usually the pressure isn't the situation itself, but the honest answer you keep putting off.

Your next step is simple: narrow it to one core and take one clear action on that. The rest gets clearer once you do.`;
  }

  return `Right now it matters more to slow down than to rush a conclusion. Name what worries you most — once you see the core, the next step gets easier to trust.`;
}

export function sanitizeQuestionHistory(history: unknown): AskLumiaHistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message) => message && (message.role === 'user' || message.role === 'model') && typeof message.text === 'string')
    .slice(-10)
    .map((message) => ({
      role: message.role,
      text: String(message.text).trim().slice(0, 1200),
    }))
    .filter((message) => message.text.length > 0);
}

export function normalizeQuestion(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function getQuestionCacheKey(question: string) {
  return createHash('sha256').update(normalizeQuestion(question).toLowerCase()).digest('hex');
}

export function getQuestionVariantForTier(tier: AskLumiaTier): 'brief' | 'full' {
  return tier === 'free' ? 'brief' : 'full';
}

export async function getAskLumiaState(userId: string): Promise<AskLumiaState> {
  const entitlementState = await getPremiumEntitlementState(userId);

  // Чат с астрологом — премиум-функция. Для не-премиума всегда требуем Premium.
  if (!entitlementState.isPremium) {
    return {
      nextTier: 'premium',
      freeStarterAvailable: false,
      isPremium: false,
      dailyLimit: ASK_LUMIA_DAILY_LIMIT,
      dailyUsed: 0,
      dailyRemaining: 0,
    };
  }

  const used = await db.astro_questions.countToday(userId);
  const remaining = Math.max(0, ASK_LUMIA_DAILY_LIMIT - used);
  return {
    nextTier: 'premium',
    freeStarterAvailable: false,
    isPremium: true,
    dailyLimit: ASK_LUMIA_DAILY_LIMIT,
    dailyUsed: used,
    dailyRemaining: remaining,
  };
}

export { normalizeAskLumiaTier };

export async function generateAskLumiaAnswer(options: GenerateAskLumiaAnswerOptions): Promise<string> {
  const prompt = addLanguageInstruction(buildAskLumiaPrompt(options), options.language);

  if (!openai) {
    return buildQuestionFallback(options.question, options.language, options.tier);
  }

  try {
    const { model } = await getQuestionModel(options.tier);
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      temperature: options.tier === 'free' ? 0.6 : 0.7,
      max_tokens: options.tier === 'free' ? 200 : 420,
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error('Empty Ask Lumia response');
    }

    return answer;
  } catch {
    return buildQuestionFallback(options.question, options.language, options.tier);
  }
}
