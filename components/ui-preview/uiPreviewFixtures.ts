import type { ForecastSection, PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU } from '../../lib/personalForecastExamples';
import type { PreloadedNatalReport } from '../NatalReading/HumanReport';
import {
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  NATAL_REPORT_CATEGORIES,
  NATAL_REPORT_MAIN_PREVIEW_KEYS,
  getNatalReportAnswer,
  isNatalReportAnswerFree,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
} from '../../lib/natalReading/reportCatalog';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildNatalModelContext,
  buildPermanentNatalChartFingerprint,
  getNatalNarrativeEvidenceIds,
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

export type UiPreviewNatalCatalog = {
  categoryPacks: Record<NatalReportCategoryKey, NatalReportCategoryPack>;
  answers: Record<NatalReportAnswerKey, NatalReportAnswer>;
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

const UI_PREVIEW_NATAL_PREVIEWS: Record<NatalReportAnswerKey, string> = {
  main_how_people_see_you: 'При знакомстве ты кажешься спокойнее, чем есть. Люди не сразу понимают, насколько быстро ты уже всё про них заметила.',
  main_not_seen_at_once: 'За внешним спокойствием у тебя есть жёсткое правило: если доверие пропало, вернуть его одними словами почти невозможно.',
  character_decisions: 'Ты можешь долго сравнивать варианты, зато после решения тебя трудно сбить чужим мнением.',
  character_change_mind: 'Ты меняешь мнение не от напора, а когда человек приносит факт, который действительно ломает прежнюю картину.',
  character_irritation: 'Сильнее всего тебя раздражают не ошибки, а люди, которые делают вид, будто ничего не произошло.',
  character_boredom: 'Однообразие терпишь нормально, пока видишь результат. Бессмысленный повтор выключает интерес почти сразу.',
  character_stand_ground: 'Если вопрос касается твоего личного пространства или честной договорённости, уговорить тебя «просто уступить» почти невозможно.',
  character_plan_breaks: 'Когда план рушится, ты сначала быстро собираешь факты, а уже потом решаешь, что спасать, а что бросить.',
  character_best_at: 'Ты раньше других замечаешь несостыковку и умеешь довести запутанное дело до понятного результата.',
  character_unusual_mix: 'В тебе спокойно уживаются осторожный старт и очень резкий финал, если предел уже пройден.',
  love_people_you_like: 'Тебя цепляют люди, которых нельзя понять за один вечер. Но одной загадочности надолго тебе мало.',
  love_show_interest: 'Симпатию у тебя чаще выдают внимание к мелочам и желание продолжить разговор, а не громкие признания.',
  love_attachment_speed: 'Вовлечься можешь быстро, но признать, что человек стал важным, — заметно позже.',
  love_turnoffs: 'Интерес обрывается быстрее всего, когда слова человека несколько раз расходятся с его поступками.',
  love_lose_interest: 'Когда человек становится слишком предсказуемым и разговоры начинают повторяться, твой интерес может исчезнуть резко.',
  love_need_freedom: 'Тебе нужна близость без постоянного отчёта: быть рядом — да, объяснять каждый шаг — нет.',
  love_nonnegotiables: 'Без уважения к договорённостям отношения для тебя быстро теряют смысл, даже если притяжение осталось.',
  love_relationship_you_want: 'Тебе подходит связь, где можно говорить прямо, жить своей жизнью и не гадать, что имелось в виду.',
  love_right_person: 'Рядом с тобой удержится человек, который не путает близость с контролем и умеет отвечать за свои слова.',
  communication_new_people: 'С новыми людьми ты сначала слушаешь и проверяешь, совпадают ли слова с поведением.',
  communication_direct_or_unsaid: 'О главном ты умеешь сказать прямо, но личное сначала прячешь за короткими и безопасными фразами.',
  communication_texting: 'Если разговор тебе интересен, это видно по быстрым ответам и деталям, которые ты помнишь без напоминаний.',
  communication_misunderstood: 'Сначала ты объясняешь ещё раз. Если человек снова выворачивает смысл, разговор для тебя быстро заканчивается.',
  communication_criticism: 'Конкретное замечание ты слышишь нормально. Общий наезд без примеров вызывает спор почти сразу.',
  communication_arguments: 'В споре ты быстро находишь слабое место в чужих словах и не любишь уходить от исходного вопроса.',
  communication_after_fight: 'После ссоры тебе нужна короткая пауза, но бесконечное молчание раздражает сильнее самого конфликта.',
  communication_close_people: 'С близкими ты заметно прямее и иногда говоришь жёстче именно потому, что не хочешь играть в намёки.',
  communication_ask_for_help: 'Ты скорее попробуешь справиться сама, а просишь уже тогда, когда точно понимаешь, что нужно от человека.',
  work_start_new: 'Перед стартом тебе нужно понять итог и правила. После этого ты включаешься быстро и без долгой раскачки.',
  work_routine: 'Повторяющуюся работу ты выдерживаешь, если видишь смысл. Бесконечное «делай как вчера» быстро выключает тебя.',
  work_team_or_solo: 'Самостоятельно ты двигаешься быстрее, но сильная команда полезна там, где роли названы заранее.',
  work_leadership: 'Руководить ты можешь без лишнего шума: поставить задачу, назвать срок и проверить реальный результат.',
  work_authority: 'Начальника ты уважаешь за ясные решения, а не за должность. Давление без объяснений встречает сопротивление.',
  work_deadlines: 'Жёсткий срок собирает тебя, пока он реален. Хаотичные правки в последний момент злят и сбивают темп.',
  work_interest_killers: 'Интерес к работе падает, когда ответственность есть, а права принять решение тебе не дают.',
  work_own_business: 'Своё дело тебе подходит свободой решений, но быстро утомит, если придётся одной тащить весь мелкий контроль.',
  work_clients: 'С клиентом ты работаешь лучше всего, когда запрос назван прямо и условия не меняются после договорённости.',
  work_best_at: 'Твоя сильная работа начинается там, где нужно разобрать хаос, заметить ошибку и собрать понятный порядок.',
  money_save_or_spend: 'Ты умеешь копить ради ясной цели, но легко тратишься на то, что прямо сейчас делает жизнь удобнее.',
  money_big_decisions: 'Перед крупной покупкой ты проверяешь детали и не любишь, когда тебя торопят искусственной срочностью.',
  money_risk: 'Ты готова рисковать, когда понимаешь худший исход. Ставка вслепую тебя скорее оттолкнёт, чем заведёт.',
  money_name_price: 'Назвать цену проще, когда объём работы ясен. Размытый запрос заставляет тебя оставлять запас.',
  money_unnoticed_spending: 'Деньги незаметно уходят на удобство, маленькие ускорения и покупки, которые по одной кажутся пустяком.',
  money_independence: 'Свои деньги для тебя — это прежде всего право решать без чужого разрешения.',
  money_income_stability_freedom: 'Ты выберешь не самый большой доход, если вместе с ним придётся отдать весь контроль над временем.',
  money_shared: 'Общие деньги работают для тебя только с понятными правилами: что общее, что личное и кто за что отвечает.',
  money_status_things: 'Ты готова платить за качество и удобство, но одна громкая марка редко убеждает тебя переплатить.',
};

const UI_PREVIEW_NATAL_MIDDLE: Record<NatalReportCategoryKey, readonly [string, string]> = {
  main: [
    'Обычно это становится заметно не в первом разговоре, а позже: ты помнишь детали, сверяешь обещания с поступками и не спешишь делать окончательный вывод.',
    'Когда картина складывается, твоя позиция становится очень ясной. Тогда окружающие понимают, что первоначальная мягкость не означала согласие со всем подряд.',
  ],
  character: [
    'Сначала ты смотришь, что происходит на деле. Чужая громкость не заменяет для тебя нормального объяснения и не ускоряет решение.',
    'Если факты сходятся, ты действуешь без лишнего шума. Если нет — можешь остановить всё, даже когда остальные уже побежали вперёд.',
  ],
  love: [
    'В начале ты больше показываешь отношение поступками: возвращаешься к разговору, помнишь детали и находишь время, когда могла бы не находить.',
    'Когда ответный интерес становится понятным, ты перестаёшь скрываться за нейтральным общением и говоришь заметно прямее.',
  ],
  communication: [
    'Тебе проще обсуждать конкретный случай, чем долго угадывать чужой подтекст. Чем яснее вопрос, тем точнее твой ответ.',
    'Если разговор превращается в игру со словами, терпение быстро заканчивается. Ты возвращаешь его к сути или просто ставишь точку.',
  ],
  work: [
    'Лучше всего ты работаешь, когда понятны результат, срок и твоя зона решения. Тогда не нужно постоянно напоминать и подталкивать.',
    'Сложнее там, где правила меняют на ходу, а ответственность всё равно оставляют тебе. Такой порядок быстро убивает интерес.',
  ],
  money: [
    'Ты спокойнее принимаешь денежное решение, когда видишь полную цену и понимаешь, что получишь взамен. Давление только заставляет проверять внимательнее.',
    'Траты становятся лёгкими, если дают заметное удобство или свободу. За пустое впечатление ты платишь гораздо менее охотно.',
  ],
};

type UiPreviewNatalObservation = { title: string; text: string; bodies: readonly string[] };

const UI_PREVIEW_NATAL_CHAPTERS: Record<Exclude<NatalReportCategoryKey, 'main'>, readonly UiPreviewNatalObservation[]> = {
  character: [
    { title: 'Ты не обязана решать мгновенно', bodies: ['sun', 'saturn'], text: 'Тебе бывает нужно пожить с мыслью, прежде чем назвать её своей. Чужая уверенность способна ненадолго увлечь, но внутри всё равно остаётся проверка: подходит ли это лично тебе. Поэтому быстрый ответ иногда оказывается лишь началом решения, а окончательная позиция появляется позже, когда никто уже не подгоняет.' },
    { title: 'Возражение может разбудить интерес', bodies: ['mercury', 'uranus'], text: 'Необычная мысль скорее зацепит тебя, чем возмутит только своей непривычностью. Ты умеешь рассмотреть объяснение, которое другим кажется странным, и найти в нём здравый смысл. Но это не любовь к спору ради спора: если за эффектной фразой ничего нет, одного удивления для твоего интереса быстро становится мало.' },
    { title: 'Упрямство включается после выбора', bodies: ['mars', 'saturn'], text: 'До решения ты можешь сомневаться, а после него становишься заметно твёрже. Отказаться от выбранного трудно ещё и потому, что жалко вложенного труда. Здесь твоя настойчивость имеет две стороны: она помогает выдержать скучную середину, но иногда удерживает возле того, что уже перестало тебе подходить.' },
    { title: 'Не всё пережитое видно снаружи', bodies: ['moon', 'sun'], text: 'Сильное впечатление не обязательно превращается у тебя в громкую реакцию. Ты можешь продолжать обычный разговор, пока внутри ещё разбираешь одну неприятную фразу. Окружающим не всегда понятно, что произошло, поэтому твоя внезапная дистанция бывает для них неожиданной. Для тебя же это продолжение мысли, начавшейся гораздо раньше.' },
    { title: 'Любопытство не отменяет осторожности', bodies: ['jupiter', 'moon'], text: 'Тебе интересно узнавать людей и примерять чужой взгляд на жизнь. При этом услышать необычную историю и довериться рассказчику для тебя совсем не одно и то же. Ты можешь увлечённо расспрашивать, шутить и поддерживать разговор, не отдавая человеку право решать за тебя или входить слишком близко.' },
  ],
  love: [
    { title: 'Первый интерес у тебя живой', bodies: ['venus', 'jupiter'], text: 'Если человек тебе нравится, тебе хочется движения: ещё одного разговора, встречи, совместной затеи. Симпатия оживает от ответного любопытства, а не только от комплиментов. Ты можешь сама сделать первый шаг, но долго тащить общение одна вряд ли захочешь. Взаимность для тебя заметна по тому, что происходит между словами.' },
    { title: 'Близость требует настоящего доверия', bodies: ['moon', 'saturn'], text: 'Привлечь твоё внимание бывает проще, чем стать человеком, рядом с которым можно полностью расслабиться. Для доверия тебе важно узнать, как другой ведёт себя в неловкости, несогласии и обычной усталости. Красивый вечер запомнится, но надёжность ты скорее замечаешь в маленьких повторяющихся поступках, которым не нужен зритель.' },
    { title: 'Одного притяжения тебе мало', bodies: ['mercury', 'venus'], text: 'Тебе нужен человек, с которым интересно думать вслух, удивляться и иногда не соглашаться. Если разговор всё время ходит по одному кругу, даже сильная симпатия может потерять часть живости. При этом интерес не требует бесконечных развлечений: иногда его поддерживает один неожиданный вопрос, заданный с настоящим вниманием.' },
    { title: 'Нежность бывает очень земной', bodies: ['mars', 'venus'], text: 'Ты умеешь замечать удовольствие в простом присутствии рядом: знакомом прикосновении, вкусной еде, возможности никуда не бежать. Яркое начало не отменяет этой потребности в спокойной близости. Когда отношения становятся надёжнее, тебе не обязательно каждый раз доказывать чувства большим жестом; повседневная теплота способна говорить для тебя гораздо больше.' },
    { title: 'Ссора не должна стирать симпатию', bodies: ['moon', 'mercury'], text: 'В напряжённом разговоре тебе может захотеться точного ответа сразу, особенно если молчание кажется уклонением. Но резкая формулировка иногда прячет более простое желание: понять, что ты человеку важна. Поэтому спор о словах способен занять больше места, чем сама причина обиды, и оставить ощущение, что главное так и не прозвучало.' },
  ],
  communication: [
    { title: 'Ты слышишь не только слова', bodies: ['moon', 'mercury'], text: 'Тон, пауза и внезапно короткий ответ могут сказать тебе больше длинного объяснения. Это помогает замечать настроение разговора, но иногда хочется прочитать в паузе больше, чем человек туда вложил. Поэтому одно и то же сообщение ты можешь услышать по-разному в зависимости от того, насколько уже доверяешь собеседнику.' },
    { title: 'Разговору полезно тебя удивлять', bodies: ['mercury', 'uranus'], text: 'Тебе нравится, когда мысль неожиданно поворачивается и привычный вопрос получает другое объяснение. В такой беседе ты охотно подхватываешь идею и добавляешь свою. А вот разговор, где всем заранее назначены правильные ответы, быстро становится скучным. Твоё молчание тогда означает не отсутствие мысли, а отсутствие интереса к предложенной игре.' },
    { title: 'Прямота иногда опережает мягкость', bodies: ['mercury', 'mars'], text: 'Когда замечаешь противоречие, хочется назвать его сразу, пока разговор не ушёл дальше. Для тебя это может быть обычным уточнением, а другой услышит вызов. Особенно заметна разница с близкими: ты меньше подбираешь безопасные слова и рассчитываешь, что за резкостью всё равно будут видеть твоё участие, а не враждебность.' },
    { title: 'Чужую мысль ты умеешь принять', bodies: ['sun', 'jupiter'], text: 'Ты можешь внимательно слушать взгляд, который совсем не похож на твой, и на время попробовать понять его изнутри. Это делает разговор живым, но согласие с отдельной причиной иногда принимают за полное одобрение. Позже приходится объяснять, что понять человека для тебя не означает поддержать всё, что он делает.' },
    { title: 'Откровенность появляется постепенно', bodies: ['moon', 'saturn'], text: 'Даже в дружелюбной беседе ты не обязана сразу рассказывать о самом личном. Тебе важно почувствовать, что услышанное не превратят в шутку или удобный аргумент при следующем споре. Когда такая уверенность появляется, разговор становится гораздо свободнее: можно признаться в сомнении, попросить помощи и не придумывать убедительную версию себя.' },
  ],
  work: [
    { title: 'Тебе подходит длинная дистанция', bodies: ['mars', 'saturn'], text: 'Ты умеешь возвращаться к одной задаче и постепенно делать её лучше, даже когда новизна давно прошла. Это особенно заметно там, где качество зависит от повторения и внимательности. Труднее не сама длительная работа, а ощущение, что её бесконечно переделывают по чужому настроению и ни один вариант не становится окончательным.' },
    { title: 'Новый способ может увлечь сильнее', bodies: ['mercury', 'uranus'], text: 'Иногда интерес к работе возвращается, когда удаётся иначе объяснить задачу или попробовать непривычный подход. Ты не обязана менять всё вокруг, чтобы увидеть полезную возможность. Но привычка делать одинаково только потому, что так делали раньше, тебя редко убеждает; хочется понимать, зачем сохранять именно этот способ, а не другой.' },
    { title: 'Самостоятельность не равна одиночеству', bodies: ['jupiter', 'mercury'], text: 'Ты можешь охотно обсуждать идею с другими и одновременно хотеть самой выбрать, как её выполнять. Полезный обмен мыслями тебя скорее оживляет, чем утомляет. Усталость начинается, когда любая мелочь требует разрешения и разговор не помогает работе, а заменяет её. Поэтому хорошее сотрудничество оставляет тебе достаточно места для собственного решения.' },
    { title: 'Похвала должна попадать в дело', bodies: ['sun', 'saturn'], text: 'Общее «молодец» может быть приятно, но сильнее запоминается человек, который заметил конкретную трудность твоей работы. Тебе важно, чтобы оценивали не только красивый итог, но и внимание, которое в него вложено. Из-за этого поверхностная похвала иногда звучит слабее спокойного замечания, показывающего, что твою работу действительно внимательно посмотрели.' },
    { title: 'Усталость не всегда останавливает сразу', bodies: ['mars', 'moon'], text: 'Если задача уже захватила тебя, остановиться бывает сложнее, чем продолжить ещё немного. Ты способна долго не замечать, как раздражают мелкие просьбы и лишние разговоры. В такие моменты окружающие могут видеть только твою резкость, хотя причина не обязательно в них: просто работа заняла больше внимания, чем хотелось бы отдавать.' },
  ],
  money: [
    { title: 'Удобство имеет для тебя цену', bodies: ['venus', 'mars'], text: 'Ты можешь спокойно заплатить больше за вещь, которой приятно пользоваться каждый день. Важны не только внешний вид и обещания, но и ощущение в руках, простота, надёжность. Поэтому дорогая покупка не обязательно будет для тебя роскошью, а дешёвая не станет удачной только потому, что удалось потратить меньше.' },
    { title: 'Спонтанность живёт рядом с расчётом', bodies: ['venus', 'saturn'], text: 'Сравнивать стоимость и замечать слабые места покупки ты умеешь, но яркое желание иногда появляется раньше всех этих проверок. Особенно если вещь сразу обещает удовольствие и не требует долгого ожидания. Это не делает тебя постоянно расточительной: скорее, спокойный расчёт и быстрый интерес включаются в разных обстоятельствах и не всегда успевают договориться.' },
    { title: 'Свои деньги дают право выбирать', bodies: ['pluto', 'mars'], text: 'Возможность оплатить своё решение самой может быть важнее впечатления, которое покупка произведёт на других. Тебе неприятно чувствовать, что вместе с помощью автоматически получают право распоряжаться твоим временем или вкусом. Поэтому даже щедрое предложение способно вызвать осторожность, если неясно, чего от тебя будут ждать взамен и можно ли отказаться.' },
    { title: 'Торг касается не только суммы', bodies: ['mercury', 'saturn'], text: 'Когда речь идёт об оплате твоей работы, тебе легче оценить понятный запрос, чем обещание «там совсем немного». За одной суммой могут скрываться очень разные затраты времени и внимания. Поэтому пересмотр условий иногда волнует тебя сильнее небольшой разницы в цене: хочется понимать, за что именно ты отвечаешь и где работа заканчивается.' },
    { title: 'Общее не должно поглощать личное', bodies: ['jupiter', 'venus'], text: 'Ты можешь получать удовольствие от совместных трат и щедро поддерживать приятную затею, если участие действительно добровольное. Сложнее, когда молчаливо предполагают, что ты всегда согласна заплатить или уступить. В общих деньгах для тебя остаётся место личному вкусу: близость не делает любые желания одинаковыми и не отменяет права выбрать что-то своё.' },
  ],
};

const UI_PREVIEW_NATAL_CATEGORY_BODIES: Record<NatalReportCategoryKey, readonly string[]> = {
  main: ['sun', 'moon', 'mercury'],
  character: ['sun', 'moon', 'mercury', 'mars', 'saturn', 'jupiter', 'uranus'],
  love: ['venus', 'moon', 'mars', 'mercury', 'saturn', 'jupiter'],
  communication: ['mercury', 'moon', 'sun', 'mars', 'saturn', 'jupiter', 'uranus'],
  work: ['mars', 'saturn', 'mercury', 'sun', 'moon', 'jupiter', 'uranus'],
  money: ['venus', 'mars', 'saturn', 'mercury', 'jupiter', 'pluto'],
};

export function createUiPreviewNatalCatalog(): UiPreviewNatalCatalog {
  const built = buildNatalModelContext(createUiPreviewProfile('premium', 'exact'), createUiPreviewChart('exact'));
  const availableEvidenceIds = getNatalNarrativeEvidenceIds(built);
  const evidenceFor = (bodies: readonly string[]) => bodies
    .map((body) => `natal.position.${body}`)
    .filter((id) => availableEvidenceIds.has(id));
  // Synthetic reading for visual review, never a live personal interpretation.
  const paragraphs = [
    { title: 'Замечаешь больше, чем говоришь', text: 'Ты быстро чувствуешь, когда человек отвечает для приличия, а когда ему действительно интересно. Но своим впечатлением делишься не сразу: сначала смотришь, подтвердится ли оно. Поэтому твоё молчание легко принять за невнимательность. Зря.' },
    { title: 'Мягкость не означает согласие', text: 'Ты можешь понять чужую причину и всё равно сказать «нет». Больше всего сбивает ситуация, когда человека жалко, а его просьба тебе совсем не подходит. Тут отказ иногда созревает дольше, чем хотелось бы.' },
    { title: 'Интерес видно по поступкам', text: 'Когда человек тебе нравится, хочется встречаться, придумывать что-то вместе и видеть ответную инициативу. Долгая игра в холодность быстро надоедает. Притяжение для тебя важно, но в одиночку поддерживать его — удовольствие сомнительное.' },
    { title: 'Твою мысль трудно предугадать', text: 'Ты можешь найти неожиданное объяснение там, где остальные уже согласились с первым. Любишь разговоры, в которых есть что выяснить. А вот повторять очевидное только потому, что так принято, тебе быстро становится скучно.' },
    { title: 'Разогнаться сложнее, чем продолжить', text: 'В дело ты включаешься охотнее, когда понимаешь, что получится в конце. Зато после старта умеешь долго заниматься одной задачей. Чужое «давай быстрее» обычно добавляет раздражения, а не скорости.' },
    { title: 'Удобство для тебя — не пустяк', text: 'Ты замечаешь, приятно ли пользоваться вещью каждый день, и можешь заплатить за это больше. Одного красивого обещания мало. Покупка радует дольше, когда хорошо работает и не требует постоянной возни.' },
    { title: 'Близким достаётся больше тебя', text: 'С теми, кому доверяешь, ты заметно живее: больше шутишь, откровеннее споришь и меньше подбираешь безопасные слова. Поэтому знакомые и близкие могут описать тебя по-разному. Они просто видят разную степень твоего доверия.' },
  ];
  const mainBodies = [
    ['moon', 'mercury'], ['sun', 'mars'], ['venus', 'jupiter'], ['mercury', 'uranus'],
    ['mars', 'saturn'], ['venus', 'mars'], ['moon', 'venus'],
  ];
  const answers = {} as Record<NatalReportAnswerKey, NatalReportAnswer>;

  for (const category of NATAL_REPORT_CATEGORIES) {
    for (const answerKey of category.answerKeys) {
      const definition = getNatalReportAnswer(answerKey);
      if (!definition) continue;
      const middle = UI_PREVIEW_NATAL_MIDDLE[definition.categoryKey];
      const evidenceIds = evidenceFor(UI_PREVIEW_NATAL_CATEGORY_BODIES[definition.categoryKey]);
      answers[answerKey] = {
        schemaVersion: 'natal-report-answer-v1',
        contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
        answerKey,
        categoryKey: definition.categoryKey,
        title: definition.title.ru,
        access: definition.access,
        paragraphs: [UI_PREVIEW_NATAL_PREVIEWS[answerKey], ...middle].map((text) => ({
          text,
          evidenceIds,
        })),
        evidenceIds,
        related: definition.related,
        fullAnswerIncludes: [...definition.fullAnswerIncludes.ru],
      };
    }
  }

  const categoryPacks = {} as Record<NatalReportCategoryKey, NatalReportCategoryPack>;
  for (const category of NATAL_REPORT_CATEGORIES) {
    const previewKeys = category.key === 'main'
      ? NATAL_REPORT_MAIN_PREVIEW_KEYS
      : [];
    const summary = category.key === 'main'
      ? paragraphs.map((paragraph, index) => ({ ...paragraph, evidenceIds: evidenceFor(mainBodies[index]) }))
      : UI_PREVIEW_NATAL_CHAPTERS[category.key].map(({ bodies, ...paragraph }) => ({
        ...paragraph, evidenceIds: evidenceFor(bodies),
      }));
    const citedEvidenceIds = new Set(summary.flatMap((paragraph) => paragraph.evidenceIds));
    const continuationEvidence = (bodies: readonly string[]) => evidenceFor(bodies).filter((id) => citedEvidenceIds.has(id));
    const followUps = category.key === 'main' ? [
      { label: 'Какие отношения тебе быстро надоедают?', categoryKey: 'love' as const, evidenceIds: continuationEvidence(['venus', 'jupiter']) },
      { label: 'В какой работе пригодится твоя настойчивость?', categoryKey: 'work' as const, evidenceIds: continuationEvidence(['mars', 'saturn']) },
      { label: 'Почему с близкими ты говоришь иначе?', categoryKey: 'communication' as const, evidenceIds: continuationEvidence(['moon', 'mercury']) },
    ] : category.key === 'character' ? [
      { label: 'Как твоя настойчивость проявляется в работе?', categoryKey: 'work' as const, evidenceIds: continuationEvidence(['mars', 'saturn']) },
      { label: 'Что позволяет тебе довериться в отношениях?', categoryKey: 'love' as const, evidenceIds: continuationEvidence(['moon']) },
    ] : category.key === 'love' ? [
      { label: 'Почему важный разговор иногда становится спором?', categoryKey: 'communication' as const, evidenceIds: continuationEvidence(['mercury', 'moon']) },
      { label: 'Как удовольствие влияет на твои покупки?', categoryKey: 'money' as const, evidenceIds: continuationEvidence(['venus', 'mars']) },
    ] : category.key === 'communication' ? [
      { label: 'Как ты приходишь к собственному решению?', categoryKey: 'character' as const, evidenceIds: continuationEvidence(['sun', 'mercury']) },
      { label: 'Что меняется в разговоре при близости?', categoryKey: 'love' as const, evidenceIds: continuationEvidence(['moon']) },
    ] : category.key === 'work' ? [
      { label: 'Как тебе оценить стоимость своей работы?', categoryKey: 'money' as const, evidenceIds: continuationEvidence(['saturn', 'mercury']) },
      { label: 'Когда настойчивость превращается в упрямство?', categoryKey: 'character' as const, evidenceIds: continuationEvidence(['mars', 'saturn']) },
    ] : [
      { label: 'Какая работа оставляет тебе самостоятельность?', categoryKey: 'work' as const, evidenceIds: continuationEvidence(['mars', 'mercury']) },
      { label: 'Как в близости сочетаются общее и личное?', categoryKey: 'love' as const, evidenceIds: continuationEvidence(['venus', 'jupiter']) },
    ];
    categoryPacks[category.key] = {
      schemaVersion: 'natal-report-category-v1',
      contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
      categoryKey: category.key,
      title: category.title.ru,
      summary,
      followUps,
      observations: [],
      previews: previewKeys.map((answerKey) => {
        const answer = answers[answerKey];
        return {
          answerKey,
          title: answer.title,
          preview: UI_PREVIEW_NATAL_PREVIEWS[answerKey],
          evidenceIds: answer.evidenceIds,
          access: answer.access,
          related: answer.related,
          fullAnswerIncludes: answer.fullAnswerIncludes,
        };
      }),
      freeAnswers: [],
    };
  }

  return { categoryPacks, answers };
}

export function createUiPreviewNatalReport(
  profile: UserProfile,
  chart: NatalChartData,
): PreloadedNatalReport {
  const built = buildNatalModelContext(profile, chart);
  const availableEvidenceIds = [...getNatalNarrativeEvidenceIds(built)];
  if (!availableEvidenceIds.length) {
    throw new Error('UI Preview natal fixture requires chart evidence.');
  }
  const evidenceAt = (index: number) => availableEvidenceIds[index % availableEvidenceIds.length];
  const freeSections: NatalPermanentFreeReport['freeSections'] = [
    {
      key: 'base_portrait',
      title: 'Что у тебя внутри',
      access: 'free',
      content: 'Первая реакция приходит быстро, но ты не всегда показываешь её сразу. Сначала проверяешь, что именно произошло: человек действительно нарушил договорённость или разговор просто вышел неясным. Поэтому пауза с твоей стороны чаще означает проверку фактов, а не равнодушие.',
      evidenceIds: [evidenceAt(1)],
    },
    ...(built.context.reportPlan.some((item) => item.key === 'first_impression') ? [{
      key: 'how_others_see_you',
      title: 'Как ты ведёшь себя с новыми людьми',
      access: 'free',
      content: 'При знакомстве ты сначала слушаешь, как человек говорит, и смотришь, совпадают ли слова с действиями. Не спешишь обещать близость или сотрудничество, пока не поймёшь, можно ли верить договорённостям. Когда поведение становится понятным, ты общаешься заметно свободнее.',
      evidenceIds: [evidenceAt(2)],
    } as NatalPermanentFreeReport['freeSections'][number]] : []),
    {
      key: 'thinking',
      title: 'Как ты принимаешь решения',
      access: 'free',
      content: 'Перед важным выбором ты сравниваешь не только варианты, но и последствия: сколько времени, денег и обязательств потребует каждый. Если критерии ясны, решение принимаешь быстро и редко к нему возвращаешься. Сложнее, когда условия меняются на ходу или кто-то требует ответа раньше, чем назвал все детали.',
      evidenceIds: [evidenceAt(3)],
    },
    {
      key: 'communication',
      title: 'Как ты общаешься',
      access: 'free',
      content: 'В разговоре тебе проще сразу назвать предмет: что случилось, что не устраивает и о чём нужно договориться. Ты быстро замечаешь несостыковку и можешь сказать о ней жёстче, чем собирался. Лучше всего общение идёт с людьми, которые отвечают прямо и не заставляют угадывать смысл.',
      evidenceIds: [evidenceAt(4)],
    },
    {
      key: 'strengths',
      title: 'Где у тебя получается лучше всего',
      access: 'free',
      content: 'Тебе хорошо даются задачи, где нужно проверить условия, заметить ошибку и довести дело до понятного результата. Ты не теряешь нить, когда деталей много, если есть срок и ясно, кто за что отвечает. Это особенно полезно в переговорах, планировании и работе, где цена невнимательности высока.',
      evidenceIds: [evidenceAt(5)],
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
      text: 'По натальной карте у тебя заметна одна сквозная черта: ты рано видишь, когда слова, сроки или условия не сходятся, и принимаешь решение после проверки деталей.',
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
      keywords: ['детали', 'решения', 'договорённости'],
      text: freeSections[0].content,
      advice: 'Точный ответ у тебя получается после проверки фактов и условий.',
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
  const built = buildNatalModelContext(profile, chart);
  const evidenceIds = [...getNatalNarrativeEvidenceIds(built)];
  const evidenceAt = (index: number) => evidenceIds[index % evidenceIds.length] || 'natal.quality.birth-time';
  const statement = (text: string, index: number) => ({ text, evidenceIds: [evidenceAt(index)] });
  const sections: NatalPermanentPremiumReport['sections'] = [
    {
      id: 'relationships',
      title: 'Отношения и семья',
      paragraphs: [
        statement('В паре тебе важны не громкие слова, а повторяющиеся поступки и соблюдённые договорённости. В семье ты готов многое взять на себя, если просьба названа прямо, но раздражаешься, когда решение уже приняли за тебя. Если близкий несколько раз обещает одно и делает другое, ты можешь общаться как обычно, хотя доверия уже стало меньше.', 1),
      ],
    },
    {
      id: 'work',
      title: 'Работа и своё дело',
      paragraphs: [
        statement('В работе ты предпочитаешь задачу с ясным итогом, сроком и зоной ответственности. Требование результата принимаешь спокойно, но подробный контроль каждого шага со стороны начальника быстро раздражает. В своём деле тот же подход помогает держать качество, пока клиент или деловой партнёр заранее называет условия и не меняет их после договорённости.', 2),
      ],
    },
    {
      id: 'challenges',
      title: 'Когда всё идёт не по плану',
      paragraphs: [
        statement('Тебя сильнее всего сбивают не сами трудности, а неясные условия: срок называют приблизительно, договорённость меняют без предупреждения, а ответ ждут сразу. В такой ситуации ты начинаешь перепроверять больше деталей и можешь взять на себя чужую часть работы, чтобы вернуть порядок. Чем раньше названы правила и ответственность, тем меньше времени уходит на лишние проверки.', 3),
      ],
    },
  ];
  return {
    schemaVersion: 'natal-permanent-premium-v2',
    contractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
    tier: 'premium',
    headline: 'Полный портрет карты',
    headlineEvidenceIds: [evidenceAt(0)],
    lead: statement('В близости и работе ты так же сверяешь слова с поступками, сроками и договорённостями.', 0),
    sections,
    strategies: [],
    pitfalls: [],
    conclusion: statement('Ты действуешь точнее, когда условия названы прямо и слова можно проверить поступками.', 4),
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

export function createUiPreviewCompatibilityStory(result: SynastryResult): NonNullable<SynastryResult['storyParagraphs']> {
  const topics = [
    ['connection', ['between_you']], ['closeness', ['attraction', 'emotional_closeness']],
    ['conversation', ['communication']], ['friction', ['tension', 'conflicts']],
    ['everyday', ['everyday_life', 'stability']],
  ] as const;
  return topics.flatMap(([topic, ids]) => {
    const section = ids.map((id) => result.sections?.find((item) => item.id === id)).find(Boolean);
    return section ? section.text.split(/\n\s*\n/u).filter(Boolean).map((text) => ({
      topic, text, evidenceIds: section.evidenceIds, direction: 'mutual' as const,
    })) : [];
  });
}

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
      email: 'preview@example.test',
      displayName: 'Тестовый профиль',
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

function forecastExample(period: PersonalForecastPeriod) {
  const reference = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.find((item) => item.period === period);
  if (!reference) throw new Error(`Missing personal forecast preview example: ${period}`);
  return reference.output;
}

const todayExample = forecastExample('day');
const weekExample = forecastExample('week');
const monthExample = forecastExample('month');

export const UI_PREVIEW_TODAY_SECTIONS: ForecastSection[] = [
  {
    ...forecastSection('today-overview', 'overview', todayExample.title, [
      todayExample.forecast,
    ], ['detail']),
    visualTag: 'decisions',
    visualCue: 'decisions',
  },
  forecastSection('today-advice', 'dynamic', '', [
    todayExample.closing,
  ], ['action']),
];

export const UI_PREVIEW_WEEK_SECTION: ForecastSection = {
  ...forecastSection('week-story', 'overview', weekExample.title, [
    weekExample.forecast,
  ], ['detail']),
  visualTag: 'friends',
  visualCue: 'friends',
};

export const UI_PREVIEW_WEEK_ADVICE_SECTION = forecastSection('week-advice', 'dynamic', '', [
  weekExample.closing,
], ['action']);

export const UI_PREVIEW_WEEK_SECTIONS: ForecastSection[] = [
  UI_PREVIEW_WEEK_SECTION,
  UI_PREVIEW_WEEK_ADVICE_SECTION,
];

export const UI_PREVIEW_MONTH_SECTION: ForecastSection = {
  ...forecastSection('month-story', 'overview', monthExample.title, [
    monthExample.forecast,
  ], ['detail']),
  visualTag: 'work_money',
  visualCue: 'work_money',
};

export const UI_PREVIEW_MONTH_ADVICE_SECTION = forecastSection('month-advice', 'dynamic', '', [
  monthExample.closing,
], ['action']);

export const UI_PREVIEW_MONTH_SECTIONS: ForecastSection[] = [
  UI_PREVIEW_MONTH_SECTION,
  UI_PREVIEW_MONTH_ADVICE_SECTION,
];
