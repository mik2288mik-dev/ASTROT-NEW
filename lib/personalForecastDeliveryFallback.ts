import type { NatalChartData, UserProfile } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  buildPersonalForecastChartFingerprint,
  formatPersonalForecastDateLabel,
  selectTodayFreeSections,
  stableHash,
  type ForecastPresentationStyle,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';

const PROFILE_EVIDENCE_ID = 'profile:personal';
const DELIVERY_FALLBACK_VERSION = 'personal-forecast-delivery-fallback-v1';

type DayFragment = {
  text: string;
  presentationStyle: ForecastPresentationStyle;
};

type DayFallback = {
  headline: string;
  fragments: DayFragment[];
};

const DAY_FALLBACKS_RU: readonly DayFallback[] = [
  {
    headline: 'Сначала опора, потом рывок',
    fragments: [
      {
        presentationStyle: 'prose',
        text: 'Сегодня лучше выбрать то, что спокойно работает, а не то, что громче выглядит. У тебя достаточно внимания, чтобы заметить слабое место до того, как оно станет настоящей проблемой.',
      },
      {
        presentationStyle: 'prose',
        text: 'В разговоре или общей задаче не торопись первым закрывать все вопросы. Короткая пауза поможет понять, где от тебя ждут решения, а где достаточно просто обозначить свою позицию.',
      },
      {
        presentationStyle: 'pull_quote',
        text: 'Спокойное решение сегодня сильнее эффектного жеста.',
      },
      {
        presentationStyle: 'prose',
        text: 'Если что-то давно держится только на терпении, приведи в порядок одну конкретную деталь. Не перестраивай всё сразу: нормальный результат важнее резкого движения.',
      },
      {
        presentationStyle: 'paper_note',
        text: 'Сделай одну вещь надёжно.',
      },
    ],
  },
  {
    headline: 'Не разбрасывайся на лишнее',
    fragments: [
      {
        presentationStyle: 'prose',
        text: 'Сегодня проще продвинуться, если не пытаться одновременно удержать все планы. Выбери одно дело, которое действительно изменит положение, и доведи его до ясного промежуточного результата без лишней спешки.',
      },
      {
        presentationStyle: 'prose',
        text: 'Возможна обычная сцена: кто-то просит быстрый ответ, хотя условий ещё не хватает. Не заполняй пробелы догадками. Сначала уточни, что именно нужно решить сейчас и кто за что отвечает.',
      },
      {
        presentationStyle: 'pull_quote',
        text: 'Ясность сегодня полезнее скорости и громких обещаний.',
      },
      {
        presentationStyle: 'prose',
        text: 'Твоя сильная сторона — видеть практический смысл. Используй её без жёсткости: отдели важное от шумного, оставь второстепенное на потом и не объясняй дольше, чем требуется.',
      },
      {
        presentationStyle: 'paper_note',
        text: 'Один точный шаг. Без суеты.',
      },
    ],
  },
  {
    headline: 'Тише значит точнее',
    fragments: [
      {
        presentationStyle: 'prose',
        text: 'Сегодня не обязательно доказывать силу темпом. Лучше спокойно проверить, на чём держится решение, договорённость или задача, прежде чем добавлять к ним новые обязательства и чужие ожидания.',
      },
      {
        presentationStyle: 'prose',
        text: 'Если разговор начинает расползаться, верни его к одному конкретному вопросу. Это не холодность, а способ не тратить силы на то, чего никто толком не формулировал и не собирался выполнять.',
      },
      {
        presentationStyle: 'pull_quote',
        text: 'Назови главное и не защищай его целый час.',
      },
      {
        presentationStyle: 'prose',
        text: 'В делах полезно закрыть одну давно висящую мелочь. После неё станет понятнее, что действительно требует продолжения, а что держалось только по привычке и боязни всё пересобрать.',
      },
      {
        presentationStyle: 'paper_note',
        text: 'Сначала факты. Потом движение.',
      },
    ],
  },
] as const;

const DAY_FALLBACK_EN: DayFallback = {
  headline: 'Build the base before the push',
  fragments: [
    {
      presentationStyle: 'prose',
      text: 'Today works better when you choose what can hold up quietly instead of what looks impressive first. You have enough attention to notice a weak point before it becomes a real problem.',
    },
    {
      presentationStyle: 'prose',
      text: 'In a conversation or shared task, do not rush to close every question yourself. A short pause can show where a decision is needed and where a clear position is enough.',
    },
    {
      presentationStyle: 'pull_quote',
      text: 'A calm decision is stronger than a dramatic gesture.',
    },
    {
      presentationStyle: 'prose',
      text: 'If something has survived mainly on patience, fix one concrete detail. Do not rebuild everything at once: a result that holds matters more than a sudden move.',
    },
    {
      presentationStyle: 'paper_note',
      text: 'Make one thing reliable.',
    },
  ],
};

const WEEK_FALLBACK_RU = {
  headline: 'Собери неделю вокруг главного',
  text: 'На этой неделе полезно не расширять список дел, а сделать заметнее один результат, который давно просится наружу. Ты можешь долго настраивать мысль, сообщение или решение внутри, пока оно не станет достаточно точным. Сейчас важнее дать ему рабочую форму, чем доводить до идеала. В разговоре держись конкретики: что уже понятно, что ещё нужно проверить и кто отвечает за следующий шаг. Если появится давление, не уходи в молчание и не соглашайся из усталости. Коротко обозначь границу и вернись к сути. Неделя лучше работает на последовательность: один нормальный шаг, затем следующий, без попытки одним движением перестроить всё.',
};

const MONTH_FALLBACK_RU = {
  headline: 'Месяц собирается вокруг опоры',
  text: 'В этом месяце главное — укрепить то, на чём уже держатся твои решения, быт и договорённости. Необязательно начинать большой переворот: гораздо полезнее заметить место, где ты слишком долго терпел неудобство только потому, что оно казалось мелким. Выбери одну практическую настройку и доведи её до понятного результата. В общении особенно ценна надёжность: не красивые обещания, а то, что повторяется без лишнего шума. Люди и дела, рядом с которыми не нужно изображать лёгкость, окажутся полезнее случайного впечатления. Когда основание станет крепче, появится больше свободы для интересного, а не только срочного. Не спеши добавлять новое, пока старое всё ещё требует постоянного ручного контроля.',
};

const WEEK_FALLBACK_EN = {
  headline: 'Build the week around one result',
  text: 'This week is easier to use when you stop expanding the list and make one result visible. You can spend a long time refining a thought, message, or decision before it feels exact enough. Give it a workable form before trying to make it perfect. Keep conversations concrete: what is already clear, what still needs checking, and who owns the next step. If pressure appears, do not disappear from the conversation and do not agree from fatigue. State the boundary briefly and return to the point. The week rewards sequence: one solid step, then the next, without trying to rebuild everything in a single move.',
};

const MONTH_FALLBACK_EN = {
  headline: 'The month needs a stronger base',
  text: 'This month is about strengthening what already carries your decisions, routines, and agreements. A dramatic reset is not required. It is more useful to notice the place where you have tolerated a small inconvenience for too long. Choose one practical adjustment and take it to a clear result. Reliability matters more than attractive promises: look for what repeats without extra noise. People and tasks that do not require you to perform ease will be more useful than a quick impression. Once the base is stronger, there is more room for what is genuinely interesting instead of only urgent. Do not add more while the old system still needs constant manual control.',
};

function createSection(input: {
  id: string;
  title?: string;
  text: string;
  presentationStyle: ForecastPresentationStyle;
  overview: boolean;
  index: number;
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
}): ForecastSection {
  const evidenceIds = [PROFILE_EVIDENCE_ID];
  const anchorId = `anchor:${input.id}`;
  const teaser = input.language === 'ru'
    ? 'Открой полный текст личного прогноза.'
    : 'Open the full personal forecast.';
  return {
    id: input.id,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready',
    diagnosticCode: null,
    title: input.title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text: input.text,
    contentBlocks: [{
      id: `${input.id}:fallback:1`,
      role: input.overview ? 'lead' : 'insight',
      text: input.text,
      semanticFactId: PROFILE_EVIDENCE_ID,
      atomId: `${DELIVERY_FALLBACK_VERSION}:${input.period}:${input.index}`,
      evidenceIds,
      astro_evidence: null,
      explanationAnchorId: anchorId,
    }],
    semanticFactIds: evidenceIds,
    semanticFingerprint: `delivery:${Math.abs(stableHash(`${input.id}|${input.text}`)).toString(36)}`,
    importance: Math.max(1, 100 - input.index),
    visualTag: 'personal-story',
    visualCue: null,
    ...(input.period === 'day' ? { presentationStyle: input.presentationStyle } : {}),
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(input.text, teaser),
    explanationAnchors: [{
      id: anchorId,
      conclusion: input.text,
      explanation: input.language === 'ru'
        ? 'Текст собран из сохранённого личного контекста и выбранного периода.'
        : 'The text uses the saved personal context and selected period.',
      evidenceIds,
    }],
    inlineAstroAccent: null,
  };
}

export function createPersonalForecastDeliveryFallback(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  diagnosticCode?: string | null;
  model?: string | null;
}): PersonalForecastPackage {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const seed = [
    String(input.profile.id || 'guest'),
    input.window.periodKey,
    buildPersonalForecastChartFingerprint(input.chartData),
  ].join('|');

  let headline: string;
  let fragments: DayFragment[];
  if (input.period === 'day') {
    const day = language === 'ru'
      ? DAY_FALLBACKS_RU[Math.abs(stableHash(seed)) % DAY_FALLBACKS_RU.length]
      : DAY_FALLBACK_EN;
    headline = day.headline;
    fragments = [...day.fragments];
  } else {
    const story = input.period === 'week'
      ? (language === 'ru' ? WEEK_FALLBACK_RU : WEEK_FALLBACK_EN)
      : (language === 'ru' ? MONTH_FALLBACK_RU : MONTH_FALLBACK_EN);
    headline = story.headline;
    fragments = [{ text: story.text, presentationStyle: 'prose' }];
  }

  const allSections = fragments.map((fragment, index) => createSection({
    id: index === 0 ? 'overview' : `semantic:delivery-fallback-${index}`,
    title: index === 0 ? headline : undefined,
    text: fragment.text,
    presentationStyle: fragment.presentationStyle,
    overview: index === 0,
    index,
    language,
    period: input.period,
  }));
  const [overview, ...sections] = allSections;
  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({
        sections,
        userId: String(input.profile.id || 'guest'),
        periodKey: input.window.periodKey,
      })
    : {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      };

  return {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(input.window, language),
    timezone: input.window.timezone,
    overview,
    sections,
    suggestedCrossPeriodLinks: [],
    evidence: {
      [PROFILE_EVIDENCE_ID]: {
        id: PROFILE_EVIDENCE_ID,
        factor: language === 'ru' ? 'Сохранённый личный контекст' : 'Saved personal context',
        orb: null,
        status: 'active',
        period: input.window.periodKey,
        meaning: language === 'ru'
          ? 'Резервный текст использует сохранённый личный контекст и выбранный период.'
          : 'The fallback text uses saved personal context and the selected period.',
      },
    },
    visual: {
      sectionAssetIds: Object.fromEntries(allSections.map((section) => [section.id, null])),
    },
    meta: {
      model: input.model?.trim() || DELIVERY_FALLBACK_VERSION,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: 0,
      validationStatus: 'deterministic_fallback',
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: input.diagnosticCode || 'PERSONAL_FORECAST_DELIVERY_FALLBACK',
      visualFallback: true,
      freeSelection,
    },
  };
}
