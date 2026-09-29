import { TOPIC_TITLES_RU } from './meanings';
import type { NatalMeaning, NatalMeaningScope, NatalMeaningTopic, NatalTopicPlan } from './types';

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

const TOPIC_RANK = new Map<NatalMeaningTopic, number>(
  TOPIC_ORDER.map((key, index) => [key, index]),
);

const SCOPE_RANK: Record<NatalMeaningScope, number> = {
  personal: 0,
  structural: 1,
  background: 2,
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function primaryTopic(meaning: NatalMeaning): NatalMeaningTopic {
  // Background factors remain in the reading but do not masquerade as a
  // dedicated statement about character/emotions/etc.
  if (meaning.scope === 'background') return 'general';
  return meaning.topics.find((key) => TOPIC_RANK.has(key)) || 'general';
}

export function buildNatalStoryMeaningIds(meanings: readonly NatalMeaning[]): string[] {
  // Keep every approved meaning, but put the story into an ordinary reading
  // order instead of leaking calculator/extraction order into the prose.
  return meanings
    .map((meaning, index) => ({ meaning, index }))
    .sort((a, b) => {
      const topicDelta = (TOPIC_RANK.get(primaryTopic(a.meaning)) ?? 999)
        - (TOPIC_RANK.get(primaryTopic(b.meaning)) ?? 999);
      if (topicDelta !== 0) return topicDelta;
      const scopeDelta = SCOPE_RANK[a.meaning.scope] - SCOPE_RANK[b.meaning.scope];
      return scopeDelta !== 0 ? scopeDelta : a.index - b.index;
    })
    .map(({ meaning }) => meaning.id);
}

export function buildNatalTopicPlans(meanings: readonly NatalMeaning[]): NatalTopicPlan[] {
  // One meaning belongs to one visible topic. This prevents "По темам" from
  // repeating the same sentence in several sections just because one factor
  // can technically touch several domains.
  const grouped = new Map<NatalMeaningTopic, NatalMeaning[]>();
  for (const meaning of meanings) {
    const key = primaryTopic(meaning);
    const current = grouped.get(key) || [];
    current.push(meaning);
    grouped.set(key, current);
  }

  return TOPIC_ORDER.flatMap((key) => {
    const selected = grouped.get(key) || [];
    if (!selected.length) return [];
    return [{
      key,
      title: TOPIC_TITLES_RU[key],
      meaningIds: selected.map((meaning) => meaning.id),
      evidenceIds: unique(selected.flatMap((meaning) => meaning.evidenceIds)),
    }];
  });
}
