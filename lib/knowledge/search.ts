import type { KnowledgeTopic } from './types';

export function normalizeKnowledgeSearch(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchableText(topic: KnowledgeTopic): string {
  return normalizeKnowledgeSearch([
    topic.title,
    topic.categoryLabel,
    topic.summary,
    ...topic.aliases,
    ...topic.keywords,
  ].join(' '));
}

function relevance(topic: KnowledgeTopic, normalizedQuery: string): number {
  const title = normalizeKnowledgeSearch(topic.title);
  const aliases = topic.aliases.map(normalizeKnowledgeSearch);
  const keywords = topic.keywords.map(normalizeKnowledgeSearch);
  const haystack = searchableText(topic);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.every((token) => haystack.includes(token))) return -1;

  let score = 1;
  if (title === normalizedQuery) score += 100;
  else if (title.startsWith(normalizedQuery)) score += 70;
  else if (title.includes(normalizedQuery)) score += 50;
  if (aliases.some((alias) => alias === normalizedQuery)) score += 80;
  else if (aliases.some((alias) => alias.includes(normalizedQuery))) score += 40;
  if (keywords.some((keyword) => keyword === normalizedQuery)) score += 30;
  return score;
}

export function searchKnowledgeTopics(
  topics: readonly KnowledgeTopic[],
  query: string,
): KnowledgeTopic[] {
  const normalizedQuery = normalizeKnowledgeSearch(query);
  if (!normalizedQuery) return [...topics];
  return topics
    .map((topic, index) => ({ topic, index, score: relevance(topic, normalizedQuery) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.topic);
}
