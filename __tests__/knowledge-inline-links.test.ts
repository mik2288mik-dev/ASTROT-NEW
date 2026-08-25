import fs from 'fs';
import path from 'path';
import {
  buildKnowledgeInlineLinkCandidates,
  getKnowledgeInlineTargetIds,
  getKnowledgeTopics,
  splitKnowledgeBlockWithLinks,
  splitKnowledgeTextWithLinks,
  type KnowledgeTopic,
} from '../lib/knowledge';

function topic(id: string, title: string, aliases: readonly string[]): KnowledgeTopic {
  return {
    id,
    title,
    aliases,
    category: 'start',
    categoryLabel: 'С чего начать',
    keywords: [],
    summary: title,
    sections: [],
    shortAnswer: title,
    relatedTopicIds: [],
    sourceIds: [],
  };
}

describe('knowledge article inline links', () => {
  const topics: readonly KnowledgeTopic[] = [
    topic('current', 'Углы карты', ['углы']),
    topic('ascendant', 'Асцендент', ['восходящий знак', 'знак']),
    topic('signs', 'Знаки', ['знак']),
    topic('midheaven', 'MC', ['середина неба']),
    topic('venus', 'Венера', ['венера в карте']),
    topic('mars', 'Марс', ['марс в карте']),
    topic('duplicate-one', 'Первый', ['общий термин']),
    topic('duplicate-two', 'Второй', ['общий термин']),
  ];

  it('uses the longest unambiguous terms, avoids self-links, and caps each paragraph', () => {
    const candidates = buildKnowledgeInlineLinkCandidates(
      topics,
      'current',
      topics.map((item) => item.id),
    );
    const segments = splitKnowledgeTextWithLinks(
      'Восходящий знак, MC, Венера, Марс и общий термин.',
      candidates,
    );
    const links = segments.filter((segment) => segment.kind === 'link');

    expect(links).toEqual([
      { kind: 'link', text: 'Восходящий знак', topicId: 'ascendant' },
      { kind: 'link', text: 'MC', topicId: 'midheaven' },
      { kind: 'link', text: 'Венера', topicId: 'venus' },
    ]);
    expect(links.some((segment) => segment.topicId === 'mars')).toBe(false);
    expect(candidates.some((candidate) => candidate.normalizedTerm === 'общий термин')).toBe(false);
    expect(candidates.some((candidate) => candidate.topicId === 'current')).toBe(false);
  });

  it('keeps one small link budget across a semantic block', () => {
    const candidates = buildKnowledgeInlineLinkCandidates(
      topics,
      'current',
      ['ascendant', 'midheaven', 'venus'],
    );
    const paragraphs = splitKnowledgeBlockWithLinks([
      'Асцендент и MC задают опорные точки.',
      'Асцендент повторяется, а Венера появляется позже.',
    ], candidates);
    const links = paragraphs.flatMap((segments) => (
      segments.filter((segment) => segment.kind === 'link')
    ));

    expect(links).toEqual([
      { kind: 'link', text: 'Асцендент', topicId: 'ascendant' },
      { kind: 'link', text: 'MC', topicId: 'midheaven' },
    ]);
  });

  it('opens a compact definition before navigating to another article', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'views/v2/AstrologyEncyclopedia.tsx'),
      'utf8',
    );

    expect(source).toContain('buildKnowledgeInlineLinkCandidates');
    expect(source).toContain('getKnowledgeInlineTargetIds');
    expect(source).toContain('splitKnowledgeBlockWithLinks');
    expect(source).toContain("type: 'show-inline-preview'");
    expect(source).toContain('aria-expanded={isExpanded}');
    expect(source).toContain('Открыть статью');
    expect(source).toContain('openTopic(inlinePreviewTopic.id)');
    expect(source).toContain('knowledgeNavigationReducer');
    expect(source).toContain('className={styles.inlineLink}');
    expect(source).not.toContain('href={`#knowledge-${segment.topicId}`}');
  });

  it('links real terms inside the four reference articles', () => {
    const realTopics = getKnowledgeTopics('ru');
    const byId = new Map(realTopics.map((item) => [item.id, item]));

    for (const topicId of ['retrograde-mercury', 'ascendant', 'house-7', 'aspect-square']) {
      const current = byId.get(topicId)!;
      const candidates = buildKnowledgeInlineLinkCandidates(
        realTopics,
        topicId,
        getKnowledgeInlineTargetIds(current),
      );
      const visibleParagraphs = [
        current.summary,
        ...current.sections.flatMap((section) => section.paragraphs),
      ];
      const linkedDestinations = visibleParagraphs.flatMap((paragraph) => (
        splitKnowledgeTextWithLinks(paragraph, candidates)
          .filter((segment) => segment.kind === 'link')
          .map((segment) => segment.topicId)
      ));

      expect(linkedDestinations.length).toBeGreaterThan(0);
    }
  });

  it('does not link an astronomical mention of Earth to the Earth element', () => {
    const realTopics = getKnowledgeTopics('ru');
    const fullMoon = realTopics.find((item) => item.id === 'full-moon')!;
    const candidates = buildKnowledgeInlineLinkCandidates(
      realTopics,
      fullMoon.id,
      getKnowledgeInlineTargetIds(fullMoon),
    );

    expect(candidates.map((candidate) => candidate.topicId)).not.toContain('earth-element');
    expect(candidates.map((candidate) => candidate.topicId)).toContain('planet-moon');
  });
});
