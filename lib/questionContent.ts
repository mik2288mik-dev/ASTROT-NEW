import OpenAI from 'openai';
import { createHash } from 'crypto';
import type { AskLumiaState, AskLumiaTier } from '../types';
import { SYSTEM_PROMPT_ASTRA, addLanguageInstruction } from './prompts';
import { getOpenAIInterpretationModel } from './appSettings';
import { db } from './db';
import { getPremiumEntitlementState } from './contentArchitecture';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const ASK_LUMIA_FREE_STARTER_CACHE_KEY = 'starter';
export const ASK_LUMIA_LUMI_COST = 120;

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
    if (tier === 'lumi') return 'разовый Lumi-вопрос';
    return 'стартовый бесплатный вопрос';
  }
  if (tier === 'premium') return 'Premium';
  if (tier === 'lumi') return 'Lumi one-off question';
  return 'starter free question';
}

async function getQuestionModel(tier: AskLumiaTier) {
  if (tier === 'free') {
    return process.env.OPENAI_BASE_MODEL?.trim() || (await getOpenAIInterpretationModel());
  }
  return process.env.OPENAI_PREMIUM_MODEL?.trim() || (await getOpenAIInterpretationModel());
}

function buildAskLumiaPrompt(options: GenerateAskLumiaAnswerOptions) {
  const historyBlock = options.history.length
    ? options.history
        .slice(-6)
        .map((item) => `${item.role === 'user' ? 'User' : 'Lumia'}: ${item.text}`)
        .join('\n')
    : 'No relevant prior conversation.';

  const tierInstruction = options.tier === 'free'
    ? `Answer as Lumia's free starter layer.

Requirements:
- Give one direct personal answer grounded in the chart context.
- Stay brief: 2-4 short paragraphs.
- Focus on the emotional knot of the question and one useful next step.
- No mystical fluff, no decorative astrology language, no fake certainty.
- Sound serious, warm, and clear.`
    : options.tier === 'lumi'
      ? `Answer as Lumia's one-off Lumi question layer.

Requirements:
- Go deeper than the free layer.
- Give 3-5 short paragraphs with more nuance and personal precision.
- Explain what is really happening, what matters most now, and what action or shift is worth making.
- Keep it emotionally intelligent, practical, and human.
- No vague fluff, no childish mysticism, no fake certainty.`
      : `Answer as Lumia Premium.

Requirements:
- This must feel like a higher class of interpretation.
- Give a deep personal answer in 4-6 short paragraphs.
- Be sharper about relationships, fear, hope, pressure, timing, money, or direction when relevant.
- Show emotional accuracy, pattern recognition, and a grounded next step.
- Do not write like a therapist or a fortune-teller. Write like a clear, intelligent personal guide using chart context honestly.`;

  return `The user is asking Lumia a personal question.

Question tier: ${getTierLabel(options.tier, options.language)}

Natal chart context:
${options.chartContext || 'Chart context is temporarily unavailable. Be honest about uncertainty.'}

Recent conversation:
${historyBlock}

User question:
${options.question}

${tierInstruction}

Output:
- plain text only
- no markdown headings
- no bullet lists unless absolutely needed
- short paragraphs with breathing room
- talk directly to the user`;
}

function buildQuestionFallback(question: string, language: 'ru' | 'en', tier: AskLumiaTier) {
  if (language === 'ru') {
    if (tier === 'premium') {
      return `Сейчас по этому вопросу важнее не пытаться мгновенно всё решить, а увидеть, где у тебя на самом деле главный внутренний узел. Обычно напряжение здесь появляется не из-за одной детали, а из-за накопившейся неясности: чего ты хочешь, чего боишься и на что уже не готов закрывать глаза.

Если смотреть честно, ответ для тебя сейчас не в резком движении, а в более точной внутренней позиции. Сначала назови себе главное без украшений. Потом смотри, где есть реальная опора, а где только тревога, привычка или желание удержать то, что уже не работает.

Лучший следующий шаг здесь — не разбрасываться и не пытаться прожить всё сразу. Сузь вопрос до одного ядра и действуй из него. Тогда ситуация начнёт проясняться намного быстрее.`;
    }

    if (tier === 'lumi') {
      return `В этом вопросе для тебя сейчас главное — не потерять себя в шуме эмоций и чужих ожиданий. Похоже, ситуация требует не поверхностной реакции, а более точного понимания: что здесь действительно важно лично для тебя, а что только давит и сбивает.

Сейчас полезнее опираться не на спешку, а на ясность. Попробуй назвать себе одну центральную правду об этой ситуации и уже от неё смотреть на следующий шаг. Именно так напряжение начнёт ослабевать.`;
    }

    return `По этому вопросу тебе сейчас важнее всего не спешить с выводом. Сначала попробуй честно назвать, что здесь болит или тревожит сильнее всего.

Когда ты увидишь главное без лишнего шума, следующий шаг станет гораздо яснее.`;
  }

  if (tier === 'premium') {
    return `With this question, the most important thing right now is not to force a fast solution, but to see where the real inner knot is. The pressure here is likely not coming from one detail, but from built-up uncertainty about what you want, what you fear, and what you no longer want to keep excusing.

The answer for you now is not in a dramatic move, but in a more honest internal position. Name the core truth first. Then separate what is real support from what is only fear, habit, or attachment to something that has already stopped working.

Your next step is to reduce the noise and act from one clear center. That is where this situation starts opening up.`;
  }

  if (tier === 'lumi') {
    return `What matters most in this question is not getting lost in emotional noise or other people's expectations. This situation seems to ask for a more precise understanding of what is truly important to you and what is only creating pressure.

Right now clarity will help more than speed. Name one central truth about the situation and let your next step come from that.`;
  }

  return `With this question, the first thing that matters is not rushing to a conclusion. Try to name what hurts, worries, or matters most here.

Once you see the core clearly, the next step usually becomes much easier to trust.`;
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

export function getQuestionVariantForTier(tier: AskLumiaTier): 'brief' | 'one_off' | 'full' {
  if (tier === 'free') return 'brief';
  if (tier === 'lumi') return 'one_off';
  return 'full';
}

export async function getAskLumiaState(userId: string): Promise<AskLumiaState> {
  const [entitlementState, freeStarterUnlock, lumiBalance] = await Promise.all([
    getPremiumEntitlementState(userId),
    db.content_unlocks.getLatestActive(userId, {
      accessTier: 'free',
      contentSurface: 'question',
      contentVariant: 'brief',
      cacheKey: ASK_LUMIA_FREE_STARTER_CACHE_KEY,
    }),
    db.lumi_transactions.getBalance(userId),
  ]);

  if (entitlementState.isPremium) {
    return {
      nextTier: 'premium',
      freeStarterAvailable: false,
      isPremium: true,
      lumiCost: ASK_LUMIA_LUMI_COST,
      lumiBalance,
      hasEnoughLumi: true,
    };
  }

  const freeStarterAvailable = !freeStarterUnlock;
  return {
    nextTier: freeStarterAvailable ? 'free' : 'lumi',
    freeStarterAvailable,
    isPremium: false,
    lumiCost: ASK_LUMIA_LUMI_COST,
    lumiBalance,
    hasEnoughLumi: lumiBalance >= ASK_LUMIA_LUMI_COST,
  };
}

export async function generateAskLumiaAnswer(options: GenerateAskLumiaAnswerOptions): Promise<string> {
  const prompt = addLanguageInstruction(buildAskLumiaPrompt(options), options.language);

  if (!openai) {
    return buildQuestionFallback(options.question, options.language, options.tier);
  }

  try {
    const model = await getQuestionModel(options.tier);
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      temperature: options.tier === 'free' ? 0.7 : 0.82,
      max_tokens: options.tier === 'free' ? 700 : 1100,
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
