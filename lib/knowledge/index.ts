import { KNOWLEDGE_CATEGORIES } from './categories';
import { ASPECT_TOPICS } from './aspects';
import { ANGLE_TOPICS } from './angles';
import { FORECAST_TOPICS } from './forecasts';
import { FOUNDATION_TOPICS } from './foundations';
import { HOUSE_TOPICS } from './houses';
import { MOON_CYCLE_TOPICS } from './moonCycles';
import { NODE_TOPICS } from './nodes';
import { PLANET_TOPICS } from './planets';
import { RELATIONSHIP_TOPICS } from './relationships';
import { RETROGRADE_TOPICS } from './retrogrades';
import { SIGN_TOPICS } from './signs';
import { SYNTHESIS_TOPICS } from './synthesis';
import { EXTENDED_TOPICS } from './extended';
import type {
  KnowledgeCategoryId,
  KnowledgeLanguage,
  KnowledgeTopic,
  KnowledgeTopicSource,
} from './types';

export * from './types';
export * from './search';
export * from './inlineLinks';
export * from './inlineLinkRegistry';
export * from './navigation';
export * from './sources';
export * from './validation';
export { KNOWLEDGE_CATEGORIES } from './categories';

export const INITIAL_ENCYCLOPEDIA_SCREEN = 'catalog' as const;

export const KNOWLEDGE_TOPIC_SOURCES: readonly KnowledgeTopicSource[] = [
  ...FOUNDATION_TOPICS,
  ...SIGN_TOPICS,
  ...PLANET_TOPICS,
  ...HOUSE_TOPICS,
  ...ANGLE_TOPICS,
  ...ASPECT_TOPICS,
  ...RETROGRADE_TOPICS,
  ...NODE_TOPICS,
  ...SYNTHESIS_TOPICS,
  ...RELATIONSHIP_TOPICS,
  ...FORECAST_TOPICS,
  ...MOON_CYCLE_TOPICS,
  ...EXTENDED_TOPICS,
];

export function knowledgeLanguage(language: string | null | undefined): KnowledgeLanguage {
  return language === 'en' ? 'en' : 'ru';
}

export function getKnowledgeTopics(languageValue: string | null | undefined): readonly KnowledgeTopic[] {
  const language = knowledgeLanguage(languageValue);
  const categoryLabels = new Map(
    KNOWLEDGE_CATEGORIES.map((category) => [category.id, category.label[language]]),
  );
  return KNOWLEDGE_TOPIC_SOURCES.map((source) => ({
    id: source.id,
    category: source.category,
    categoryLabel: categoryLabels.get(source.category) || source.category,
    aliases: source.aliases[language],
    keywords: source.keywords[language],
    relatedTopicIds: source.relatedTopicIds,
    diagram: source.diagram,
    sourceIds: source.sourceIds || [],
    ...source.copy[language],
  }));
}

export function groupKnowledgeTopicsByCategory(
  topics: readonly KnowledgeTopic[],
  languageValue?: string | null,
): Array<{ categoryId: KnowledgeCategoryId; label: string; description: string; topics: KnowledgeTopic[] }> {
  const language = knowledgeLanguage(languageValue);
  return KNOWLEDGE_CATEGORIES.map((category) => ({
    categoryId: category.id,
    label: category.label[language],
    description: category.description[language],
    topics: topics.filter((topic) => topic.category === category.id),
  })).filter((group) => group.topics.length > 0);
}

export function getRelatedKnowledgeTopics(
  topics: readonly KnowledgeTopic[],
  topic: KnowledgeTopic,
): KnowledgeTopic[] {
  const byId = new Map(topics.map((candidate) => [candidate.id, candidate]));
  return topic.relatedTopicIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is KnowledgeTopic => Boolean(candidate) && candidate?.id !== topic.id);
}
