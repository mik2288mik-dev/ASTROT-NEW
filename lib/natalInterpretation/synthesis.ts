import { TOPIC_TITLES_RU } from './meanings';
import type { NatalMeaning, NatalMeaningTopic, NatalTopicPlan } from './types';

const TOPIC_ORDER: readonly NatalMeaningTopic[] = [
  'character', 'emotions', 'communication', 'relationships', 'work', 'money', 'home', 'learning', 'rest', 'general',
];
function score(meaning: NatalMeaning): number {
  if (meaning.scope === 'background') return -1;
  if (meaning.semanticKey.startsWith('body-sign:')) return 100;
  if (meaning.semanticKey.startsWith('angle-sign:')) return 80;
  if (meaning.semanticKey.startsWith('aspect:')) return 60;
  return 20;
}
function ranked(meanings: readonly NatalMeaning[]): NatalMeaning[] {
  return meanings.filter(meaning => score(meaning) > 0)
    .map((meaning, index) => ({ meaning, index }))
    .sort((a, b) => score(b.meaning) - score(a.meaning) || (b.meaning.relevance || 0) - (a.meaning.relevance || 0) || a.index - b.index)
    .map(entry => entry.meaning);
}
export function buildNatalStoryMeaningIds(meanings: readonly NatalMeaning[]): string[] {
  // The report is a selection, not a verbal dump of every calculator field.
  // House cusps remain available on the map and in the relevant topic.
  const selected = ranked(meanings).filter(meaning => meaning.scope === 'personal').slice(0, 16);
  return selected.sort((a, b) => TOPIC_ORDER.indexOf(a.topics[0]) - TOPIC_ORDER.indexOf(b.topics[0]))
    .map(meaning => meaning.id);
}
export function buildNatalTopicPlans(meanings: readonly NatalMeaning[]): NatalTopicPlan[] {
  const available = ranked(meanings);
  return TOPIC_ORDER.flatMap(key => {
    if (key === 'general') return [];
    const selected = available.filter(meaning => (meaning.scope === 'personal'
      || (key === 'money' && /^house-cusp:(?:2|8):/.test(meaning.semanticKey))) && meaning.topics.includes(key))
      .sort((a, b) => Number(Boolean(b.topicText?.[key])) - Number(Boolean(a.topicText?.[key])))
      .slice(0, 8);
    if (!selected.length) return [];
    return [{ key, title: TOPIC_TITLES_RU[key], meaningIds: selected.map(meaning => meaning.id),
      evidenceIds: [...new Set(selected.flatMap(meaning => meaning.evidenceIds))] }];
  });
}
