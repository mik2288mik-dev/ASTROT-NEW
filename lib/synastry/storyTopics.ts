import type { RelationshipContext } from './relationshipContext';

/**
 * The reader uses the same familiar wording for every relationship context.
 * Context changes the facts and examples, not the vocabulary of the headings.
 */
export const COMPATIBILITY_STORY_TOPICS = ['what_works', 'misunderstandings', 'say_it_early', 'dont_inflate'] as const;
export type CompatibilityStoryTopic = typeof COMPATIBILITY_STORY_TOPICS[number];

const TITLES: Record<CompatibilityStoryTopic, [string, string]> = {
  what_works: ['Что у вас получается', 'What works between you'],
  misunderstandings: ['Где можете не понять друг друга', 'Where you may miss each other'],
  say_it_early: ['О чём лучше сказать сразу', 'What is worth saying early'],
  dont_inflate: ['Что не стоит раздувать', 'What not to turn into a big deal'],
};

export function compatibilityTopicTitle(topic: CompatibilityStoryTopic, context: RelationshipContext, language: 'ru' | 'en'): string {
  return TITLES[topic][language === 'ru' ? 0 : 1];
}
