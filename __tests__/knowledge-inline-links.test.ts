import fs from 'fs';
import path from 'path';
import {
  buildKnowledgeInlineLinkCandidates,
  getKnowledgeTopics,
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
    const candidates = buildKnowledgeInlineLinkCandidates(topics, 'current');
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

  it('is wired to a semantic internal link that opens another article in place', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'views/v2/AstrologyEncyclopedia.tsx'),
      'utf8',
    );

    expect(source).toContain('buildKnowledgeInlineLinkCandidates');
    expect(source).toContain('splitKnowledgeTextWithLinks');
    expect(source).toContain('href={`#knowledge-${segment.topicId}`}');
    expect(source).toContain('openTopic(segment.topicId)');
    expect(source).toContain('navigationTrail');
    expect(source).toContain('className="encyclopedia-inline-link"');
    expect(source).toContain('event.preventDefault()');
  });

  it('links real terms inside the four reference articles', () => {
    const realTopics = getKnowledgeTopics('ru');
    const byId = new Map(realTopics.map((item) => [item.id, item]));

    for (const topicId of ['retrograde-mercury', 'ascendant', 'house-7', 'aspect-square']) {
      const current = byId.get(topicId)!;
      const candidates = buildKnowledgeInlineLinkCandidates(realTopics, topicId);
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
});
