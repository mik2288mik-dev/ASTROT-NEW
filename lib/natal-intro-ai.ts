import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createFullNatalChartIntroPrompt, addLanguageInstruction } from './prompts';
import { getOpenAIInterpretationModel } from './appSettings';

const log = {
  warn: (m: string, d?: any) => console.warn(`[natal-intro-ai] ${m}`, d || ''),
  error: (m: string, d?: any) => console.error(`[natal-intro-ai] ${m}`, d || ''),
};

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export function generateFallbackNatalIntro(profile: any, chartData: any): string {
  const lang = profile?.language === 'ru';
  const name = profile.name || (lang ? 'друг' : 'friend');
  const element = chartData.element || 'Fire';

  if (lang) {
    return `**Привет, ${name}!**

Я изучила твою карту, и вот что вижу: у тебя сильная, узнаваемая энергия. Ты чувствуешь людей и ситуации глубже, чем кажется со стороны.

**Твои сильные стороны:**
• Твоя стихия ${element} даёт тебе особый подход к жизни
• Ты легко находишь баланс между разными сторонами себя
• У тебя есть природная способность понимать людей

**Что делает тебя особенным:**
Ты можешь быть разным в зависимости от ситуации — и это твоя сила. Хочешь узнать больше о личности, любви, карьере и предназначении? Активируй Premium!`;
  }
  return `**Hi, ${name}!**

I've studied your chart, and here's what I see: you have a strong, recognizable energy. You feel people and situations more deeply than it might seem from the outside.

**Your strengths:**
• Your ${element} element gives you a special approach to life
• You easily find balance between different sides of yourself
• You have a natural ability to understand people

**What makes you special:**
You can be different depending on the situation — and that's your strength. Want to learn more about your personality, love, career and life purpose? Activate Premium!`;
}

export async function generateNatalIntroWithOpenAI(profile: any, chartData: any): Promise<string> {
  const lang = profile?.language === 'ru';

  if (!openai) {
    log.warn('OpenAI not configured, using fallback');
    return generateFallbackNatalIntro(profile, chartData);
  }

  try {
    const userPrompt = createFullNatalChartIntroPrompt(chartData, profile);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: addLanguageInstruction(SYSTEM_PROMPT_ASTRA, lang ? 'ru' : 'en') },
      { role: 'user', content: userPrompt },
    ];

    const modelId = await getOpenAIInterpretationModel();
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.8,
      max_tokens: 1500,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    log.error('OpenAI error', { error: error.message });
    return generateFallbackNatalIntro(profile, chartData);
  }
}
