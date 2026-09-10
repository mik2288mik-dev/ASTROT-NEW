import type { UserProfile } from '../types';
import {
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
  type KnowledgeTopic,
} from './knowledge';

export type EncyclopediaTopic = KnowledgeTopic;
export { INITIAL_ENCYCLOPEDIA_SCREEN };

/** Stable entry point retained for existing routes and internal imports. */
export function getEncyclopediaTopics(language: UserProfile['language']): readonly EncyclopediaTopic[] {
  return getKnowledgeTopics(language);
}

export function groupTopicsByCategory(
  topics: readonly EncyclopediaTopic[],
): Array<[string, EncyclopediaTopic[]]> {
  const language = topics[0]?.categoryLabel === 'Start here' ? 'en' : 'ru';
  return groupKnowledgeTopicsByCategory(topics, language)
    .map((group) => [group.label, group.topics]);
}

export function getRelatedTopics(
  topics: readonly EncyclopediaTopic[],
  activeTopicId: string,
): EncyclopediaTopic[] {
  const active = topics.find((topic) => topic.id === activeTopicId);
  return active ? getRelatedKnowledgeTopics(topics, active) : [];
}
