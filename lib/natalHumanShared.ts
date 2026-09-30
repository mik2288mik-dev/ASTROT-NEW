import type { InterpretationSectionKey } from '../types';

export const HUMAN_PAID_SECTION_KEYS = [
  'inner_reactions',
  'communication',
  'relationships_deep',
  'conflicts',
  'work',
  'money',
  'abilities',
  'central_contradictions',
  'important_aspects',
] as const satisfies readonly InterpretationSectionKey[];

export type HumanPaidSectionKey = (typeof HUMAN_PAID_SECTION_KEYS)[number];

export type HumanSectionMeta = {
  key: InterpretationSectionKey;
  title: string;
  subtitle: string;
  teaser: string;
  ctaLabel?: string;
};

export const HUMAN_PAID_SECTION_META: Record<HumanPaidSectionKey, HumanSectionMeta> = {
  inner_reactions: {
    key: 'inner_reactions',
    title: 'Эмоции',
    subtitle: 'Что ты чувствуешь и как отвечаешь на происходящее',
    teaser: 'Что тебя затрагивает и что помогает успокоиться.',
  },
  communication: {
    key: 'communication',
    title: 'Общение',
    subtitle: 'Как ты думаешь, объясняешь и слышишь другого',
    teaser: 'Как ты объясняешь свои мысли и понимаешь собеседника.',
  },
  relationships_deep: {
    key: 'relationships_deep',
    title: 'Отношения подробно',
    subtitle: 'Как ты сближаешься и договариваешься с близкими',
    teaser: 'Что ты ценишь в отношениях и как показываешь симпатию.',
  },
  conflicts: {
    key: 'conflicts',
    title: 'Конфликты',
    subtitle: 'Как ты споришь, защищаешь позицию и отвечаешь на давление',
    teaser: 'Как ты выражаешь несогласие и слышишь другого человека.',
  },
  work: {
    key: 'work',
    title: 'Работа',
    subtitle: 'Темп, ответственность и подходящие типы задач',
    teaser: 'Какой способ работы даёт результат, где нужна самостоятельность и что мешает держать темп.',
  },
  money: {
    key: 'money',
    title: 'Деньги',
    subtitle: 'Как ты решаешь, на что тратить и что беречь',
    teaser: 'Где ты осторожен, где рискуешь и какие условия делают решение понятнее. Без обещаний дохода.',
  },
  abilities: {
    key: 'abilities',
    title: 'Способности',
    subtitle: 'Сильные сочетания навыков и подходящие задачи',
    teaser: 'Что у тебя получается особенно хорошо и в каких задачах это реально полезно. Без назначения профессии.',
  },
  central_contradictions: {
    key: 'central_contradictions',
    title: 'Сложные решения',
    subtitle: 'Какие желания бывает трудно совместить',
    teaser: 'Что ты учитываешь, когда нужно выбрать между важными для тебя вещами.',
  },
  important_aspects: {
    key: 'important_aspects',
    title: 'Важные аспекты',
    subtitle: 'Связи между точками твоей карты',
    teaser: 'Какие расчётные данные помогают объяснить разбор.',
  },
};

const paidSet = new Set<InterpretationSectionKey>(HUMAN_PAID_SECTION_KEYS);

export function isHumanPaidSectionKey(value: string): value is HumanPaidSectionKey {
  return paidSet.has(value as InterpretationSectionKey);
}
