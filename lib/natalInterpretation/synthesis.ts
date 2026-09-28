import { TOPIC_TITLES_RU } from './meanings';
import type { NatalMeaning, NatalMeaningTopic, NatalTopicPlan } from './types';

const TOPIC_ORDER: readonly NatalMeaningTopic[] = [
  'character',
  'emotions',
  'communication',
  'relationships',
  'work',
  'money',
  'home',
  'learning',
  'rest',
  'general',
];

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function buildNatalStoryMeaningIds(meanings: readonly NatalMeaning[]): string[] {
  // No importance filter: every approved meaning participates once.
  return meanings.map((meaning) => meaning.id);
}

export function buildNatalTopicPlans(meanings: readonly NatalMeaning[]): NatalTopicPlan[] {
  return TOPIC_ORDER.flatMap((key) => {
    const selected = meanings.filter((meaning) => meaning.topics.includes(key));
    if (!selected.length) return [];
    return [{
      key,
      title: TOPIC_TITLES_RU[key],
      meaningIds: selected.map((meaning) => meaning.id),
      evidenceIds: unique(selected.flatMap((meaning) => meaning.evidenceIds)),
    }];
  });
}
