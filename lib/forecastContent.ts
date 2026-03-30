import OpenAI from 'openai';
import type {
  ForecastDailyReading,
  ForecastDaypartReading,
  ForecastDaypartSlot,
  NatalChartData,
  UserProfile,
} from '../types';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createDailyForecastV2Prompt,
  createDaypartForecastPrompt,
  DailyForecastV2AIResponse,
  DaypartForecastAIResponse,
} from './prompts';
import { getOpenAIInterpretationModel } from './appSettings';
import { getCurrentTransits } from './transits-calculator';
import { getMoscowTodayKey } from './date-utils';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function cleanLine(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function cleanAdvice(value: unknown, fallbacks: string[]) {
  const lines = Array.isArray(value)
    ? value
        .map((item) => cleanLine(item, ''))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (lines.length === 3) return lines;
  return fallbacks;
}

function buildDailyFallback(lang: 'ru' | 'en', dateKey: string): ForecastDailyReading {
  return lang === 'ru'
    ? {
        date: dateKey,
        headline: 'Сегодня важнее держаться за главное',
        summary: 'День просит меньше суеты и больше внутренней собранности. Лучше не распыляться на всё сразу.',
        chance: 'Один честный разговор может многое прояснить.',
        risk: 'Лишняя спешка легко уводит в сомнения и мелкие ошибки.',
        focus: 'Собери день вокруг одного действительно важного решения.',
        reading:
          'Сегодняшний фон не про шум и не про внешнюю гонку. Намного полезнее вовремя заметить, где ты уже чувствуешь напряжение, и не подливать его лишними реакциями.\n\nЕсли удержишь внутренний центр, день даст не только ясность, но и ощущение, что ты снова управляешь ритмом, а не догоняешь его.',
        context:
          'Текущие влияния сильнее всего цепляют твой способ реагировать на давление. Поэтому сегодня особенно важно не спешить там, где нужна точность.',
        advice: [
          'Не начинай день с хаотичных решений.',
          'Сначала проясни главное, потом отвечай на второстепенное.',
          'Оставь место для спокойного разговора, а не для защиты.',
        ],
      }
    : {
        date: dateKey,
        headline: 'Today is about holding on to what matters',
        summary: 'The day asks for less noise and more inner steadiness. It helps to avoid scattering your attention.',
        chance: 'One honest conversation can move things forward.',
        risk: 'Rushing can pull you into doubt and small mistakes.',
        focus: 'Build the day around one decision that truly matters.',
        reading:
          'The tone of today is not about external rush. It is more useful to notice where pressure is already rising and avoid feeding it with extra reactions.\n\nIf you keep your inner center, the day can give not only clarity, but the feeling that you are leading the rhythm again instead of chasing it.',
        context:
          'Current influences press most strongly on the way you react to pressure. That is why calm precision matters more than speed today.',
        advice: [
          'Do not start the day with chaotic decisions.',
          'Clarify the main thing before reacting to everything else.',
          'Leave room for a calm conversation instead of defensiveness.',
        ],
      };
}

function buildDaypartFallback(
  lang: 'ru' | 'en',
  dateKey: string,
  slot: ForecastDaypartSlot
): ForecastDaypartReading {
  const slotTitle =
    lang === 'ru'
      ? { morning: 'утро', day: 'день', evening: 'вечер' }[slot]
      : { morning: 'morning', day: 'day', evening: 'evening' }[slot];

  return lang === 'ru'
    ? {
        date: dateKey,
        slot,
        headline: `${slotTitle[0].toUpperCase()}${slotTitle.slice(1)} просит ясности`,
        summary: 'Сейчас лучше действовать спокойнее и точнее, чем резче и быстрее.',
        focus: 'Держись ближе к главному и не распыляй энергию.',
        relationships: 'В контакте с людьми лучше выбирать честность без лишней резкости.',
        money: 'Практические решения лучше принимать без давления и спешки.',
        guidance: 'Это время дня лучше прожить собранно: меньше шума, больше внутренней опоры.',
      }
    : {
        date: dateKey,
        slot,
        headline: `${slotTitle[0].toUpperCase()}${slotTitle.slice(1)} asks for clarity`,
        summary: 'It helps to move with more calm precision than speed right now.',
        focus: 'Stay close to what matters and do not split your energy.',
        relationships: 'Choose honesty without extra sharpness in your interactions.',
        money: 'Practical decisions work better without pressure or rush.',
        guidance: 'This part of the day works best when you stay collected: less noise, more inner support.',
      };
}

function normalizeDailyForecast(
  raw: Partial<DailyForecastV2AIResponse> | null | undefined,
  lang: 'ru' | 'en',
  dateKey: string
): ForecastDailyReading {
  const fallback = buildDailyFallback(lang, dateKey);
  return {
    date: dateKey,
    headline: cleanLine(raw?.headline, fallback.headline),
    summary: cleanLine(raw?.summary, fallback.summary),
    chance: cleanLine(raw?.chance, fallback.chance),
    risk: cleanLine(raw?.risk, fallback.risk),
    focus: cleanLine(raw?.focus, fallback.focus),
    reading: cleanLine(raw?.reading, fallback.reading),
    context: cleanLine(raw?.context, fallback.context),
    advice: cleanAdvice(raw?.advice, fallback.advice),
  };
}

function normalizeDaypartForecast(
  raw: Partial<DaypartForecastAIResponse> | null | undefined,
  lang: 'ru' | 'en',
  dateKey: string,
  slot: ForecastDaypartSlot
): ForecastDaypartReading {
  const fallback = buildDaypartFallback(lang, dateKey, slot);
  return {
    date: dateKey,
    slot,
    headline: cleanLine(raw?.headline, fallback.headline),
    summary: cleanLine(raw?.summary, fallback.summary),
    focus: cleanLine(raw?.focus, fallback.focus),
    relationships: cleanLine(raw?.relationships, fallback.relationships),
    money: cleanLine(raw?.money, fallback.money),
    guidance: cleanLine(raw?.guidance, fallback.guidance),
  };
}

async function getForecastModel(modelTier: 'base' | 'premium') {
  if (modelTier === 'premium') {
    return process.env.OPENAI_PREMIUM_MODEL?.trim() || (await getOpenAIInterpretationModel());
  }
  return process.env.OPENAI_BASE_MODEL?.trim() || (await getOpenAIInterpretationModel());
}

export async function generateFreeDailyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  dateKey = getMoscowTodayKey()
): Promise<ForecastDailyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildDailyFallback(lang, dateKey);
  }

  try {
    const prompt = addLanguageInstruction(
      createDailyForecastV2Prompt(chartData, profile, dateKey, transits),
      lang
    );
    const model = await getForecastModel('base');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1400,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as DailyForecastV2AIResponse;
    return normalizeDailyForecast(parsed, lang, dateKey);
  } catch {
    return buildDailyFallback(lang, dateKey);
  }
}

export async function generatePremiumDaypartForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  slot: ForecastDaypartSlot,
  dateKey = getMoscowTodayKey()
): Promise<ForecastDaypartReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildDaypartFallback(lang, dateKey, slot);
  }

  try {
    const prompt = addLanguageInstruction(
      createDaypartForecastPrompt(chartData, profile, dateKey, slot, transits),
      lang
    );
    const model = await getForecastModel('premium');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_ASTRA },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as DaypartForecastAIResponse;
    return normalizeDaypartForecast(parsed, lang, dateKey, slot);
  } catch {
    return buildDaypartFallback(lang, dateKey, slot);
  }
}
