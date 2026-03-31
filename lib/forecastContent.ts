import OpenAI from 'openai';
import type {
  ForecastDailyReading,
  ForecastDaypartReading,
  ForecastDaypartSlot,
  ForecastMonthlyReading,
  ForecastWeeklyReading,
  NatalChartData,
  UserProfile,
} from '../types';
import {
  SYSTEM_PROMPT_ASTRA,
  addLanguageInstruction,
  createDailyForecastV2Prompt,
  createDaypartForecastPrompt,
  createFreeMonthlyForecastPrompt,
  createFreeWeeklyForecastPrompt,
  createPremiumMonthlyForecastPrompt,
  createPremiumWeeklyForecastPrompt,
  DailyForecastV2AIResponse,
  DaypartForecastAIResponse,
  FreeMonthlyForecastV2AIResponse,
  FreeWeeklyForecastV2AIResponse,
  PremiumMonthlyForecastV2AIResponse,
  PremiumWeeklyForecastV2AIResponse,
} from './prompts';
import { getOpenAIInterpretationModel } from './appSettings';
import { getCurrentTransits } from './transits-calculator';
import { formatIsoWeekPeriodLabel, formatMonthPeriodLabel, getMoscowTodayKey } from './date-utils';

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
      max_tokens: 1650,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as DaypartForecastAIResponse;
    return normalizeDaypartForecast(parsed, lang, dateKey, slot);
  } catch {
    return buildDaypartFallback(lang, dateKey, slot);
  }
}

function buildFreeWeeklyFallback(lang: 'ru' | 'en', periodKey: string, periodLabel: string): ForecastWeeklyReading {
  return lang === 'ru'
    ? {
        periodKey,
        periodLabel,
        headline: 'Неделя просит ясности и ровного шага',
        summary: 'Сейчас полезнее держать фокус на главном и не распылять силы на второстепенные драмы.',
        focus: 'Выбери одну линию на неделю и поддерживай её спокойной дисциплиной.',
      }
    : {
        periodKey,
        periodLabel,
        headline: 'This week rewards clarity and steady pacing',
        summary: 'It helps to protect your focus and avoid spending energy on side noise.',
        focus: 'Pick one meaningful line for the week and support it with calm consistency.',
      };
}

function buildPremiumWeeklyFallback(lang: 'ru' | 'en', periodKey: string, periodLabel: string): ForecastWeeklyReading {
  const base = buildFreeWeeklyFallback(lang, periodKey, periodLabel);
  return lang === 'ru'
    ? {
        ...base,
        theme: 'Сборка и направление',
        opportunities: 'Появляется шанс укрепить то, что уже начал работать, если не убежать в суету.',
        challenges: 'Риск — перегруз контактами и обещаниями; легче ошибиться там, где нужна точность.',
        relationships: 'В близости важнее честность без резкости: меньше додумываний, больше прямых формулировок.',
        career: 'Практические решения лучше принимать с паузой: сначала критерий, потом действие.',
        guidance: 'Держи неделю как серию спокойных шагов: меньше импульса, больше опоры на факты и ощущения.',
        reading:
          'Неделя не про «успеть всё», а про то, чтобы твоя энергия не утекала в чужие срочности.\n\nЕсли заранее обозначить главный приоритет, проще заметить, где ты реально продвигаешься, а где только реагируешь.\n\nВ отношениях выигрывает ясный тон: не обесценивать чувства, но и не раздувать недопонимание.',
      }
    : {
        ...base,
        theme: 'Direction and consolidation',
        opportunities: 'You can strengthen what already works if you do not scatter your attention.',
        challenges: 'Overload from social noise and promises can blur judgment where precision matters.',
        relationships: 'Closeness needs honesty without sharpness: fewer assumptions, clearer words.',
        career: 'Practical choices benefit from a pause: criteria first, then action.',
        guidance: 'Treat the week as calm steps: less impulse, more grounding in facts and felt truth.',
        reading:
          'This week is less about doing everything and more about not leaking energy into other people’s urgency.\n\nIf you name one real priority early, it becomes easier to see real progress versus reactive motion.\n\nIn relationships, a clear tone wins: respect feelings without inflating misunderstandings.',
      };
}

function buildFreeMonthlyFallback(lang: 'ru' | 'en', periodKey: string, periodLabel: string): ForecastMonthlyReading {
  return lang === 'ru'
    ? {
        periodKey,
        periodLabel,
        headline: 'Месяц про ритм и устойчивость',
        summary: 'Фон месяца просит не гнаться за скоростью, а выстроить понятную для себя последовательность.',
        focus: 'Закрепи одну привычку или одно направление, которое реально поддержит тебя.',
      }
    : {
        periodKey,
        periodLabel,
        headline: 'A month for rhythm and steadiness',
        summary: 'The month favors a clear sequence over constant rushing.',
        focus: 'Anchor one habit or direction that genuinely supports you.',
      };
}

function buildPremiumMonthlyFallback(lang: 'ru' | 'en', periodKey: string, periodLabel: string): ForecastMonthlyReading {
  const base = buildFreeMonthlyFallback(lang, periodKey, periodLabel);
  return lang === 'ru'
    ? {
        ...base,
        theme: 'Сборка ресурса',
        opportunities: 'Есть пространство укрепить финансовую и эмоциональную базу через простые правила.',
        challenges: 'Перегруз и сравнение с другими могут сбить с собственного критерия успеха.',
        relationships: 'Тема месяца — зрелые границы: близость без самопожертвования.',
        money: 'Практика месяца: отделять импульсные траты от стратегических решений.',
        guidance: 'Раз в неделю возвращайся к вопросу: что сейчас действительно двигает меня вперёд.',
        reading:
          'Месяц хорошо работает, если ты позволяешь себе более длинный горизонт, чем «сегодня вечером».\n\nВ отношениях полезно говорить о потребностях прямо, без обвинений — это снижает фон тревоги.\n\nВ деньгах и работе выигрывает простая система: мало правил, но выполняемых.\n\nЕсли удерживать один главный вектор, к концу месяца легче почувствовать, что ты не только выжил, а собрался.',
      }
    : {
        ...base,
        theme: 'Building reserves',
        opportunities: 'You can strengthen emotional and practical foundations with a few clear rules.',
        challenges: 'Overload and comparison can blur your own definition of progress.',
        relationships: 'The month favors mature boundaries: closeness without self-erasure.',
        money: 'Separate impulsive spending from decisions that match a longer plan.',
        guidance: 'Once a week ask what is truly moving you forward right now.',
        reading:
          'This month works better when you allow a longer horizon than “tonight.”\n\nIn relationships, naming needs directly without blame lowers ambient anxiety.\n\nIn money and work, a few consistent rules beat constant improvisation.\n\nIf you keep one main vector, by month’s end it is easier to feel gathered, not just busy.',
      };
}

function normalizeFreeWeekly(
  raw: Partial<FreeWeeklyForecastV2AIResponse> | null | undefined,
  lang: 'ru' | 'en',
  periodKey: string,
  periodLabel: string
): ForecastWeeklyReading {
  const fb = buildFreeWeeklyFallback(lang, periodKey, periodLabel);
  return {
    periodKey,
    periodLabel,
    headline: cleanLine(raw?.headline, fb.headline),
    summary: cleanLine(raw?.summary, fb.summary),
    focus: cleanLine(raw?.focus, fb.focus),
  };
}

function normalizePremiumWeekly(
  raw: Partial<PremiumWeeklyForecastV2AIResponse> | null | undefined,
  lang: 'ru' | 'en',
  periodKey: string,
  periodLabel: string
): ForecastWeeklyReading {
  const fb = buildPremiumWeeklyFallback(lang, periodKey, periodLabel);
  return {
    periodKey,
    periodLabel,
    headline: cleanLine(raw?.headline, fb.headline),
    summary: cleanLine(raw?.summary, fb.summary),
    focus: cleanLine(raw?.focus, fb.focus),
    theme: cleanLine(raw?.theme, fb.theme ?? ''),
    opportunities: cleanLine(raw?.opportunities, fb.opportunities ?? ''),
    challenges: cleanLine(raw?.challenges, fb.challenges ?? ''),
    relationships: cleanLine(raw?.relationships, fb.relationships ?? ''),
    career: cleanLine(raw?.career, fb.career ?? ''),
    guidance: cleanLine(raw?.guidance, fb.guidance ?? ''),
    reading: cleanLine(raw?.reading, fb.reading ?? ''),
  };
}

function normalizeFreeMonthly(
  raw: Partial<FreeMonthlyForecastV2AIResponse> | null | undefined,
  lang: 'ru' | 'en',
  periodKey: string,
  periodLabel: string
): ForecastMonthlyReading {
  const fb = buildFreeMonthlyFallback(lang, periodKey, periodLabel);
  return {
    periodKey,
    periodLabel,
    headline: cleanLine(raw?.headline, fb.headline),
    summary: cleanLine(raw?.summary, fb.summary),
    focus: cleanLine(raw?.focus, fb.focus),
  };
}

function normalizePremiumMonthly(
  raw: Partial<PremiumMonthlyForecastV2AIResponse> | null | undefined,
  lang: 'ru' | 'en',
  periodKey: string,
  periodLabel: string
): ForecastMonthlyReading {
  const fb = buildPremiumMonthlyFallback(lang, periodKey, periodLabel);
  return {
    periodKey,
    periodLabel,
    headline: cleanLine(raw?.headline, fb.headline),
    summary: cleanLine(raw?.summary, fb.summary),
    focus: cleanLine(raw?.focus, fb.focus),
    theme: cleanLine(raw?.theme, fb.theme ?? ''),
    opportunities: cleanLine(raw?.opportunities, fb.opportunities ?? ''),
    challenges: cleanLine(raw?.challenges, fb.challenges ?? ''),
    relationships: cleanLine(raw?.relationships, fb.relationships ?? ''),
    money: cleanLine(raw?.money, fb.money ?? ''),
    guidance: cleanLine(raw?.guidance, fb.guidance ?? ''),
    reading: cleanLine(raw?.reading, fb.reading ?? ''),
  };
}

export async function generateFreeWeeklyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey: string,
  periodLabel?: string
): Promise<ForecastWeeklyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const label = periodLabel || formatIsoWeekPeriodLabel(periodKey, lang);
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildFreeWeeklyFallback(lang, periodKey, label);
  }

  try {
    const prompt = addLanguageInstruction(
      createFreeWeeklyForecastPrompt(chartData, profile, periodKey, label, transits),
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
      temperature: 0.72,
      max_tokens: 900,
    });
    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as FreeWeeklyForecastV2AIResponse;
    return normalizeFreeWeekly(parsed, lang, periodKey, label);
  } catch {
    return buildFreeWeeklyFallback(lang, periodKey, label);
  }
}

export async function generatePremiumWeeklyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey: string,
  periodLabel?: string
): Promise<ForecastWeeklyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const label = periodLabel || formatIsoWeekPeriodLabel(periodKey, lang);
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildPremiumWeeklyFallback(lang, periodKey, label);
  }

  try {
    const prompt = addLanguageInstruction(
      createPremiumWeeklyForecastPrompt(chartData, profile, periodKey, label, transits),
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
      temperature: 0.82,
      max_tokens: 2200,
    });
    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as PremiumWeeklyForecastV2AIResponse;
    return normalizePremiumWeekly(parsed, lang, periodKey, label);
  } catch {
    return buildPremiumWeeklyFallback(lang, periodKey, label);
  }
}

export async function generateFreeMonthlyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey: string,
  periodLabel?: string
): Promise<ForecastMonthlyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const label = periodLabel || formatMonthPeriodLabel(periodKey, lang);
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildFreeMonthlyFallback(lang, periodKey, label);
  }

  try {
    const prompt = addLanguageInstruction(
      createFreeMonthlyForecastPrompt(chartData, profile, periodKey, label, transits),
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
      temperature: 0.72,
      max_tokens: 900,
    });
    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as FreeMonthlyForecastV2AIResponse;
    return normalizeFreeMonthly(parsed, lang, periodKey, label);
  } catch {
    return buildFreeMonthlyFallback(lang, periodKey, label);
  }
}

export async function generatePremiumMonthlyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  periodKey: string,
  periodLabel?: string
): Promise<ForecastMonthlyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const label = periodLabel || formatMonthPeriodLabel(periodKey, lang);
  const transits = await getCurrentTransits(new Date());

  if (!openai) {
    return buildPremiumMonthlyFallback(lang, periodKey, label);
  }

  try {
    const prompt = addLanguageInstruction(
      createPremiumMonthlyForecastPrompt(chartData, profile, periodKey, label, transits),
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
      temperature: 0.82,
      max_tokens: 2600,
    });
    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as PremiumMonthlyForecastV2AIResponse;
    return normalizePremiumMonthly(parsed, lang, periodKey, label);
  } catch {
    return buildPremiumMonthlyFallback(lang, periodKey, label);
  }
}
