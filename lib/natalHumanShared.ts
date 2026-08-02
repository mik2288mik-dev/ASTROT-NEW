import type {
  InterpretationSection,
  InterpretationSectionKey,
} from '../types';
import { withAppVoiceCacheKey, withAppVoiceVersion } from './appVoice';
import {
  FREE_NATAL_SECTION_KEYS,
  NATAL_SEMANTIC_VERSION,
  PREMIUM_NATAL_SECTION_KEYS,
} from './natalSemanticCompiler';

export const HUMAN_INTERPRETATION_PROMPT_VERSION = withAppVoiceVersion('lumia-human-v2');
export const HUMAN_BASE_PROMPT_VERSION = withAppVoiceVersion(`lumia-human-v7.${NATAL_SEMANTIC_VERSION}.free-complete`);
export const HUMAN_PAID_PROMPT_VERSION = withAppVoiceVersion(`lumia-human-v6.${NATAL_SEMANTIC_VERSION}.premium-depth`);
export const HUMAN_BASE_CACHE_KEY = withAppVoiceCacheKey('human_v3.semantic.base');

export const HUMAN_FREE_SECTION_KEYS = FREE_NATAL_SECTION_KEYS;

export const HUMAN_PAID_SECTION_KEYS = PREMIUM_NATAL_SECTION_KEYS;

export type HumanPaidSectionKey = (typeof HUMAN_PAID_SECTION_KEYS)[number];

export const HUMAN_MAP_SECTION_KEYS = [
  'inner_reactions',
  'communication',
  'relationships_deep',
  'conflicts',
  'work',
  'money',
  'abilities',
  'central_contradictions',
  'important_aspects',
] as const satisfies readonly HumanPaidSectionKey[];

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
    teaser: 'Что происходит внутри под давлением, как меняется реакция и что помогает вернуть ясность.',
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
    teaser: 'Как ты входишь в близкий контакт, чего ждёшь и где важно говорить прямо.',
  },
  conflicts: {
    key: 'conflicts',
    title: 'Конфликты',
    subtitle: 'Как ты споришь, защищаешь позицию и отвечаешь на давление',
    teaser: 'Что делает ответ резким, когда ты закрываешь разговор и как сохранить точность без лишней борьбы.',
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

export function humanPaidCacheKey(sectionKey: HumanPaidSectionKey): string {
  return withAppVoiceCacheKey(`human_v3.semantic.paid.${sectionKey}`);
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
