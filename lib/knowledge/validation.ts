import { KNOWLEDGE_SOURCES } from './sources';
import {
  KNOWLEDGE_INLINE_LINKS,
  type KnowledgeInlineLinkDefinition,
} from './inlineLinkRegistry';
import type { KnowledgeTopicSource } from './types';

export type KnowledgeCatalogValidation = {
  duplicateIds: string[];
  brokenInlineLinks: Array<{ topicId: string; targetTopicId: string }>;
  brokenRelatedLinks: Array<{ topicId: string; relatedId: string }>;
  brokenSourceLinks: Array<{ topicId: string; sourceId: string }>;
};

export function validateKnowledgeCatalog(
  topics: readonly KnowledgeTopicSource[],
  inlineLinks: readonly KnowledgeInlineLinkDefinition[] = KNOWLEDGE_INLINE_LINKS,
): KnowledgeCatalogValidation {
  const counts = new Map<string, number>();
  topics.forEach((topic) => counts.set(topic.id, (counts.get(topic.id) || 0) + 1));
  const duplicateIds = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const topicIds = new Set(topics.map((topic) => topic.id));
  const sourceIds = new Set(KNOWLEDGE_SOURCES.map((source) => source.id));

  return {
    duplicateIds,
    brokenInlineLinks: inlineLinks.flatMap((definition) => definition.targetTopicIds
      .filter((targetTopicId) => (
        !topicIds.has(definition.topicId) || !topicIds.has(targetTopicId)
      ))
      .map((targetTopicId) => ({ topicId: definition.topicId, targetTopicId }))),
    brokenRelatedLinks: topics.flatMap((topic) => topic.relatedTopicIds
      .filter((relatedId) => !topicIds.has(relatedId))
      .map((relatedId) => ({ topicId: topic.id, relatedId }))),
    brokenSourceLinks: topics.flatMap((topic) => (topic.sourceIds || [])
      .filter((sourceId) => !sourceIds.has(sourceId))
      .map((sourceId) => ({ topicId: topic.id, sourceId }))),
  };
}
