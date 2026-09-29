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
    title: 'Внутренние реакции',
    subtitle: 'Что включается автоматически и как ты восстанавливаешься',
    teaser: 'Как меняется скорость реакции, что усиливает её и какие условия помогают вернуться к обычному темпу.',
  },
  communication: {
    key: 'communication',
    title: 'Общение',
    subtitle: 'Как ты думаешь, объясняешь и слышишь другого',
    teaser: 'Как устроены твои речь и мышление, где ты особенно точен и где разговор может рассыпаться.',
  },
  relationships_deep: {
    key: 'relationships_deep',
    title: 'Отношения подробно',
    subtitle: 'Сближение, ожидания, границы и договорённости',
    teaser: 'Как строятся сближение, ожидания, границы и договорённости.',
  },
  conflicts: {
    key: 'conflicts',
    title: 'Конфликты',
    subtitle: 'Как ты споришь, защищаешь позицию и отвечаешь на давление',
    teaser: 'Как меняется ответ в споре, как защищается позиция и какие условия удерживают разговор в рамках фактов.',
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
    subtitle: 'Как ты оцениваешь ресурсы и принимаешь финансовые решения',
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
    title: 'Главные противоречия',
    subtitle: 'Какие сильные части карты тянут решения в разные стороны',
    teaser: 'Где внутри возникает реальный спор и почему одна универсальная стратегия не работает.',
  },
  important_aspects: {
    key: 'important_aspects',
    title: 'Важные аспекты',
    subtitle: 'Самые точные связи карты без списка всего подряд',
    teaser: 'Какие аспекты действительно меняют портрет и на каких выводах держится подробный разбор.',
  },
};

const paidSet = new Set<InterpretationSectionKey>(HUMAN_PAID_SECTION_KEYS);

export function isHumanPaidSectionKey(value: string): value is HumanPaidSectionKey {
  return paidSet.has(value as InterpretationSectionKey);
}
