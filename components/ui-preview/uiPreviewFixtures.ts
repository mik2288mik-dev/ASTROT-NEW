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
  'charts',
  'menu',
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
  charts: 'Мои карты',
  menu: 'Меню',
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
  if (screen === 'charts') return 'charts';
  if (screen === 'menu') return 'services';
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

const UI_PREVIEW_COMPATIBILITY_DIMENSIONS: NonNullable<SynastryResult['dimensions']> = [
  { id: 'emotional_closeness', label: 'Эмоциональная близость', score: 84, confidence: 82, supportiveEvidenceIds: ['preview:moon-venus', 'preview:sun-moon'], challengingEvidenceIds: [] },
  { id: 'attraction', label: 'Притяжение', score: 88, confidence: 79, supportiveEvidenceIds: ['preview:venus-mars'], challengingEvidenceIds: [] },
  { id: 'communication', label: 'Общение', score: 64, confidence: 72, supportiveEvidenceIds: ['preview:sun-moon'], challengingEvidenceIds: ['preview:mercury-mars'] },
  { id: 'conflict_ease', label: 'Проживание конфликтов', score: 48, confidence: 76, supportiveEvidenceIds: [], challengingEvidenceIds: ['preview:mercury-mars'] },
  { id: 'trust_boundaries', label: 'Доверие и границы', score: 69, confidence: 61, supportiveEvidenceIds: ['preview:moon-venus'], challengingEvidenceIds: [] },
  { id: 'stability', label: 'Устойчивость', score: 73, confidence: 66, supportiveEvidenceIds: ['preview:sun-moon'], challengingEvidenceIds: [] },
];

const UI_PREVIEW_COMPATIBILITY_EVIDENCE: NonNullable<SynastryResult['evidence']> = [
  { id: 'preview:moon-venus', type: 'aspect', direction: 'mutual', label: 'Луна Алины — Венера Алексея: трин, орб 1,2°', weight: 0.82, reliability: 'exact', dimensionEffects: { emotional_closeness: 0.9, trust_boundaries: 0.4 } },
  { id: 'preview:venus-mars', type: 'aspect', direction: 'mutual', label: 'Венера Алины — Марс Алексея: соединение, орб 2,1°', weight: 0.74, reliability: 'exact', dimensionEffects: { attraction: 0.95 } },
  { id: 'preview:mercury-mars', type: 'aspect', direction: 'subject_to_partner', label: 'Меркурий Алины — Марс Алексея: квадрат, орб 1,8°', weight: 0.7, reliability: 'exact', dimensionEffects: { communication: -0.8, conflict_ease: -0.9 } },
  { id: 'preview:sun-moon', type: 'aspect', direction: 'mutual', label: 'Солнце Алины — Луна Алексея: секстиль, орб 2,4°', weight: 0.68, reliability: 'exact', dimensionEffects: { emotional_closeness: 0.8, stability: 0.4, communication: 0.2 } },
];

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
    schemaVersion: 'compatibility-v2',
    engineVersion: 'compatibility-engine.v1',
    overallScore: 78,
    compatibilityScore: 78,
    verdict: 'Сильная связь',
    relationshipContext: 'romance',
    calculationLevel: 'full',
    dimensions: UI_PREVIEW_COMPATIBILITY_DIMENSIONS,
    strongestDimensions: [UI_PREVIEW_COMPATIBILITY_DIMENSIONS[1], UI_PREVIEW_COMPATIBILITY_DIMENSIONS[0]],
    challengingDimensions: [UI_PREVIEW_COMPATIBILITY_DIMENSIONS[3], UI_PREVIEW_COMPATIBILITY_DIMENSIONS[2]],
    evidence: UI_PREVIEW_COMPATIBILITY_EVIDENCE,
    directionalPatterns: [{
      id: 'preview:direction',
      direction: 'partner_to_subject',
      title: 'Алексей → Алина',
      fact: 'Инициатива Алексея ускоряет способ Алины объяснять решения; под давлением разница темпа может превращаться в трение.',
      evidenceIds: ['preview:mercury-mars'],
    }],
    limitations: [],
    sections: [
      { id: 'between_you', title: 'Что между вами', text: 'Алина быстрее ловит смену настроения, Алексей отвечает на неё действием — поэтому контакт между ними возникает без долгой раскачки. Симпатия не остаётся фоном: один подаёт импульс, второй его подхватывает.\n\nСлабое место появляется позже, когда ту же скорость они переносят в сложный разговор.', evidenceIds: ['preview:moon-venus', 'preview:venus-mars'] },
      { id: 'brings_closer', title: 'Что вас сближает', text: 'Их сближает не громкая романтика, а быстрый отклик на мелочи. Один замечает усталость, второй приносит чай или берёт на себя конкретное дело — поддержка сразу становится видимой.\n\nТакой обмен снимает необходимость постоянно доказывать близость словами.', evidenceIds: ['preview:moon-venus', 'preview:sun-moon'] },
      { id: 'emotional_closeness', title: 'Эмоциональная близость', text: 'Алине проще первой назвать, что атмосфера изменилась. Алексею требуется чуть больше времени, чтобы понять причину и подобрать слова. Если паузу не принимать за холодность, уязвимый разговор не превращается в проверку чувств.', evidenceIds: ['preview:moon-venus', 'preview:sun-moon'] },
      { id: 'attraction', title: 'Притяжение', text: 'Искра у этой пары прямая: инициатива одного редко повисает без ответа. Им легко перейти от намёка к действию, поэтому контакт быстро набирает интенсивность.\n\nВажно только не считать одинаковую скорость обязательным доказательством интереса.', evidenceIds: ['preview:venus-mars'] },
      { id: 'communication', title: 'Как вы общаетесь', text: 'В спокойном разговоре они хорошо собирают общую картину: один замечает главное, второй добавляет детали. Под давлением ритм меняется — Алексей ускоряет решение, а Алина начинает защищать право договорить мысль. В этот момент спор уже идёт не о теме, а о способе разговаривать.', evidenceIds: ['preview:sun-moon', 'preview:mercury-mars'] },
      { id: 'tension', title: 'Где начинается напряжение', text: 'Повторяющийся сбой выглядит просто: один хочет прояснить всё сейчас, второй просит паузу. Если время возвращения к разговору не названо, пауза воспринимается как уход, а настойчивость — как давление.\n\nПомогает договориться не о всём сразу, а о следующем шаге и конкретном времени продолжения.', evidenceIds: ['preview:mercury-mars'] },
      { id: 'trust_boundaries', title: 'Доверие и границы', text: 'Доверие крепнет, когда забота остаётся предложением, а не попыткой решить за другого. Алине важно не угадывать молчание Алексея, Алексею — не оставлять паузу без рамки. Прямая просьба работает для этой пары лучше любой проверки на близость.', evidenceIds: ['preview:moon-venus'] },
    ],
    closing: {
      strength: 'Они быстро замечают состояние друг друга и умеют превращать внимание в конкретный поступок.',
      risk: 'В споре один требует ясности сразу, а второй берёт паузу — из-за этого тон становится важнее причины.',
      action: 'Называть один вопрос и время возвращения к нему, прежде чем разговор уйдёт в догадки.',
    },
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
    summary: 'Алина и Алексей быстро ловят настроение друг друга, и симпатия у них редко остаётся без ответа. Но в напряжении они входят в разный ритм: Алексей хочет прояснить всё сразу, Алине сначала нужна пауза, чтобы собрать мысль. Их связь становится сильнее не от угадывания чувств, а от прямой договорённости — какой вопрос решают сейчас и когда вернутся к разговору.',
  },
};

const UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS: NonNullable<SynastryResult['dimensions']> = [
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[0], score: 74 },
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[1], score: 56, supportiveEvidenceIds: [], challengingEvidenceIds: ['preview:venus-mars'] },
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[2], score: 86, supportiveEvidenceIds: ['preview:sun-moon'], challengingEvidenceIds: [] },
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[3], score: 67, supportiveEvidenceIds: ['preview:sun-moon'], challengingEvidenceIds: ['preview:mercury-mars'] },
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[4], score: 78 },
  { ...UI_PREVIEW_COMPATIBILITY_DIMENSIONS[5], score: 89 },
];

export const UI_PREVIEW_COMPATIBILITY_STEADY: typeof UI_PREVIEW_COMPATIBILITY = {
  ...UI_PREVIEW_COMPATIBILITY,
  subject: {
    name: 'Ирина',
    date: '1986-09-04',
    time: '08:10',
    place: 'Самара, Россия',
    sign: 'virgo',
  },
  partner: {
    name: 'Олег',
    date: '1984-01-16',
    time: '17:45',
    place: 'Пермь, Россия',
    sign: 'capricorn',
  },
  deepResult: {
    ...UI_PREVIEW_COMPATIBILITY.deepResult,
    overallScore: 66,
    compatibilityScore: 66,
    verdict: 'Спокойная, устойчивая связь',
    relationshipContext: 'relationship',
    dimensions: UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS,
    strongestDimensions: [UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS[5], UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS[2]],
    challengingDimensions: [UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS[1], UI_PREVIEW_COMPATIBILITY_STEADY_DIMENSIONS[3]],
    evidence: UI_PREVIEW_COMPATIBILITY_EVIDENCE.map((item) => ({
      ...item,
      label: item.label.replaceAll('Алины', 'Ирины').replaceAll('Алексея', 'Олега'),
    })),
    directionalPatterns: [{
      id: 'preview:steady-direction',
      direction: 'mutual',
      title: 'Ирина ↔ Олег',
      fact: 'Ирина проверяет детали до решения, Олег удерживает общий курс; под давлением эта разница может замедлять старт.',
      evidenceIds: ['preview:sun-moon', 'preview:mercury-mars'],
    }],
    sections: [
      { id: 'between_you', title: 'Что между вами', text: 'Ирина и Олег не разгоняют связь ради впечатления. Их контакт собирается из повторяемых вещей: сказанное выполняется, привычный ритм не приходится каждый раз отстаивать.\n\nИскры меньше, чем спокойной надёжности, — и для этой пары это не недостаток, а способ не тратить силы на постоянные проверки.', evidenceIds: ['preview:sun-moon'] },
      { id: 'emotional_closeness', title: 'Эмоциональная близость', text: 'Они редко устраивают длинные разговоры о чувствах без повода. Поддержка появляется иначе: Олег удерживает договорённость, Ирина замечает, где нужна конкретная помощь. Уязвимость становится проще, когда просьба звучит прямо.', evidenceIds: ['preview:moon-venus'] },
      { id: 'communication', title: 'Как вы общаетесь', text: 'Разговор у них предметный. Ирина проверяет детали и последствия, Олег быстрее отделяет главное от второстепенного. Вместе они принимают сильные решения, если заранее понимают: сейчас собирают варианты или уже выбирают.', evidenceIds: ['preview:sun-moon', 'preview:mercury-mars'] },
      { id: 'conflicts', title: 'Как вы проживаете конфликты', text: 'Сбой начинается с упрямого молчания. Каждый уверен, что его позиция и так понятна, поэтому спор о мелочи превращается в соревнование выдержки. Вернуться к одному факту полезнее, чем ждать, кто первым уступит.', evidenceIds: ['preview:mercury-mars'] },
      { id: 'everyday_life', title: 'Быт и привычки', text: 'Повседневность — сильная часть союза: дела не теряются, обещания не требуют напоминаний. Напряжение появляется, когда один меняет план на ходу, а второй узнаёт об этом постфактум.', evidenceIds: ['preview:sun-moon'] },
      { id: 'personal_space', title: 'Личное пространство', text: 'Обоим легче сохранять близость без постоянного контакта. Но пауза должна иметь понятную рамку: отсутствие ответа без объяснения быстро превращает спокойную дистанцию в холодность.', evidenceIds: ['preview:moon-venus'] },
      { id: 'stability', title: 'Что делает связь устойчивее', text: 'Эту пару держит предсказуемость в хорошем смысле: можно рассчитывать, что договорённость доживёт до действия. Чтобы надёжность не стала рутиной, им важно иногда менять привычный сценарий по взаимному решению, а не из внезапного недовольства.', evidenceIds: ['preview:sun-moon'] },
    ],
    closing: {
      strength: 'Договорённости этой пары не заканчиваются на словах: оба умеют доводить обещанное до действия.',
      risk: 'Молчаливое упрямство превращает небольшое несогласие в затяжное соревнование выдержки.',
      action: 'Сначала назвать один факт, с которым не согласны, и только потом обсуждать общий вывод.',
    },
    summary: 'Ирина и Олег строят связь не на постоянном эмоциональном подъёме, а на спокойной надёжности: обещания у них обычно доходят до дела. Главный сбой начинается, когда оба замолкают и ждут, что другой сам поймёт причину. Им легче сохранить близость, если обсуждать один конкретный факт раньше, чем пауза превратится в соревнование упрямства.',
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
  roles?: ForecastSection['contentBlocks'][number]['role'][],
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
      role: roles?.[index] ?? (index === 0 ? 'lead' : 'detail'),
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
  forecastSection('today-overview', 'overview', 'Туман отменяется', [
    'Сегодня твоя терпимость к мутным формулировкам официально в отпуске.',
    'Ты быстро заметишь, где разговор наконец становится ясным. Не торопи собеседника: одна спокойная пауза даст больше, чем ещё один аргумент.',
  ], ['lead', 'detail']),
  forecastSection('today-second', 'dynamic', '', [
    'Важная деталь проявится сама, если не пытаться заранее назначить ей удобный смысл. Держись фактов — они помогут принять решение без лишней суеты.',
  ], ['detail']),
  forecastSection('today-third', 'dynamic', '', [
    'Задача, которую хотелось отложить, окажется проще после первого конкретного шага. Начни с того, что можно закончить за один подход.',
  ], ['detail']),
  forecastSection('today-fourth', 'dynamic', '', [
    'В общении будет полезна прямота без нажима. Скажи, что тебе действительно нужно, и оставь другому человеку место для честного ответа.',
  ], ['detail']),
  forecastSection('today-advice', 'dynamic', '', [
    'Задай один прямой вопрос и не заполняй паузу догадками.',
  ], ['action']),
];

export const UI_PREVIEW_WEEK_SECTION = forecastSection('week-story', 'overview', 'Неделя ясных решений', [
  'Попытка успеть всё снова просится в начальники — не повышай её.',
  'На этой неделе лишние задачи будут лезть без очереди, будто им кто-то выдал VIP-пропуск. Не хватайся за каждую: один точный выбор даст больше, чем показательная занятость на десять фронтов.',
  'Разговор, который ходил по кругу, получится перевести в конкретику без театра и длинных предисловий. Спроси прямо, что каждый готов сделать, и не заполняй паузу удобными догадками.',
  'Несколько выполненных обещаний вернут тебе нормальное ощущение контроля. Идеальный план для этого не нужен — нужен человек, который перестал сам себе мешать.',
], ['lead', 'detail', 'detail', 'detail']);

export const UI_PREVIEW_WEEK_ADVICE_SECTION = forecastSection('week-advice', 'dynamic', '', [
  'Выбери одно главное дело и освободи для него два конкретных окна в расписании.',
], ['action']);

export const UI_PREVIEW_WEEK_SECTIONS: ForecastSection[] = [
  UI_PREVIEW_WEEK_SECTION,
  UI_PREVIEW_WEEK_ADVICE_SECTION,
];

export const UI_PREVIEW_MONTH_SECTION = forecastSection('month-story', 'overview', 'Месяц собирает фокус', [
  'Срочное снова надело корону, хотя важным от этого не стало.',
  'Этот месяц заставит отделить важное от шума, который просто громче всех требует внимания. Первые решения покажутся небольшими, но именно они определят, останешься ты хозяином расписания или снова будешь обслуживать чужую суету.',
  'В делах сработает простая система: меньше параллельных задач, больше законченных циклов и никаких почётных складов из недоделок. В разговорах понадобятся ясные формулировки вместо попыток угадать чужую реакцию и потом обидеться на собственную фантазию.',
  'Освободившееся внимание даст место для нового шага без очередного героического надрыва. Весь маршрут знать не обязательно — достаточно перестать сворачивать к каждой яркой вывеске.',
], ['lead', 'detail', 'detail', 'detail']);

export const UI_PREVIEW_MONTH_ADVICE_SECTION = forecastSection('month-advice', 'dynamic', '', [
  'Закрой один затянувшийся цикл до того, как открывать следующий.',
], ['action']);

export const UI_PREVIEW_MONTH_SECTIONS: ForecastSection[] = [
  UI_PREVIEW_MONTH_SECTION,
  UI_PREVIEW_MONTH_ADVICE_SECTION,
];
