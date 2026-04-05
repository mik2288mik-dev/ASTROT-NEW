import OpenAI from 'openai';
import { SYSTEM_PROMPT_ASTRA, createFullNatalChartIntroPrompt, addLanguageInstruction } from './prompts';
import { getOpenAIModelForContent } from './appSettings';

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

Я уже вижу в твоей карте важную вещь: ты редко живёшь на поверхности. Даже если внешне ты держишься спокойно, внутри ты быстро считываешь людей, атмосферу и скрытые сигналы ситуации.

**Твои сильные стороны:**
• Ты замечаешь нюансы там, где другие проходят мимо
• Твоя стихия ${element} даёт тебе свой способ принимать решения и держать внутренний ритм
• Когда ты доверяешь своему ощущению, ты довольно точно видишь главное

**Что важно в тебе:**
Ты не из тех, кто по-настоящему включается в жизнь формально. Тебе важно чувствовать смысл, контакт и внутреннюю честность. Это уже твоя основа. Дальше можно глубже раскрыть повторяющиеся сценарии, отношения и решения.`;
  }
  return `**Hi, ${name}!**

I can already see one important thing in your chart: you rarely live on the surface. Even if you seem calm from the outside, you pick up people, atmosphere, and hidden signals very quickly.

**Your strengths:**
• You notice nuance where others move too fast
• Your ${element} element shapes the way you decide and hold your inner rhythm
• When you trust your own sense, you usually see the core of things very clearly

**What matters about you:**
You are not built for formal, disconnected living. Meaning, contact, and inner honesty matter to you. That is already your foundation. From here, the deeper layers can open patterns, relationships, and decisions in more detail.`;
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

    const { model: modelId } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
    });
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
