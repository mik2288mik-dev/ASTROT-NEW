import type { KnowledgeTopic } from './types';

export const MAX_KNOWLEDGE_INLINE_LINKS = 3;

export type KnowledgeInlineLinkCandidate = {
  topicId: string;
  term: string;
  normalizedTerm: string;
};

export type KnowledgeInlineTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; topicId: string };

function normalizeInlineTerm(value: string): string {
  return value.toLocaleLowerCase().replaceAll('ё', 'е');
}

function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

function hasWordBoundaries(text: string, start: number, term: string): boolean {
  const end = start + term.length;
  const startsWithWord = isWordCharacter(term[0]);
  const endsWithWord = isWordCharacter(term[term.length - 1]);

  return (!startsWithWord || !isWordCharacter(text[start - 1]))
    && (!endsWithWord || !isWordCharacter(text[end]));
}

/**
 * Builds a conservative list of terms that have exactly one destination.
 * Keywords are intentionally excluded: they improve search, but are often too
 * broad to behave like links inside prose.
 */
export function buildKnowledgeInlineLinkCandidates(
  topics: readonly KnowledgeTopic[],
  activeTopicId: string,
): KnowledgeInlineLinkCandidate[] {
  const destinationsByTerm = new Map<string, { term: string; topicIds: Set<string> }>();

  for (const topic of topics) {
    for (const rawTerm of [topic.title, ...topic.aliases]) {
      const term = rawTerm.trim();
      const normalizedTerm = normalizeInlineTerm(term);
      if (normalizedTerm.length < 2) continue;

      const existing = destinationsByTerm.get(normalizedTerm);
      if (existing) {
        existing.topicIds.add(topic.id);
      } else {
        destinationsByTerm.set(normalizedTerm, {
          term,
          topicIds: new Set([topic.id]),
        });
      }
    }
  }

  return Array.from(destinationsByTerm.entries())
    .flatMap(([normalizedTerm, entry]) => {
      if (entry.topicIds.size !== 1) return [];
      const [topicId] = entry.topicIds;
      if (!topicId || topicId === activeTopicId) return [];
      return [{ topicId, term: entry.term, normalizedTerm }];
    })
    .sort((left, right) => (
      right.normalizedTerm.length - left.normalizedTerm.length
      || left.normalizedTerm.localeCompare(right.normalizedTerm)
    ));
}

function findCandidateIndex(
  normalizedText: string,
  candidate: KnowledgeInlineLinkCandidate,
  fromIndex: number,
): number {
  let index = normalizedText.indexOf(candidate.normalizedTerm, fromIndex);
  while (index >= 0) {
    if (hasWordBoundaries(normalizedText, index, candidate.normalizedTerm)) return index;
    index = normalizedText.indexOf(candidate.normalizedTerm, index + 1);
  }
  return -1;
}

/** Splits one paragraph into text and a small number of internal topic links. */
export function splitKnowledgeTextWithLinks(
  text: string,
  candidates: readonly KnowledgeInlineLinkCandidate[],
  maxLinks = MAX_KNOWLEDGE_INLINE_LINKS,
): KnowledgeInlineTextSegment[] {
  const normalizedText = normalizeInlineTerm(text);
  const linkLimit = Math.max(0, Math.floor(maxLinks));
  if (!normalizedText || !candidates.length || linkLimit === 0) {
    return [{ kind: 'text', text }];
  }

  const segments: KnowledgeInlineTextSegment[] = [];
  const linkedTopicIds = new Set<string>();
  let cursor = 0;

  while (cursor < text.length && linkedTopicIds.size < linkLimit) {
    let selected: { candidate: KnowledgeInlineLinkCandidate; index: number } | null = null;

    for (const candidate of candidates) {
      if (linkedTopicIds.has(candidate.topicId)) continue;
      const index = findCandidateIndex(normalizedText, candidate, cursor);
      if (index < 0) continue;
      if (
        !selected
        || index < selected.index
        || (index === selected.index
          && candidate.normalizedTerm.length > selected.candidate.normalizedTerm.length)
      ) {
        selected = { candidate, index };
      }
    }

    if (!selected) break;
    if (selected.index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, selected.index) });
    }

    const linkEnd = selected.index + selected.candidate.normalizedTerm.length;
    segments.push({
      kind: 'link',
      text: text.slice(selected.index, linkEnd),
      topicId: selected.candidate.topicId,
    });
    linkedTopicIds.add(selected.candidate.topicId);
    cursor = linkEnd;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }

  return segments.length ? segments : [{ kind: 'text', text }];
}
