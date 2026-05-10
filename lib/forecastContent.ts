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
import { getOpenAIModelForContent } from './appSettings';
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
  const ruCopy: Record<ForecastDaypartSlot, Omit<ForecastDaypartReading, 'date' | 'slot'>> = {
    morning: {
      headline: 'Утро требует собранного старта',
      summary: 'Первая половина дня лучше раскрывается через ясный внутренний фокус, а не через резкий разгон.',
      focus: 'Собери утро вокруг одного главного намерения, иначе мелкие срочности растащат внимание.',
      relationships: 'В утреннем контакте лучше не угадывать настроение друг друга, а говорить проще и прямее.',
      money: 'До обеда полезнее сверяться с приоритетом, чем бросаться в каждую задачу как в срочную.',
      guidance: 'Это не время для хаотичного старта. Чем спокойнее ты задашь ритм утром, тем меньше лишнего давления понесёшь в день.',
    },
    day: {
      headline: 'День проверяет твою точность',
      summary: 'В центре дня растёт плотность решений, поэтому особенно важно не путать активность с реальным движением.',
      focus: 'Держись ближе к тому, что даёт результат, а не только ощущение занятости.',
      relationships: 'Днём напряжение чаще всего рождается из недосказанности и быстрого тона, а не из самой темы разговора.',
      money: 'Практические решения лучше принимать по критерию, а не по импульсу или внешнему давлению.',
      guidance: 'Середина дня любит ясную структуру. Если чувствуешь перегруз, не ускоряйся автоматически: сначала верни себе опору, потом выбирай следующий шаг.',
    },
    evening: {
      headline: 'Вечер просит тишины и честности',
      summary: 'К вечеру сильнее слышно то, что было вытеснено днём, поэтому полезнее снижать шум, а не добивать себя новыми задачами.',
      focus: 'Смотри не только на события дня, но и на то, что они в тебе реально подняли.',
      relationships: 'Вечером близость строится не на идеальном тоне, а на честном присутствии без защитной маски.',
      money: 'Поздние решения лучше не принимать на усталости; вечер скорее для сверки, чем для резких разворотов.',
      guidance: 'Эта часть дня лучше работает как мягкая настройка на себя. Заверши незавершённое по смыслу, а не пытайся выиграть у усталости дисциплиной.',
    },
  };

  const enCopy: Record<ForecastDaypartSlot, Omit<ForecastDaypartReading, 'date' | 'slot'>> = {
    morning: {
      headline: 'Morning asks for a collected start',
      summary: 'The first half of the day opens better through inner focus than through sudden acceleration.',
      focus: 'Build the morning around one real intention or small urgencies will pull your attention apart.',
      relationships: 'In morning contact, it helps to speak more plainly instead of trying to guess each other’s mood.',
      money: 'Before noon, it is wiser to check priority first than to treat every task as urgent.',
      guidance: 'This is not the time for a chaotic start. The calmer you set the rhythm in the morning, the less extra pressure you carry into the day.',
    },
    day: {
      headline: 'The day tests your precision',
      summary: 'In the middle of the day, decisions get denser, so it matters not to confuse activity with real movement.',
      focus: 'Stay close to what creates an actual result, not just the feeling of being busy.',
      relationships: 'Daytime tension often grows from unfinished communication and a rushed tone, not from the topic itself.',
      money: 'Practical decisions work better when they follow a criterion instead of impulse or outside pressure.',
      guidance: 'Midday responds well to structure. If you feel overloaded, do not speed up automatically: regain your footing first, then choose the next step.',
    },
    evening: {
      headline: 'Evening asks for honesty and quiet',
      summary: 'By evening, what was pushed aside during the day becomes easier to feel, so lowering the noise helps more than adding new tasks.',
      focus: 'Notice not only what happened today, but what it actually stirred in you.',
      relationships: 'At night, closeness grows less from perfect wording and more from honest presence without a defensive mask.',
      money: 'Late decisions are better not made from fatigue; the evening is more for review than for hard turns.',
      guidance: 'This part of the day works best as a gentle reset. Close what needs inner completion instead of trying to outrun tiredness with discipline.',
    },
  };

  return lang === 'ru'
    ? {
        date: dateKey,
        slot,
        ...ruCopy[slot],
      }
    : {
        date: dateKey,
        slot,
        ...enCopy[slot],
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
  return getOpenAIModelForContent({
    accessTier: modelTier === 'premium' ? 'premium' : 'free',
    contentSurface: 'forecast',
    contentVariant: modelTier === 'premium' ? 'day' : 'daily',
  });
}

export async function generateFreeDailyForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  dateKey = getMoscowTodayKey(),
  options?: { allowStaticFallback?: boolean }
): Promise<ForecastDailyReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const allowStaticFallback = options?.allowStaticFallback !== false;
  const fallback = buildDailyFallback(lang, dateKey);
  let transits;

  try {
    transits = await getCurrentTransits(new Date());
  } catch (error: any) {
    if (!allowStaticFallback) {
      const nextError = new Error(error?.message || 'Transit calculation failed') as Error & {
        code?: string;
        status?: number;
      };
      nextError.code = 'CONTENT_GENERATION_UNAVAILABLE';
      nextError.status = 503;
      throw nextError;
    }
    return fallback;
  }

  if (!openai) {
    if (!allowStaticFallback) {
      const error = new Error('OpenAI content generation is not configured') as Error & { code?: string; status?: number };
      error.code = 'CONTENT_GENERATION_UNAVAILABLE';
      error.status = 503;
      throw error;
    }
    return fallback;
  }

  try {
    const prompt = addLanguageInstruction(
      createDailyForecastV2Prompt(chartData, profile, dateKey, transits),
      lang
    );
    const { model } = await getForecastModel('base');
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
  } catch (error: any) {
    if (!allowStaticFallback) {
      const nextError = new Error(error?.message || 'Daily forecast generation failed') as Error & {
        code?: string;
        status?: number;
      };
      nextError.code = 'CONTENT_GENERATION_UNAVAILABLE';
      nextError.status = 503;
      throw nextError;
    }
    return fallback;
  }
}

export async function generatePremiumDaypartForecast(
  profile: UserProfile,
  chartData: NatalChartData,
  slot: ForecastDaypartSlot,
  dateKey = getMoscowTodayKey(),
  options?: { allowStaticFallback?: boolean }
): Promise<ForecastDaypartReading> {
  const lang: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const transits = await getCurrentTransits(new Date());
  const allowStaticFallback = options?.allowStaticFallback !== false;

  if (!openai) {
    if (!allowStaticFallback) {
      const error = new Error('OpenAI content generation is not configured') as Error & { code?: string; status?: number };
      error.code = 'CONTENT_GENERATION_UNAVAILABLE';
      error.status = 503;
      throw error;
    }
    return buildDaypartFallback(lang, dateKey, slot);
  }

  try {
    const prompt = addLanguageInstruction(
      createDaypartForecastPrompt(chartData, profile, dateKey, slot, transits),
      lang
    );
    const { model } = await getForecastModel('premium');
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
  } catch (error: any) {
    if (!allowStaticFallback) {
      const nextError = new Error(error?.message || 'Daypart forecast generation failed') as Error & {
        code?: string;
        status?: number;
      };
      nextError.code = 'CONTENT_GENERATION_UNAVAILABLE';
      nextError.status = 503;
      throw nextError;
    }
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
        headline: 'Неделя просит зрелого фокуса и точных решений',
        summary: 'Эта неделя не про внешний разгон, а про умение держать курс, когда вокруг становится плотнее по задачам, ожиданиям и контактам. Чем лучше ты видишь свой реальный приоритет, тем меньше шансов уйти в чужую срочность.',
        focus: 'Собери неделю вокруг одной опорной линии и сверяй с ней решения, разговоры и нагрузку.',
        theme: 'Фокус и разворот',
        opportunities: 'У недели есть потенциал дать заметное продвижение там, где ты давно готов к следующему шагу, но раньше распылялся. Особенно хорошо сработает всё, что требует не героизма, а последовательности и внутренней собранности.',
        challenges: 'Главный риск — перегруз обещаниями, фоновым напряжением и желанием успеть всё сразу. В такие недели человек чаще ошибается не в сути, а в темпе: берёт лишнее, отвечает раньше ясности или пытается держать под контролем всё вокруг.',
        relationships: 'В отношениях эта неделя делает особенно заметным, где вы действительно слышите друг друга, а где общаетесь через догадки и напряжение. Чем проще и честнее будет тон, тем меньше поводов превращать чувствительную тему в накопленную обиду.',
        career: 'В работе, деньгах и направлении лучше опираться на критерии и горизонт, а не на мгновенное чувство срочности. Если есть важный выбор, полезно смотреть не только на быстрый эффект, но и на то, что реально укрепляет твою позицию через неделю и дальше.',
        guidance: 'Отнесись к этой неделе как к спокойной личной настройке курса, а не как к марафону на выживание. Убирай лишние реакции, не раздавай обещания авансом и чаще возвращайся к вопросу: что сейчас действительно двигает меня вперёд.',
        reading:
          'Неделя собирает вокруг тебя темы приоритета, личной точности и внутренней дисциплины. Будет полезно быстро замечать, где ты движешься по сути, а где просто реагируешь на плотность вокруг.\n\nХороший сценарий этой недели выглядит так: ты заранее обозначаешь, что для тебя главное, и из-за этого становишься спокойнее даже в нагруженные дни. Тогда энергия идёт не в защиту от хаоса, а в реальное продвижение.\n\nБолее сложный сценарий начинается там, где появляется желание всё удержать, никого не подвести и не выпасть из общего темпа. В таком режиме легко накопить раздражение, а потом сорваться либо в резкость, либо в усталое безразличие.\n\nВ отношениях неделя проверяет качество контакта. Если что-то задевает, лучше называть это раньше, чем внутри строить длинный внутренний монолог, который второй человек всё равно не слышит.\n\nВ работе и деньгах выигрывает зрелая избирательность. Не всё, что выглядит срочным, одинаково важно для твоего реального курса.',
      }
    : {
        ...base,
        headline: 'This week asks for mature focus and precise choices',
        summary: 'This is less a week of outer acceleration and more a week of holding your line when tasks, expectations, and contact become denser. The more clearly you see your real priority, the less likely you are to disappear into other people’s urgency.',
        focus: 'Build the week around one supporting line and measure decisions, conversations, and workload against it.',
        theme: 'Focus and course-correction',
        opportunities: 'This week can bring real progress where you have long been ready for the next step but kept scattering yourself. What works best now is not intensity, but consistency and inner organization.',
        challenges: 'The main risk is overload from promises, ambient tension, and the urge to handle everything at once. In weeks like this, people often miss not because they misunderstand the situation, but because they move too fast or take on too much.',
        relationships: 'In relationships, the week highlights where you truly hear each other and where you communicate through assumptions and pressure. The simpler and more honest the tone, the less likely a sensitive topic turns into stored resentment.',
        career: 'In work, money, and direction, it helps to follow criteria and horizon instead of instant urgency. If a real choice appears, look not only at the immediate effect, but at what actually strengthens your position over time.',
        guidance: 'Treat this week as a calm personal course correction, not a survival sprint. Cut extra reactions, do not hand out promises too early, and keep returning to one question: what is genuinely moving me forward now?',
        reading:
          'This week gathers themes of priority, personal precision, and inner discipline around you. It helps to notice quickly where you are moving on purpose and where you are simply reacting to the density around you.\n\nThe stronger version of this week looks like this: you name what matters early, and that makes you calmer even in crowded days. Energy goes into progress instead of defense against chaos.\n\nThe harder version begins when you try to hold everything, disappoint no one, and stay inside everyone else’s pace. That is where irritation and fatigue quietly build.\n\nIn relationships, the week tests the quality of contact. If something is bothering you, it is better to name it before you build a long inner story the other person cannot hear.\n\nIn work and money, mature selectivity wins. Not everything that looks urgent deserves the same weight in your real direction.',
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
        headline: 'Месяц просит зрелой сборки и длинного взгляда',
        summary: 'Этот месяц не столько про быстрые прорывы, сколько про выстраивание более взрослой опоры под себя: в ритме, отношениях, деньгах и выборе направления. Чем меньше ты живёшь от краткого импульса к краткому импульсу, тем сильнее начинает ощущаться внутренняя устойчивость.',
        focus: 'Собирай месяц вокруг одной несущей линии: что ты реально укрепляешь, а не просто поддерживаешь по привычке.',
        theme: 'Опора и взросление',
        opportunities: 'У месяца хороший потенциал для перестройки своей базы: рабочих привычек, отношения к деньгам, внутренних правил и способов распределять силы. Это не самый эффектный путь снаружи, но один из самых сильных по результату на дистанции.',
        challenges: 'Сложность месяца в том, что внешний шум может подталкивать к сравнению, спешке и ощущению, будто ты недостаточно быстро двигаешься. На этом фоне легко принять чужой ритм за свой и начать выгорать из-за задач, которые вообще не обязаны быть твоим главным вектором.',
        relationships: 'В отношениях месяц поднимает тему зрелых границ и ясных договорённостей. Близость сейчас работает лучше там, где есть честность о потребностях, а не молчаливое ожидание, что другой сам догадается, как тебя поддержать.',
        money: 'В деньгах и работе месяц просит разделить импульс и стратегию. Особенно полезно замечать, где решение даёт краткое облегчение, а где реально усиливает твою позицию, доход или чувство контроля над направлением.',
        guidance: 'Проживай этот месяц как период внутренней сборки, а не как бесконечную гонку за подтверждением своей ценности. Возвращайся к длинному горизонту, чаще проверяй, что тебя действительно укрепляет, и не бойся пересобирать то, что давно держалось только на привычке.',
        reading:
          'Этот месяц медленно, но довольно настойчиво возвращает тебя к вопросу опоры: на чём ты сейчас стоишь внутренне, эмоционально и практически. Там, где раньше многое держалось на усилии и привычке, теперь важнее становится качество конструкции.\n\nХороший сценарий месяца выглядит не как эффектный рывок, а как постепенное взросление своего ритма. Ты начинаешь точнее выбирать, на что отдавать силы, что действительно имеет смысл поддерживать и где пора перестать изображать устойчивость вместо того, чтобы выстроить её заново.\n\nСложный сценарий включается, если пытаться жить в сравнении, спешке и постоянной проверке себя через внешние результаты. Тогда даже полезные шаги могут ощущаться как недостаточные, а эмоциональный фон становится тяжелее, чем этого требует сама реальность.\n\nВ отношениях месяц помогает увидеть, где близость строится на реальном контакте, а где на привычном молчании и самоотдаче. Чем яснее ты обозначаешь свои потребности и пределы, тем спокойнее становится сама связь.\n\nВ деньгах и работе месяц обучает взрослой избирательности. Не каждый шанс стоит включения, не каждая трата стоит облегчения, и не каждый проект должен становиться мерой твоей ценности.\n\nЕсли держать длинный взгляд и возвращаться к главному, к концу месяца легче почувствовать не просто усталость от дистанции, а реальную внутреннюю собранность.',
      }
    : {
        ...base,
        headline: 'The month asks for mature structure and a longer view',
        summary: 'This month is less about fast breakthroughs and more about building a steadier base under yourself in rhythm, relationships, money, and direction. The less you live from one short impulse to the next, the more inner stability starts to return.',
        focus: 'Organize the month around one supporting line: what are you truly strengthening instead of simply maintaining by habit?',
        theme: 'Grounding and maturity',
        opportunities: 'The month carries strong potential for rebuilding your base: work habits, money decisions, inner rules, and the way you distribute energy. It may not look dramatic from the outside, but it can become one of the most useful periods for long-term strength.',
        challenges: 'The difficulty is that outside noise may push you toward comparison, speed, and the feeling that you are not moving fast enough. In that state, it becomes easy to adopt someone else’s pace and quietly burn out in commitments that were never meant to define your direction.',
        relationships: 'In relationships, the month raises the need for mature boundaries and clearer agreements. Closeness works better where needs are spoken honestly instead of being silently handed over as expectations.',
        money: 'In money and work, the month asks you to separate impulse from strategy. It is especially useful to notice which decisions bring quick relief and which ones actually strengthen your position, income, or sense of direction.',
        guidance: 'Live this month as a period of inner restructuring rather than an endless race for proof. Keep returning to the longer horizon, keep checking what genuinely strengthens you, and do not be afraid to rebuild what was being held together only by habit.',
        reading:
          'This month steadily brings you back to the question of foundation: what are you actually standing on emotionally, practically, and inwardly? Where things were previously held together by effort and habit, the quality of the structure now matters more.\n\nThe stronger version of this month is not a flashy leap, but a gradual maturing of your rhythm. You become more selective about what deserves energy, what is truly meaningful to support, and where you no longer need to perform stability instead of building it.\n\nThe harder version begins when you live in comparison, urgency, and constant self-checking through visible results. Then even good steps can feel insufficient, and the emotional weight becomes heavier than the reality itself.\n\nIn relationships, the month helps you see where closeness is built on real contact and where it is built on silence, overgiving, or habit. The clearer you become about needs and limits, the calmer the bond itself becomes.\n\nIn money and work, adult selectivity wins. Not every opportunity deserves your energy, not every expense deserves the comfort it promises, and not every project should become a measure of your value.\n\nIf you keep the longer view and return to what matters, by the end of the month you are more likely to feel not just tired from the distance, but genuinely gathered inside it.',
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
    const { model } = await getForecastModel('base');
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
    const { model } = await getForecastModel('premium');
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
    const { model } = await getForecastModel('base');
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
    const { model } = await getForecastModel('premium');
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
