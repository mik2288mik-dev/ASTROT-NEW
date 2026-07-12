import type { InterpretationSection, InterpretationSectionKey } from '../types';
import type {
  DailyPackageFieldKey,
  DailyPresentationPatternKey,
  Locale,
} from './dailyPresentationPatterns';

export const HUMAN_INTERPRETATION_PROMPT_VERSION = 'lumia-human-v2';
export const HUMAN_BASE_PROMPT_VERSION = 'lumia-human-v5.lean-portrait';
export const HUMAN_PAID_PROMPT_VERSION = 'lumia-human-v4.paid-focus';
// v5.daily-canvas: личный дневной разбор генерится ЕДИНЫМ полотном за один запрос
// с прокинутыми транзит→натал аспектами. Бамп версии инвалидирует старый посекционный
// кеш (ключи human_v2.daily.*), новый код читает только новый ключ human_v2.canvas.*.
export const HUMAN_DAILY_PROMPT_VERSION = 'your-horoscope-v4.daily-distinct-scenes';

export const HUMAN_BASE_CACHE_KEY = 'human_v2.base';

export const HUMAN_FREE_SECTION_KEYS = [
  'base_portrait',
  'strengths',
  'growth_zones',
  'main_advice',
] as const satisfies readonly InterpretationSectionKey[];

export const HUMAN_PAID_SECTION_KEYS = [
  'work_business',
  'love_relationships',
  'money_stability',
  'family_home',
  'communication_conflicts',
  'energy_recovery',
  'friendship_social',
  'goals_actions',
  'shadow_patterns',
  'potential_purpose',
] as const satisfies readonly InterpretationSectionKey[];

// All 10 paid sections, ordered by selling power (most compelling first).
export const HUMAN_MAP_SECTION_KEYS = [
  'love_relationships',
  'money_stability',
  'work_business',
  'potential_purpose',
  'shadow_patterns',
  'goals_actions',
  'communication_conflicts',
  'energy_recovery',
  'friendship_social',
  'family_home',
] as const satisfies readonly HumanPaidSectionKey[];

export const HUMAN_DAILY_SECTION_KEYS = [
  'daily_overview',
  'daily_work_business',
  'daily_love',
  'daily_money',
  'daily_goals',
  'daily_communication',
  'daily_friendship',
  'daily_family',
  'daily_energy',
  'daily_risks',
  'daily_best_action',
  'daily_advice',
] as const satisfies readonly InterpretationSectionKey[];

export type HumanPaidSectionKey = (typeof HUMAN_PAID_SECTION_KEYS)[number];
export type HumanDailySectionKey = (typeof HUMAN_DAILY_SECTION_KEYS)[number];

export type HumanSectionMeta = {
  key: InterpretationSectionKey;
  title: string;
  subtitle: string;
  teaser: string;
  ctaLabel?: string;
};

export const HUMAN_PAID_SECTION_META: Record<HumanPaidSectionKey, HumanSectionMeta> = {
  work_business: {
    key: 'work_business',
    title: 'Работа и бизнес',
    subtitle: 'Задачи, деньги через дело, формат роста',
    teaser: 'Какие задачи подходят, где проще зарабатывать и что может мешать росту.',
  },
  love_relationships: {
    key: 'love_relationships',
    title: 'Как ты любишь',
    subtitle: 'Как ты выбираешь, сближаешься и споришь',
    teaser: 'Что важно рядом с человеком, где появляются конфликты и как не копить претензии.',
  },
  money_stability: {
    key: 'money_stability',
    title: 'Деньги и решения',
    subtitle: 'Доход, траты, привычки, финансовые решения',
    teaser: 'Как ты обращаешься с деньгами, где теряешь ясность и какие правила помогают.',
  },
  goals_actions: {
    key: 'goals_actions',
    title: 'Скрытые таланты',
    subtitle: 'Сильные стороны, которых ты в себе не замечаешь',
    teaser: 'Что у тебя получается будто само собой — и как опереться на эти способности.',
  },
  friendship_social: {
    key: 'friendship_social',
    title: 'Как тебя видят другие',
    subtitle: 'Первое впечатление и как тебя считывают',
    teaser: 'С кем тебе проще работать и дружить, а где контакт быстро становится тяжёлым.',
  },
  family_home: {
    key: 'family_home',
    title: 'Семья и дом',
    subtitle: 'Быт, близкие, правила дома, личная территория',
    teaser: 'Что важно в доме и семье, где нужны правила и как снижать напряжение.',
  },
  shadow_patterns: {
    key: 'shadow_patterns',
    title: 'Тёмная сторона',
    subtitle: 'Что ты можешь не замечать в своих реакциях',
    teaser: 'Какие привычные реакции мешают решениям, отношениям и работе.',
  },
  potential_purpose: {
    key: 'potential_purpose',
    title: 'Где твоя сила',
    subtitle: 'Где ты можешь быть полезен и заметен',
    teaser: 'Какие роли, задачи и форматы работы подходят лучше всего.',
  },
  communication_conflicts: {
    key: 'communication_conflicts',
    title: 'Что тебя бесит',
    subtitle: 'Как говорить, спорить и договариваться',
    teaser: 'Где ты давишь, где молчишь и как говорить так, чтобы тебя понимали.',
  },
  energy_recovery: {
    key: 'energy_recovery',
    title: 'Нагрузка и восстановление',
    subtitle: 'Силы, перегруз, паузы, режим дня',
    teaser: 'Что быстрее утомляет, что помогает прийти в норму и как не доводить до срыва.',
  },
};

export const HUMAN_DAILY_SECTION_META: Record<HumanDailySectionKey, HumanSectionMeta> = {
  daily_overview: {
    key: 'daily_overview',
    title: 'Тема дня',
    subtitle: 'Главный дневной вывод по твоей карте',
    teaser: 'Главное на сегодня — по твоей карте, коротко и по делу.',
  },
  daily_work_business: {
    key: 'daily_work_business',
    title: 'Работа и бизнес сегодня',
    subtitle: 'Задача, результат, рабочий шаг',
    teaser: 'Какой рабочий участок сегодня лучше довести до ясности.',
  },
  daily_love: {
    key: 'daily_love',
    title: 'Любовь сегодня',
    subtitle: 'Разговоры, близость, договорённости',
    teaser: 'Как сегодня говорить с близкими без давления и лишних догадок.',
  },
  daily_money: {
    key: 'daily_money',
    title: 'Деньги сегодня',
    subtitle: 'Решения, траты, устойчивость',
    teaser: 'Что можно упорядочить в деньгах и где не тратить импульсивно.',
  },
  daily_goals: {
    key: 'daily_goals',
    title: 'Дела и цели сегодня',
    subtitle: 'Один понятный шаг вместо распыления',
    teaser: 'Что сегодня лучше начать, закончить или отложить.',
  },
  daily_communication: {
    key: 'daily_communication',
    title: 'Общение и переговоры сегодня',
    subtitle: 'Слова, паузы, договорённости',
    teaser: 'Как говорить так, чтобы тебя услышали без лишнего давления.',
  },
  daily_friendship: {
    key: 'daily_friendship',
    title: 'Друзья и окружение сегодня',
    subtitle: 'Кому дать время, от чего отдохнуть',
    teaser: 'Какие контакты сегодня полезны, а какие лучше не тащить на себе.',
  },
  daily_family: {
    key: 'daily_family',
    title: 'Семья и дом сегодня',
    subtitle: 'Дом, порядок, честный разговор',
    teaser: 'Где сегодня навести порядок, договориться или убрать лишнее напряжение.',
  },
  daily_energy: {
    key: 'daily_energy',
    title: 'Нагрузка сегодня',
    subtitle: 'Без медицинских обещаний',
    teaser: 'Какой темп дел сегодня не перегрузит и где лучше сделать паузу.',
  },
  daily_risks: {
    key: 'daily_risks',
    title: 'Риски дня',
    subtitle: 'Практичная осторожность без страха',
    teaser: 'Где можно разогнаться на эмоциях и взять на себя лишнее.',
  },
  daily_best_action: {
    key: 'daily_best_action',
    title: 'Лучшее действие дня',
    subtitle: 'Один шаг, который даст ясность',
    teaser: 'Какое действие сегодня даст больше всего пользы.',
  },
  daily_advice: {
    key: 'daily_advice',
    title: 'Совет дня',
    subtitle: 'Короткая мысль, которую можно забрать с собой',
    teaser: 'Главный совет дня простым человеческим языком.',
  },
};

const paidSet = new Set<InterpretationSectionKey>(HUMAN_PAID_SECTION_KEYS);
const dailySet = new Set<InterpretationSectionKey>(HUMAN_DAILY_SECTION_KEYS);

export function isHumanPaidSectionKey(value: string): value is HumanPaidSectionKey {
  return paidSet.has(value as InterpretationSectionKey);
}

export function isHumanDailySectionKey(value: string): value is HumanDailySectionKey {
  return dailySet.has(value as InterpretationSectionKey);
}

export function humanPaidCacheKey(sectionKey: HumanPaidSectionKey): string {
  return `human_v2.paid.${sectionKey}`;
}

export function humanDailyCacheKey(dateKey: string, sectionKey: HumanDailySectionKey): string {
  return `human_v2.daily.${dateKey}.${sectionKey}`;
}

// ── Единое дневное «полотно» ──
// Весь личный разбор дня одним объектом: генерится ОДНИМ запросом, кешируется ОДНИМ
// ключом на сутки, режется на секции при отдаче через существующий посекционный
// контракт фронта. Так модель видит день целиком (блоки связны, не противоречат),
// а вызовов к OpenAI — один на день вместо N по сферам.
export type DailyCanvasSectionKey =
  | 'overview'
  | 'love'
  | 'money'
  | 'work'
  | 'goals'
  | 'family'
  | 'friendship'
  | 'energy'
  | 'communication';

export type DailyCanvasFreeSectionKey = Exclude<DailyCanvasSectionKey, 'overview'>;
export type DailyCanvasTopicKey = DailyCanvasFreeSectionKey;

export const DAILY_CANVAS_SECTION_KEYS = [
  'overview',
  'love',
  'money',
  'work',
  'goals',
  'family',
  'friendship',
  'energy',
  'communication',
] as const satisfies readonly DailyCanvasSectionKey[];

export const DAILY_CANVAS_FREE_SECTION_KEYS = [
  'love',
  'money',
  'work',
  'goals',
  'family',
  'friendship',
  'energy',
  'communication',
] as const satisfies readonly DailyCanvasFreeSectionKey[];

export const DAILY_CANVAS_TOPIC_KEYS = [
  'love',
  'money',
  'work',
  'goals',
  'family',
  'friendship',
  'energy',
  'communication',
] as const satisfies readonly DailyCanvasTopicKey[];

export type DailyCanvasTopic = {
  hook: string;
  body: string;
};

export type DailyCanvas = {
  hero_title: string;
  hero_hook: string;
  overview: string;
  love: DailyCanvasTopic;
  money: DailyCanvasTopic;
  work: DailyCanvasTopic;
  goals: DailyCanvasTopic;
  family: DailyCanvasTopic;
  friendship: DailyCanvasTopic;
  energy: DailyCanvasTopic;
  communication: DailyCanvasTopic;
  meta: {
    free_section_key: DailyCanvasFreeSectionKey;
    pattern_keys?: Partial<Record<DailyPackageFieldKey, DailyPresentationPatternKey>>;
    locale?: Locale;
    voice_version?: string;
    date_key?: string;
    day_score?: number | null;
    day_score_explain?: string;
  };
};

export const DAILY_SECTION_TO_CANVAS_KEY: Partial<Record<HumanDailySectionKey, DailyCanvasSectionKey>> = {
  daily_overview: 'overview',
  daily_love: 'love',
  daily_money: 'money',
  daily_work_business: 'work',
  daily_goals: 'goals',
  daily_family: 'family',
  daily_friendship: 'friendship',
  daily_energy: 'energy',
  daily_communication: 'communication',
};

export function isCanvasBackedDailySection(key: HumanDailySectionKey): boolean {
  return Object.prototype.hasOwnProperty.call(DAILY_SECTION_TO_CANVAS_KEY, key);
}

export function humanDailyCanvasCacheKey(
  userId: string,
  dateKey: string,
  locale: Locale,
  voiceVersion: string,
): string {
  return `personal_daily.package.user.${String(userId).trim()}.date.${dateKey}.locale.${locale}.voice.${voiceVersion}`;
}

export function buildLockedPaidSections(): InterpretationSection[] {
  return HUMAN_PAID_SECTION_KEYS.map((key) => {
    const meta = HUMAN_PAID_SECTION_META[key];
    return {
      key,
      title: meta.title,
      subtitle: meta.subtitle,
      access: 'paid',
      isLocked: true,
      teaser: meta.teaser,
      content: '',
      ctaLabel: 'Открыть полную карту',
    };
  });
}

export function buildLockedDailySections(): InterpretationSection[] {
  return HUMAN_DAILY_SECTION_KEYS.map((key) => {
    const meta = HUMAN_DAILY_SECTION_META[key];
    return {
      key,
      title: meta.title,
      subtitle: meta.subtitle,
      access: 'premium',
      isLocked: true,
      teaser: meta.teaser,
      content: '',
      ctaLabel: 'Открыть Premium',
    };
  });
}
