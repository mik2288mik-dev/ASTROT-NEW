import type { RelationshipContext } from './relationshipContext';

export const COMPATIBILITY_STORY_TOPICS = ['architecture', 'support', 'risk', 'verdict', 'index', 'action_do', 'action_dont'] as const;
export type CompatibilityStoryTopic = typeof COMPATIBILITY_STORY_TOPICS[number];

const TITLES: Record<CompatibilityStoryTopic, [string, string]> = {
  architecture: ['Архитектура связи и расстановка сил', 'Connection architecture and power dynamics'],
  support: ['Точки опоры', 'Support points'],
  risk: ['Зоны риска', 'Risk zones'],
  verdict: ['Вердикт и правила', 'Verdict and rules'],
  index: ['Индекс связи', 'Connection index'],
  action_do: ['Что делать', 'What to do'],
  action_dont: ['Чего не делать', 'What not to do'],
};

export function compatibilityTopicTitle(topic: CompatibilityStoryTopic, context: RelationshipContext, language: 'ru' | 'en'): string {
  return TITLES[topic][language === 'ru' ? 0 : 1];
}
