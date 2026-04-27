import type { InterpretationSection, InterpretationSectionKey } from '../types';

export const HUMAN_INTERPRETATION_PROMPT_VERSION = 'lumia-human-v1';
export const HUMAN_BASE_PROMPT_VERSION = 'lumia-human-v1.base';
export const HUMAN_PAID_PROMPT_VERSION = 'lumia-human-v1.paid';
export const HUMAN_DAILY_PROMPT_VERSION = 'lumia-human-v1.daily';

export const HUMAN_PAID_LUMI_COST = 300;
export const HUMAN_BASE_CACHE_KEY = 'human_v1.base';

export const HUMAN_FREE_SECTION_KEYS = [
  'base_portrait',
  'main_formula',
  'sun_code',
  'moon_code',
  'ascendant_code',
  'strengths',
  'growth_zones',
  'how_others_see_you',
  'emotional_world',
  'self_relationship',
  'main_advice',
  'summary',
] as const satisfies readonly InterpretationSectionKey[];

export const HUMAN_PAID_SECTION_KEYS = [
  'today_by_chart',
  'work_business',
  'love_relationships',
  'money_stability',
  'goals_actions',
  'friendship_social',
  'family_home',
  'shadow_patterns',
  'potential_purpose',
  'communication_conflicts',
  'energy_recovery',
  'personal_growth_scenario',
] as const satisfies readonly InterpretationSectionKey[];

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
  today_by_chart: {
    key: 'today_by_chart',
    title: 'Сегодня по карте',
    subtitle: 'Как карта звучит именно сейчас',
    teaser: 'Что сегодня может включиться в вашей карте и где лучше действовать спокойнее, точнее, честнее.',
  },
  work_business: {
    key: 'work_business',
    title: 'Работа и бизнес',
    subtitle: 'Реализация, деньги через дело, формат роста',
    teaser: 'Где у вас деньги, какой формат реализации подходит и что мешает росту.',
  },
  love_relationships: {
    key: 'love_relationships',
    title: 'Любовь и отношения',
    subtitle: 'Как вы любите, выбираете и сближаетесь',
    teaser: 'Как вы любите, кого выбираете и почему иногда можете закрываться даже от близкого человека.',
  },
  money_stability: {
    key: 'money_stability',
    title: 'Деньги и стабильность',
    subtitle: 'Опора, доход, привычки устойчивости',
    teaser: 'Как вы создаете опору, почему доход может тормозиться и какие качества карты можно превратить в стабильность.',
  },
  goals_actions: {
    key: 'goals_actions',
    title: 'Дела, цели и действия',
    subtitle: 'Темп, фокус и способ двигаться вперед',
    teaser: 'Как вам двигаться к целям без хаоса, рывков и выгорания.',
  },
  friendship_social: {
    key: 'friendship_social',
    title: 'Дружба и окружение',
    subtitle: 'Люди, команды, границы в контактах',
    teaser: 'Какие люди дают вам силу, а какие быстро забирают энергию.',
  },
  family_home: {
    key: 'family_home',
    title: 'Семья и внутренний дом',
    subtitle: 'Дом, безопасность, близкие сценарии',
    teaser: 'Что дает вам ощущение внутренней безопасности и почему тема дома может быть ключевой.',
  },
  shadow_patterns: {
    key: 'shadow_patterns',
    title: 'Что вы можете не замечать в себе',
    subtitle: 'Защитные реакции без жесткости и страха',
    teaser: 'Какие защитные реакции вы можете не замечать и как они влияют на решения.',
  },
  potential_purpose: {
    key: 'potential_purpose',
    title: 'Потенциал и предназначение',
    subtitle: 'Главный вектор роста и раскрытия',
    teaser: 'Куда вас ведет карта и через что раскрывается ваша настоящая сила.',
  },
  communication_conflicts: {
    key: 'communication_conflicts',
    title: 'Общение и конфликты',
    subtitle: 'Как говорить, спорить и договариваться',
    teaser: 'Как вы спорите, где можете давить или молчать, и как лучше договариваться.',
  },
  energy_recovery: {
    key: 'energy_recovery',
    title: 'Энергия и восстановление',
    subtitle: 'Ресурс, нагрузка, личный темп',
    teaser: 'Что вас восстанавливает, что перегружает и какой темп подходит именно вам.',
  },
  personal_growth_scenario: {
    key: 'personal_growth_scenario',
    title: 'Личный сценарий роста',
    subtitle: 'Как соединить сильные стороны в одну линию',
    teaser: 'Какой путь роста показывает карта и какие решения помогают вам становиться сильнее без насилия над собой.',
  },
};

export const HUMAN_DAILY_SECTION_META: Record<HumanDailySectionKey, HumanSectionMeta> = {
  daily_overview: {
    key: 'daily_overview',
    title: 'Общий фон дня',
    subtitle: 'Главная энергия дня по вашей карте',
    teaser: 'Не общий гороскоп, а персональный фокус дня через натальную карту и текущие транзиты.',
  },
  daily_work_business: {
    key: 'daily_work_business',
    title: 'Работа и бизнес сегодня',
    subtitle: 'Фокус, результат, рабочий шаг',
    teaser: 'Какой рабочий участок сегодня лучше довести до ясности.',
  },
  daily_love: {
    key: 'daily_love',
    title: 'Любовь сегодня',
    subtitle: 'Эмоции, близость, разговоры',
    teaser: 'Как сегодня общаться мягче и не додумывать лишнее.',
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
    subtitle: 'Один ясный шаг вместо распыления',
    teaser: 'Что сегодня лучше начать, закончить или отложить.',
  },
  daily_communication: {
    key: 'daily_communication',
    title: 'Общение и переговоры сегодня',
    subtitle: 'Слова, паузы, договоренности',
    teaser: 'Как говорить так, чтобы вас услышали без лишнего давления.',
  },
  daily_friendship: {
    key: 'daily_friendship',
    title: 'Дружба и окружение сегодня',
    subtitle: 'Кому дать время, от кого отдохнуть',
    teaser: 'Какие контакты сегодня могут поддержать, а какие лучше не тащить на себе.',
  },
  daily_family: {
    key: 'daily_family',
    title: 'Семья и дом сегодня',
    subtitle: 'Домашний ритм и эмоциональная безопасность',
    teaser: 'Где сегодня навести тишину, порядок или честность внутри дома.',
  },
  daily_energy: {
    key: 'daily_energy',
    title: 'Энергия и восстановление сегодня',
    subtitle: 'Ресурс без медицинских обещаний',
    teaser: 'Какой темп сегодня бережнее для вашей карты.',
  },
  daily_risks: {
    key: 'daily_risks',
    title: 'Риски дня',
    subtitle: 'Без страха, только практичная осторожность',
    teaser: 'Где можно разогнаться на эмоциях и взять на себя лишнее.',
  },
  daily_best_action: {
    key: 'daily_best_action',
    title: 'Лучшее действие дня',
    subtitle: 'Один шаг, который собирает день',
    teaser: 'Какое действие сегодня даст больше всего ясности.',
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
  return `human_v1.paid.${sectionKey}`;
}

export function humanDailyCacheKey(dateKey: string, sectionKey: HumanDailySectionKey): string {
  return `human_v1.daily.${dateKey}.${sectionKey}`;
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
      ctaLabel: `Открыть за ${HUMAN_PAID_LUMI_COST} Lumi`,
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
