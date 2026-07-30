import type {
  InterpretationSection,
  InterpretationSectionKey,
} from '../types';
import { withAppVoiceCacheKey, withAppVoiceVersion } from './appVoice';

export const HUMAN_INTERPRETATION_PROMPT_VERSION = withAppVoiceVersion('lumia-human-v2');
export const HUMAN_BASE_PROMPT_VERSION = withAppVoiceVersion('lumia-human-v6.direct-editorial');
export const HUMAN_PAID_PROMPT_VERSION = withAppVoiceVersion('lumia-human-v5.direct-focus');
export const HUMAN_BASE_CACHE_KEY = withAppVoiceCacheKey('human_v2.base');

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

export type HumanPaidSectionKey = (typeof HUMAN_PAID_SECTION_KEYS)[number];

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
    subtitle: 'Подходящие задачи, ответственность и рост',
    teaser: 'Какие задачи подходят, где проще зарабатывать и что мешает двигаться дальше.',
  },
  love_relationships: {
    key: 'love_relationships',
    title: 'Отношения',
    subtitle: 'Как ты сближаешься, чего ждёшь и из-за чего споришь',
    teaser: 'Что для тебя важно рядом с человеком, где начинаются конфликты и что помогает договориться.',
  },
  money_stability: {
    key: 'money_stability',
    title: 'Деньги и решения',
    subtitle: 'Доход, траты и финансовые привычки',
    teaser: 'Как ты принимаешь денежные решения, где рискуешь ошибиться и какие правила помогают.',
  },
  goals_actions: {
    key: 'goals_actions',
    title: 'Как ты действуешь',
    subtitle: 'Что получается легко и где теряется результат',
    teaser: 'Какие способы работы тебе подходят и что мешает доводить дело до конца.',
  },
  friendship_social: {
    key: 'friendship_social',
    title: 'Как тебя видят другие',
    subtitle: 'Первое впечатление, дружба и рабочее общение',
    teaser: 'С кем тебе проще работать и дружить, а где контакт быстро становится тяжёлым.',
  },
  family_home: {
    key: 'family_home',
    title: 'Семья и дом',
    subtitle: 'Быт, близкие, правила и личное пространство',
    teaser: 'Что для тебя важно дома, где нужны чёткие договорённости и из-за чего растёт напряжение.',
  },
  shadow_patterns: {
    key: 'shadow_patterns',
    title: 'Слабые места',
    subtitle: 'Какие реакции мешают принимать решения',
    teaser: 'Где ты сам усложняешь разговор, работу или отношения и не сразу это замечаешь.',
  },
  potential_purpose: {
    key: 'potential_purpose',
    title: 'Сильные стороны в работе',
    subtitle: 'Подходящие роли, задачи и уровень ответственности',
    teaser: 'В каких задачах ты даёшь лучший результат и где твои качества действительно полезны.',
  },
  communication_conflicts: {
    key: 'communication_conflicts',
    title: 'Разговоры и конфликты',
    subtitle: 'Как ты споришь, давишь, молчишь и договариваешься',
    teaser: 'Из-за чего разговор срывается и как сказать прямо, не превращая спор в драку за последнее слово.',
  },
  energy_recovery: {
    key: 'energy_recovery',
    title: 'Нагрузка и отдых',
    subtitle: 'Что быстрее утомляет и какой режим переносится легче',
    teaser: 'Какие задачи забирают больше сил, где нужна пауза и как не перегружать день.',
  },
};

const paidSet = new Set<InterpretationSectionKey>(HUMAN_PAID_SECTION_KEYS);

export function isHumanPaidSectionKey(value: string): value is HumanPaidSectionKey {
  return paidSet.has(value as InterpretationSectionKey);
}

export function humanPaidCacheKey(sectionKey: HumanPaidSectionKey): string {
  return withAppVoiceCacheKey(`human_v2.paid.${sectionKey}`);
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
      ctaLabel: 'Открыть подробный разбор',
    };
  });
}
