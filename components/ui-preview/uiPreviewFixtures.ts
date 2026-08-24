import type { ForecastSection } from '../../lib/personalForecastContract';
import type { PreloadedNatalReport } from '../NatalReading/HumanReport';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildNatalModelContext,
  buildPermanentNatalChartFingerprint,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
} from '../../lib/natalReading/permanentReport';
import type {
  BirthTimeQuality,
  NatalChartData,
  PlanetPosition,
  SignHoroscopeReadingV2,
  SynastryResult,
  UserProfile,
  ViewState,
} from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import type { PremiumPlanId } from '../../lib/premiumPricing';
import type { AccountAuthCapabilities, LinkedIdentity } from '../../services/accountAuthService';
import type { ChartListItem } from '../../services/storageService';

export const UI_PREVIEW_SCREENS = [
  'onboarding',
  'zodiac-picker',
  'today',
  'week',
  'month',
  'horoscope',
  'natal',
  'natal-reading',
  'compatibility-input',
  'compatibility-signs',
  'compatibility-result',
  'encyclopedia',
  'settings',
  'more',
  'paywall',
  'question',
] as const;

export const UI_PREVIEW_ACCESS = ['guest', 'free', 'premium'] as const;
export const UI_PREVIEW_STATES = [
  'ready',
  'loading',
  'error',
  'empty',
  'offline',
  'premium-locked',
] as const;
export const UI_PREVIEW_BIRTH_TIMES = ['exact', 'approximate', 'unknown'] as const;

export type UiPreviewScreen = (typeof UI_PREVIEW_SCREENS)[number];
export type UiPreviewAccess = (typeof UI_PREVIEW_ACCESS)[number];
export type UiPreviewState = (typeof UI_PREVIEW_STATES)[number];
export type UiPreviewBirthTime = (typeof UI_PREVIEW_BIRTH_TIMES)[number];

export type UiPreviewScenario = {
  screen: UiPreviewScreen;
  access: UiPreviewAccess;
  state: UiPreviewState;
  birthTime: UiPreviewBirthTime;
};

export const UI_PREVIEW_SCREEN_LABELS: Record<UiPreviewScreen, string> = {
  onboarding: 'Онбординг',
  'zodiac-picker': 'Выбор знака',
  today: 'Личный прогноз на сегодня',
  week: 'Личный прогноз на неделю',
  month: 'Личный прогноз на месяц',
  horoscope: 'Гороскоп по знакам',
  natal: 'Натальное колесо',
  'natal-reading': 'Натальный разбор',
  'compatibility-input': 'Совместимость — данные',
  'compatibility-signs': 'Совместимость — знаки',
  'compatibility-result': 'Совместимость — результат',
  encyclopedia: 'Хочу знать',
  settings: 'Настройки',
  more: 'Ещё',
  paywall: 'Paywall',
  question: 'Узнать о себе',
};

const ACCESS_ALIASES: Record<string, UiPreviewAccess> = {
  guest: 'guest',
  free: 'free',
  premium: 'premium',
};
const STATE_ALIASES: Record<string, UiPreviewState> = {
  ready: 'ready',
  loading: 'loading',
  error: 'error',
  empty: 'empty',
  offline: 'offline',
  locked: 'premium-locked',
  'premium-locked': 'premium-locked',
  premium_locked: 'premium-locked',
};
const BIRTH_TIME_ALIASES: Record<string, UiPreviewBirthTime> = {
  exact: 'exact',
  approximate: 'approximate',
  approx: 'approximate',
  unknown: 'unknown',
};

export function parseUiPreviewScenario(search: string): UiPreviewScenario {
  const query = new URLSearchParams(search);
  const requestedScreen = query.get('screen') || '';
  const screen = UI_PREVIEW_SCREENS.includes(requestedScreen as UiPreviewScreen)
    ? requestedScreen as UiPreviewScreen
    : 'today';

  return {
    screen,
    access: ACCESS_ALIASES[query.get('access') || ''] || 'premium',
    state: STATE_ALIASES[query.get('state') || ''] || 'ready',
    birthTime: BIRTH_TIME_ALIASES[query.get('birthTime') || ''] || 'exact',
  };
}

export function scenarioToSearch(scenario: UiPreviewScenario): string {
  const query = new URLSearchParams({
    uiPreview: '1',
    screen: scenario.screen,
    access: scenario.access,
    state: scenario.state,
    birthTime: scenario.birthTime,
  });
  return `?${query.toString()}`;
}

export function previewViewForScreen(screen: UiPreviewScreen): ViewState {
  if (screen === 'today' || screen === 'week' || screen === 'month' || screen === 'paywall') {
    return 'dashboard';
  }
  if (screen === 'zodiac-picker' || screen === 'horoscope') return 'horoscope';
  if (screen.startsWith('compatibility-')) return 'synastry';
  if (screen === 'encyclopedia') return 'encyclopedia';
  if (screen === 'settings') return 'settings';
  if (screen === 'more') return 'more';
  if (screen === 'natal-reading') return 'personality';
  return 'chart';
}

export function createUiPreviewProfile(
  access: UiPreviewAccess,
  birthTime: UiPreviewBirthTime,
): UserProfile {
  const hasData = access !== 'guest';
  const premium = access === 'premium';
  return {
    id: `ui-preview-${access}`,
    authProvider: access === 'guest' ? 'web_guest' : 'native',
    isGuest: access === 'guest',
    name: hasData ? 'Алина' : '',
    birthDate: hasData ? '1990-03-14' : '',
    birthTime: hasData && birthTime !== 'unknown' ? '09:41' : '',
    birthPlace: hasData ? 'Москва, Россия' : '',
    birthLatitude: hasData ? 55.7558 : null,
    birthLongitude: hasData ? 37.6173 : null,
    birthTimezone: hasData ? 'Europe/Moscow' : null,
    isSetup: hasData,
    language: 'ru',
    theme: 'light',
    isPremium: premium,
    premiumUntil: premium ? '2099-12-31T23:59:59.000Z' : null,
    selectedZodiacSign: hasData ? 'Pisces' : null,
    gender: 'female',
    notificationFrequency: 'important',
  };
}

function planet(
  name: string,
  sign: string,
  degree: number,
  longitude: number,
  house: number,
): PlanetPosition {
  return {
    planet: name,
    sign,
    degree,
    longitude,
    house,
    retrograde: false,
    description: 'Синтетическая позиция для локального UI Preview.',
  };
}

export function createUiPreviewChart(birthTime: UiPreviewBirthTime): NatalChartData {
  const quality = birthTime as BirthTimeQuality;
  const reliableTime = quality === 'exact';
  return {
    sun: planet('Sun', 'Pisces', 11, 341, 1),
    moon: planet('Moon', 'Scorpio', 18, 228, 9),
    rising: planet('Ascendant', 'Scorpio', 4, 214, 1),
    mercury: planet('Mercury', 'Aquarius', 26, 326, 4),
    venus: planet('Venus', 'Aries', 3, 3, 5),
    mars: planet('Mars', 'Taurus', 8, 38, 6),
    jupiter: planet('Jupiter', 'Gemini', 2, 62, 7),
    saturn: planet('Saturn', 'Taurus', 14, 44, 6),
    uranus: planet('Uranus', 'Aquarius', 19, 319, 4),
    neptune: planet('Neptune', 'Aquarius', 6, 306, 3),
    pluto: planet('Pluto', 'Sagittarius', 12, 252, 2),
    element: 'Water',
    rulingPlanet: 'Neptune',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
    houses: [
      ['Scorpio', 4, 214], ['Sagittarius', 8, 248], ['Capricorn', 15, 285],
      ['Aquarius', 22, 322], ['Pisces', 24, 354], ['Aries', 19, 19],
      ['Taurus', 4, 34], ['Gemini', 8, 68], ['Cancer', 15, 105],
      ['Leo', 22, 142], ['Virgo', 24, 174], ['Libra', 19, 199],
    ].map(([sign, degree, longitude], index) => ({
      house: index + 1,
      sign: String(sign),
      degree: Number(degree),
      longitude: Number(longitude),
    })),
    aspects: [
      { type: 'trine', angle: 120, orb: 1.2, from: 'Sun', to: 'Moon' },
      { type: 'square', angle: 90, orb: 2.1, from: 'Mercury', to: 'Mars' },
      { type: 'sextile', angle: 60, orb: 0.8, from: 'Venus', to: 'Jupiter' },
      { type: 'opposition', angle: 180, orb: 2.4, from: 'Moon', to: 'Saturn' },
    ],
    calculationVersion: 'ui-preview-fixture.v1',
    calculationMetadata: {
      ephemerisMode: 'swisseph',
      houseSystem: 'placidus',
      housesComputedFrom: reliableTime ? 'exact_time' : 'default_noon',
    },
    birthTimeQuality: quality,
    chartQuality: {
      birthTimeQuality: quality,
      ascendantReliable: reliableTime,
      housesReliable: reliableTime,
      houseBasedPersonalization: reliableTime,
      notes: reliableTime ? [] : ['Время рождения задано неточно в синтетическом сценарии.'],
    },
    summary: 'Синтетическая натальная карта для локальной визуальной проверки.',
  };
}

export function createUiPreviewNatalReport(
  profile: UserProfile,
  chart: NatalChartData,
): PreloadedNatalReport {
  const built = buildNatalModelContext(profile, chart);
  const availableEvidenceIds = built.context.evidence.map((fact) => fact.id);
  if (!availableEvidenceIds.length) {
    throw new Error('UI Preview natal fixture requires chart evidence.');
  }
  const evidenceAt = (index: number) => availableEvidenceIds[index % availableEvidenceIds.length];
  const freeSections: NatalPermanentFreeReport['freeSections'] = [
    {
      key: 'base_portrait',
      title: 'Твоя внутренняя опора',
      access: 'free',
      content: 'Ты быстро замечаешь перемену в атмосфере, но окончательный вывод предпочитаешь проверять фактами. Поэтому твоя точность особенно заметна после короткой паузы, когда первое впечатление уже отделено от реального положения дел.',
      evidenceIds: [evidenceAt(1)],
    },
    {
      key: 'thinking',
      title: 'Как ты принимаешь решения',
      access: 'free',
      content: 'Тебе легче думать, когда у разговора есть ясная цель. Ты умеешь удерживать несколько нюансов одновременно, но лучше всего раскрываешься там, где можно назвать критерии выбора и спокойно довести мысль до конца.',
      evidenceIds: [evidenceAt(2)],
    },
    {
      key: 'emotional_world',
      title: 'Что происходит внутри',
      access: 'free',
      content: 'Сильные переживания не всегда сразу становятся словами. Сначала ты присматриваешься к собственной реакции, а затем ищешь формулировку, которая не преувеличивает происходящее и всё же остаётся честной.',
      evidenceIds: [evidenceAt(3)],
    },
    {
      key: 'strengths',
      title: 'Твоя сильная сторона',
      access: 'free',
      content: 'Ты умеешь возвращать сложному разговору ясность без лишнего нажима. Эта способность особенно полезна, когда другим хочется торопиться: ты замечаешь недостающую деталь и помогаешь превратить общее ощущение в конкретное решение.',
      evidenceIds: [evidenceAt(4)],
    },
  ];
  const reportEvidenceIds = Array.from(new Set([
    evidenceAt(0),
    ...freeSections.flatMap((section) => section.evidenceIds || []),
  ]));
  const report: NatalPermanentFreeReport = {
    schemaVersion: 'natal-permanent-free-v3',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'free',
    evidenceIds: reportEvidenceIds,
    hook: {
      text: 'Ты замечаешь нюансы раньше, чем успеваешь объяснить их словами, а ясность возвращаешь через один конкретный шаг.',
      evidenceIds: [evidenceAt(0)],
    },
    userName: profile.name || 'Алина',
    birthData: {
      birthDate: profile.birthDate || '1990-03-14',
      birthTime: chart.birthTimeQuality === 'unknown' ? null : profile.birthTime || '09:41',
      birthPlace: profile.birthPlace || 'Москва, Россия',
    },
    calculatedAt: '2026-08-22T09:41:00.000Z',
    freeSections,
    paidSections: [],
    premiumSections: [],
    shortCard: {
      title: freeSections[0].title,
      keywords: ['точность', 'наблюдательность', 'ясность'],
      text: freeSections[0].content,
      advice: 'Дай себе короткую паузу перед важным ответом.',
      evidenceIds: freeSections[0].evidenceIds,
    },
  };

  return {
    report,
    chartFingerprint: buildPermanentNatalChartFingerprint(profile, chart),
    reportVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  };
}

export function createUiPreviewNatalPremiumReport(
  profile: UserProfile,
  chart: NatalChartData,
): NatalPermanentPremiumReport {
  const evidenceIds = buildNatalModelContext(profile, chart).context.evidence.map((fact) => fact.id);
  const evidenceAt = (index: number) => evidenceIds[index % evidenceIds.length] || 'natal.quality.birth-time';
  const statement = (text: string, index: number) => ({ text, evidenceIds: [evidenceAt(index)] });
  const sections: NatalPermanentPremiumReport['sections'] = [
    {
      id: 'relationships',
      title: 'Близость и доверие',
      paragraphs: [
        statement('Тебе важно, чтобы близость не отменяла ясность. Ты лучше раскрываешься рядом с человеком, который не торопит тебя с выводами и умеет говорить прямо без давления.', 1),
        statement('Когда доверие уже есть, ты замечаешь тонкие перемены в разговоре и можешь вовремя вернуть ему спокойный, предметный ритм.', 2),
      ],
    },
    {
      id: 'conflict',
      title: 'Как ты проходишь через конфликт',
      paragraphs: [
        statement('В напряжённой ситуации тебе полезно сначала отделить сам факт от первой реакции. После этой паузы ты точнее видишь, что действительно требует ответа, а что можно оставить без продолжения.', 3),
      ],
    },
    {
      id: 'work',
      title: 'Работа и собственный темп',
      paragraphs: [
        statement('Ты сильнее там, где можно держать в поле зрения несколько деталей, но всё равно прийти к одному понятному решению. Слишком шумная среда расходует внимание быстрее, чем сложная задача.', 4),
      ],
    },
    {
      id: 'contradictions',
      title: 'Внутренние противоречия',
      paragraphs: [
        statement('Иногда желание разобраться во всём до конца спорит с потребностью сохранить силы. Для тебя особенно ценен момент, когда уже достаточно фактов, чтобы выбрать направление и не продолжать проверку по инерции.', 5),
      ],
    },
  ];
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: 'Полный портрет карты',
    headlineEvidenceIds: [evidenceAt(0)],
    lead: statement('Продолжение раскрывает устойчивые способы строить близость, работать и проходить через напряжение.', 0),
    sections,
    strategies: [],
    pitfalls: [],
    conclusion: statement('Твоя опора — ясность, которой не нужно становиться жёсткостью.', 6),
    evidenceIds: Array.from(new Set(sections.flatMap((section) => (
      section.paragraphs.flatMap((paragraph) => paragraph.evidenceIds)
    )))),
  };
}

export function createUiPreviewCharts(
  profile: UserProfile,
  chart: NatalChartData,
): ChartListItem[] {
  return [{
    id: 1,
    user_id: String(profile.id || 'ui-preview-user'),
    name: profile.name || 'Алина',
    chart_data: chart,
    birth_date: profile.birthDate || '1990-03-14',
    birth_time: profile.birthTime || null,
    birth_place: profile.birthPlace || 'Москва, Россия',
    input_hash: 'ui-preview-primary',
    calculation_version: chart.calculationVersion || 'ui-preview-fixture.v1',
    is_primary: true,
    subject_type: 'self',
    relation_label: null,
    access_locked: false,
  }];
}

export const UI_PREVIEW_HOROSCOPE: {
  sign: string;
  readings: Record<'today' | 'week' | 'month', SignHoroscopeReadingV2>;
} = {
  sign: 'pisces',
  readings: {
    today: {
      schemaVersion: 'sign-horoscope-reading-v4',
      sign: 'pisces',
      period: 'day',
      periodKey: '2026-08-22',
      headline: 'День для точного разговора.',
      text: 'Сегодня проще услышать суть и не распыляться на детали. Если нужен ответ, задай прямой вопрос и дай человеку время сформулировать свою позицию.',
    },
    week: {
      schemaVersion: 'sign-horoscope-reading-v4',
      sign: 'pisces',
      period: 'week',
      periodKey: '2026-W34',
      headline: 'Неделя возвращает ясный ритм.',
      text: 'Не пытайся ускорить все дела одновременно. Один выбранный приоритет поможет спокойно завершить важное и оставить место для разговора, который давно требовал конкретики.',
    },
    month: {
      schemaVersion: 'sign-horoscope-reading-v4',
      sign: 'pisces',
      period: 'month',
      periodKey: '2026-08',
      headline: 'Месяц собирает внимание.',
      text: 'Станет проще отличить важное от просто срочного. Решения окажутся надёжнее, если опираться на факты, завершать начатое и не додумывать чужую реакцию заранее.',
    },
  },
};

export const UI_PREVIEW_COMPATIBILITY: {
  subject: { name: string; date: string; time: string; place: string; sign: string };
  partner: { name: string; date: string; time: string; place: string; sign: string };
  signCompatibility: SignCompatibilityResult;
  deepResult: SynastryResult;
} = {
  subject: {
    name: 'Алина',
    date: '1990-03-14',
    time: '09:41',
    place: 'Москва, Россия',
    sign: 'pisces',
  },
  partner: {
    name: 'Алексей',
    date: '1988-07-22',
    time: '18:30',
    place: 'Санкт-Петербург, Россия',
    sign: 'cancer',
  },
  signCompatibility: {
    signA: 'Pisces',
    signB: 'Cancer',
    attraction: 'Вы быстро замечаете настроение друг друга и умеете поддержать без лишних объяснений. Рядом проще быть мягче и не защищать каждое своё решение.',
    difficulty: 'Сложности начинаются, когда один ждёт, что его поймут без слов, а второй берёт паузу. Недосказанность здесь сильнее самого повода для спора.',
    communication: 'Говорите о просьбах прямо и проверяйте, одинаково ли вы поняли важный разговор. Эта связь становится устойчивее, когда забота не подменяет ясность.',
    limitation: 'Это общий разбор только по двум знакам. Полные данные рождения могут изменить картину.',
  },
  deepResult: {
    compatibilityScore: 78,
    fullAnalysis: {
      generalTheme: 'Связь держится на внимании к состоянию друг друга и способности создавать спокойное пространство для разговора.',
      attraction: 'Вас сближает мягкость, которую не нужно доказывать. Один замечает перемену настроения раньше, чем она становится словами, второй умеет вернуть разговор к тому, что действительно важно.\n\nПритяжение особенно заметно там, где можно не играть роль и не ускорять близость ради внешнего эффекта.',
      difficulties: 'Главная точка напряжения — ожидание, что близкий человек сам догадается о просьбе. Пауза может восприниматься как холодность, а забота — как попытка решить всё за другого.\n\nРазговор становится сложнее, если оба сначала оберегают атмосферу и только потом называют причину недовольства.',
      recommendations: [
        'Называть просьбу до того, как она превратится в претензию.',
        'Не считать паузу отказом без прямого вопроса.',
        'Оставлять друг другу право на разный темп решения.',
      ],
      potential: 'У этой пары хороший запас устойчивости. Связь становится крепче, когда внимание к чувствам соединяется с конкретными договорённостями и каждый отвечает за собственный выбор.',
    },
    summary: 'Вы хорошо чувствуете друг друга, но надёжность появляется не из догадок, а из прямых договорённостей. Чем меньше вы решаете за другого, тем спокойнее и сильнее становится связь.',
  },
};

export const UI_PREVIEW_SETTINGS: {
  notificationEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  identities: LinkedIdentity[];
  authCapabilities: AccountAuthCapabilities;
} = {
  notificationEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  identities: [
    {
      provider: 'email',
      email: 'alina.preview@example.test',
      displayName: 'Алина',
      verifiedAt: '2026-08-22T09:00:00.000Z',
      lastUsedAt: '2026-08-22T09:00:00.000Z',
    },
  ],
  authCapabilities: {
    vk: true,
    yandex: true,
    google: true,
    email: true,
    emailPassword: true,
    emailDelivery: true,
  },
};

export const UI_PREVIEW_PAYWALL_PLANS: Array<{
  id: PremiumPlanId;
  periodLabel: string;
  priceLabel: string;
  autoRenew: boolean;
}> = [
  { id: 'premium_month', periodLabel: '1 месяц', priceLabel: '399 ₽', autoRenew: true },
  { id: 'premium_quarter', periodLabel: '3 месяца', priceLabel: '899 ₽', autoRenew: true },
  { id: 'premium_year', periodLabel: '1 год', priceLabel: '2 999 ₽', autoRenew: true },
];

function forecastSection(
  id: string,
  kind: ForecastSection['kind'],
  title: string,
  paragraphs: string[],
): ForecastSection {
  return {
    id,
    kind,
    status: 'ready',
    diagnosticCode: null,
    title,
    text: paragraphs.join('\n\n'),
    contentBlocks: paragraphs.map((text, index) => ({
      id: `${id}-block-${index + 1}`,
      role: index === 0 ? 'lead' : 'detail',
      text,
      semanticFactId: `${id}-fact-${index + 1}`,
      atomId: `${id}-atom-${index + 1}`,
      evidenceIds: [],
      explanationAnchorId: null,
    })),
    semanticFactIds: paragraphs.map((_, index) => `${id}-fact-${index + 1}`),
    semanticFingerprint: `ui-preview:${id}`,
    importance: kind === 'overview' ? 1 : 0.7,
    visualTag: 'none',
    visualCue: null,
    presentationStyle: 'prose',
    premiumTeaser: 'Продолжение доступно в Premium.',
    lockedPreview: {
      lead: 'Главная мысль уже видна.',
      blurred: 'Продолжение истории скрыто в этом сценарии.',
      teaser: 'Открыть полный текст',
    },
    explanationAnchors: [],
  };
}

export const UI_PREVIEW_TODAY_SECTIONS: ForecastSection[] = [
  forecastSection('today-overview', 'overview', 'Слова сегодня точные.', [
    'Ты быстро заметишь, где разговор наконец становится ясным. Не торопи собеседника: одна спокойная пауза даст больше, чем ещё один аргумент.',
  ]),
  forecastSection('today-second', 'dynamic', '', [
    'В первой половине дня важная деталь проявится сама. Держись фактов — они помогут принять решение без лишней суеты.',
  ]),
  forecastSection('today-third', 'dynamic', '', [
    'Задача, которую хотелось отложить, окажется проще после первого конкретного шага. Начни с того, что можно закончить за один подход.',
  ]),
  forecastSection('today-fourth', 'dynamic', '', [
    'В общении будет полезна прямота без нажима. Скажи, что тебе действительно нужно, и оставь другому человеку место для честного ответа.',
  ]),
  forecastSection('today-fifth', 'dynamic', '', [
    'К вечеру станет понятнее, что стоит продолжать, а что можно отпустить без сожаления. Это не потеря, а освобождённое внимание.',
  ]),
];

export const UI_PREVIEW_WEEK_SECTION = forecastSection('week-story', 'overview', 'Неделя ясных решений', [
  'На этой неделе многое станет легче после одного точного выбора. Не нужно ускорять все процессы сразу: достаточно определить главное и защищать для него время.',
  'Разговор, который раньше ходил по кругу, можно перевести в конкретику. Спроси прямо, что каждый готов сделать, и не заполняй паузы догадками.',
  'К концу недели появится спокойное ощущение опоры. Оно придёт не из идеального плана, а из нескольких выполненных обещаний самому себе.',
]);

export const UI_PREVIEW_MONTH_SECTION = forecastSection('month-story', 'overview', 'Месяц собирает фокус', [
  'Этот месяц помогает отделить важное от просто срочного. Первые решения могут казаться небольшими, но именно они зададут удобный ритм на следующие недели.',
  'В делах будет полезна простая система: меньше параллельных задач, больше законченных циклов. В отношениях — ясные формулировки вместо попыток угадать чужую реакцию.',
  'Ближе к концу месяца освободится место для нового шага. Не обязательно заранее знать весь маршрут; достаточно увидеть следующий честный выбор.',
]);
