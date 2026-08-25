import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TOPIC_SOURCES,
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  normalizeKnowledgeSearch,
  searchKnowledgeTopics,
  validateKnowledgeCatalog,
  type KnowledgeTopicSource,
} from '../lib/knowledge';

describe('beginner astrology encyclopedia catalog', () => {
  const ruTopics = getKnowledgeTopics('ru');
  const enTopics = getKnowledgeTopics('en');
  const byId = new Map(ruTopics.map((topic) => [topic.id, topic]));

  it('ships the same stable concepts in both locales without an artificial article-count target', () => {
    expect(KNOWLEDGE_CATEGORIES).toHaveLength(13);
    expect(enTopics.map((topic) => topic.id)).toEqual(ruTopics.map((topic) => topic.id));
    expect(new Set(ruTopics.map((topic) => topic.id)).size).toBe(ruTopics.length);
    expect(ruTopics.length).not.toBe(100);

    const groups = groupKnowledgeTopicsByCategory(ruTopics, 'ru');
    expect(groups.map((group) => group.categoryId)).toEqual(
      KNOWLEDGE_CATEGORIES.map((category) => category.id),
    );
    expect(groups.every((group) => group.topics.length > 0)).toBe(true);
  });

  it('covers the required foundation, reference, and advanced concepts', () => {
    const ids = new Set(ruTopics.map((topic) => topic.id));
    [
      'astrology-overview', 'what-is-horoscope', 'natal-chart-basics', 'zodiac-geometry',
      'zodiac-signs-vs-constellations', 'tropical-sidereal-zodiac',
      'planets-overview', 'planet-sun', 'planet-moon', 'planet-pluto', 'planet-chiron',
      'sign-aries', 'sign-taurus', 'sign-gemini', 'sign-cancer', 'sign-leo', 'sign-virgo',
      'sign-libra', 'sign-scorpio', 'sign-sagittarius', 'sign-capricorn', 'sign-aquarius', 'sign-pisces',
      'fire-element', 'earth-element', 'air-element', 'water-element',
      'cardinal-modality', 'fixed-modality', 'mutable-modality', 'sign-polarity', 'sign-rulership',
      'houses-overview', ...Array.from({ length: 12 }, (_, index) => `house-${index + 1}`),
      'house-cusp', 'house-systems', 'house-placidus', 'house-whole-sign', 'house-equal',
      'ascendant', 'descendant', 'midheaven', 'imum-coeli',
      'aspects-overview', 'aspect-conjunction', 'aspect-sextile', 'aspect-square',
      'aspect-trine', 'aspect-opposition', 'aspect-orb', 'aspect-exact',
      'lunar-cycle', 'new-moon', 'full-moon', 'moon-first-quarter', 'moon-last-quarter',
      'solar-eclipse', 'lunar-eclipse', 'retrograde-motion', 'direct-motion',
      'retrograde-station-direct', 'retrograde-mercury', 'planetary-ingress',
      'nodes-overview', 'node-north', 'node-south', 'black-moon-lilith', 'chart-point-object',
      'stellium', 'aspect-patterns', 'grand-trine', 't-square', 'grand-cross',
      'rulers-dispositors', 'planetary-dignities',
      'transits-current-sky', 'progressions', 'directions', 'solar-return', 'lunar-return', 'saturn-return',
      'synastry', 'composite-chart', 'ephemerides', 'degree-and-position',
      'astrology-branches', 'astrocartography',
    ].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('keeps every article structured, searchable, and connected only through valid IDs', () => {
    const validation = validateKnowledgeCatalog(KNOWLEDGE_TOPIC_SOURCES);
    expect(validation).toEqual({
      duplicateIds: [],
      brokenInlineLinks: [],
      brokenRelatedLinks: [],
      brokenSourceLinks: [],
    });

    for (const topic of ruTopics) {
      expect(topic.title.trim()).not.toBe('');
      expect(topic.summary.trim()).not.toBe('');
      expect(topic.shortAnswer.trim()).not.toBe('');
      expect(topic.sections.length).toBeGreaterThanOrEqual(2);
      expect(topic.aliases.length).toBeGreaterThan(0);
      expect(topic.keywords.length).toBeGreaterThan(0);
      expect(new Set(topic.relatedTopicIds).size).toBe(topic.relatedTopicIds.length);
      expect(topic.relatedTopicIds).not.toContain(topic.id);
      expect(topic).not.toHaveProperty('personalizationKind');
      expect(getRelatedKnowledgeTopics(ruTopics, topic).map((candidate) => candidate.id))
        .toEqual(topic.relatedTopicIds);
    }
  });

  it('reports duplicate IDs and broken internal links instead of failing silently', () => {
    const base = KNOWLEDGE_TOPIC_SOURCES[0];
    const broken: KnowledgeTopicSource = {
      ...base,
      id: 'broken-test-topic',
      relatedTopicIds: ['missing-topic'],
      sourceIds: ['missing-source'],
    };
    const validation = validateKnowledgeCatalog(
      [base, { ...base }, broken],
      [{ topicId: 'broken-test-topic', targetTopicIds: ['missing-inline-topic'] }],
    );

    expect(validation.duplicateIds).toEqual([base.id]);
    expect(validation.brokenRelatedLinks).toContainEqual({
      topicId: 'broken-test-topic', relatedId: 'missing-topic',
    });
    expect(validation.brokenInlineLinks).toContainEqual({
      topicId: 'broken-test-topic', targetTopicId: 'missing-inline-topic',
    });
    expect(validation.brokenSourceLinks).toContainEqual({
      topicId: 'broken-test-topic', sourceId: 'missing-source',
    });
  });

  it('finds abbreviations, aliases, English names, and common spelling variants', () => {
    const idsFor = (query: string) => searchKnowledgeTopics(ruTopics, query).map((topic) => topic.id);

    expect(idsFor('ASC')[0]).toBe('ascendant');
    expect(idsFor('асцедент')[0]).toBe('ascendant');
    expect(idsFor('восходящий знак')).toContain('ascendant');
    expect(idsFor('MC')).toContain('midheaven');
    expect(idsFor('ретро меркурий')[0]).toBe('retrograde-mercury');
    expect(idsFor('mercury retrograde')).toContain('retrograde-mercury');
    expect(idsFor('чёрная луна')).toContain('black-moon-lilith');
    expect(idsFor('соляр')).toContain('solar-return');
    expect(idsFor('стелиум')).toContain('stellium');
    expect(normalizeKnowledgeSearch('ЗВЁЗДЫ')).toBe('звезды');
  });

  it('keeps the reference articles factual first and visibly separates interpretation', () => {
    const required = [
      'ascendant', 'planet-moon', 'houses-overview', 'aspects-overview',
      'retrograde-motion', 'retrograde-mercury', 'full-moon', 'black-moon-lilith',
      'nodes-overview', 'planet-chiron', 'stellium', 'solar-return', 'synastry', 'progressions',
    ];
    for (const id of required) {
      const article = byId.get(id);
      expect(article).toBeDefined();
      expect(article!.sections.length).toBeGreaterThanOrEqual(3);
      expect(article!.sections.some((section) => section.kind === 'confusion')).toBe(true);
      expect(article!.summary).not.toMatch(/^В астрологии/u);
    }

    expect(byId.get('black-moon-lilith')!.summary).toContain('не планета');
    expect(byId.get('nodes-overview')!.summary).toContain('геометрические точки');
    expect(byId.get('retrograde-mercury')!.summary).toContain('не разворачивается');
    expect(byId.get('full-moon')!.relatedTopicIds).toContain('lunar-eclipse');
    expect(byId.get('aspects-overview')!.diagram).toBe('aspects');
  });
});
