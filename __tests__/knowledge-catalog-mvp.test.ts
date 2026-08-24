import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TOPIC_SOURCES,
  getKnowledgeTopics,
  getKnowledgeArticlePresentation,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  normalizeKnowledgeSearch,
  searchKnowledgeTopics,
} from '../lib/knowledge';

describe('first-release knowledge catalog', () => {
  const ruTopics = getKnowledgeTopics('ru');
  const enTopics = getKnowledgeTopics('en');

  it('ships the complete twelve-category beginner catalog in both languages', () => {
    expect(KNOWLEDGE_CATEGORIES).toHaveLength(12);
    expect(ruTopics).toHaveLength(100);
    expect(enTopics.map((topic) => topic.id)).toEqual(ruTopics.map((topic) => topic.id));
    expect(new Set(ruTopics.map((topic) => topic.id)).size).toBe(ruTopics.length);

    const groups = groupKnowledgeTopicsByCategory(ruTopics, 'ru');
    expect(groups.map((group) => group.categoryId)).toEqual(KNOWLEDGE_CATEGORIES.map((category) => category.id));
    expect(groups.map((group) => group.label)).toEqual([
      'С чего начать',
      'Знаки зодиака',
      'Планеты',
      'Дома',
      'Углы карты',
      'Аспекты',
      'Ретроградность',
      'Узлы и расчётные точки',
      'Как читать карту целиком',
      'Отношения и совместимость',
      'Прогнозы',
      'Луна и циклы',
    ]);
    expect(groups.every((group) => group.topics.length > 0)).toBe(true);
  });

  it('covers all required signs, houses, planets, angles, and main aspects', () => {
    const ids = new Set(ruTopics.map((topic) => topic.id));
    [
      'sign-aries', 'sign-taurus', 'sign-gemini', 'sign-cancer', 'sign-leo', 'sign-virgo',
      'sign-libra', 'sign-scorpio', 'sign-sagittarius', 'sign-capricorn', 'sign-aquarius', 'sign-pisces',
      ...Array.from({ length: 12 }, (_, index) => `house-${index + 1}`),
      'planet-sun', 'planet-moon', 'planet-mercury', 'planet-venus', 'planet-mars',
      'planet-jupiter', 'planet-saturn', 'planet-uranus', 'planet-neptune', 'planet-pluto', 'planet-chiron',
      'ascendant', 'descendant', 'midheaven', 'imum-coeli',
      'aspect-conjunction', 'aspect-sextile', 'aspect-square', 'aspect-trine', 'aspect-opposition',
      'nodes-overview', 'retrograde-mercury', 'transits-current-sky', 'lunar-cycle-calendar',
    ].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('keeps every article structured, plain, and explicitly linked', () => {
    const ids = new Set(ruTopics.map((topic) => topic.id));
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
      topic.relatedTopicIds.forEach((relatedId) => expect(ids.has(relatedId)).toBe(true));

      const related = getRelatedKnowledgeTopics(ruTopics, topic);
      expect(related.map((candidate) => candidate.id)).toEqual(topic.relatedTopicIds);
    }

    const russianCopy = JSON.stringify(KNOWLEDGE_TOPIC_SOURCES.map((topic) => topic.copy.ru));
    expect(russianCopy).not.toMatch(/проявл|энерги|ресурс|проработ|паттерн|внутренн(?:яя|ей|юю) опор|сценари|подсвеч|реализац(?:ия|ии) потенциал|глубинн(?:ая|ой|ую) трансформац|вселенн|судьба велит|кармическ(?:ий|ая|ое)/iu);
    expect(russianCopy).not.toMatch(/\d/u);
  });

  it('finds familiar words, abbreviations, aliases, and spelling variants locally', () => {
    const idsFor = (query: string) => searchKnowledgeTopics(ruTopics, query).map((topic) => topic.id);

    expect(idsFor('asc')).toContain('ascendant');
    expect(idsFor('асцендент')).toContain('ascendant');
    expect(idsFor('восходящий знак')).toContain('ascendant');
    expect(idsFor('квадрат')).toEqual(expect.arrayContaining(['aspect-square', 'aspects-overview']));
    expect(idsFor('любовь')).toEqual(expect.arrayContaining([
      'planet-venus', 'house-7', 'sign-compatibility', 'two-chart-compatibility',
    ]));
    expect(idsFor('ретро')).toContain('retrograde-motion');
    expect(normalizeKnowledgeSearch('ЗВЁЗДЫ')).toBe('звезды');
  });

  it('keeps one compact topic tag in article headers', () => {
    const byId = new Map(ruTopics.map((topic) => [topic.id, topic]));

    expect(getKnowledgeArticlePresentation(byId.get('planet-venus')!, 'ru')).toEqual({
      tag: 'Натальная карта',
    });
    expect(getKnowledgeArticlePresentation(byId.get('ascendant')!, 'ru').tag).toBe('Точное время');
    expect(getKnowledgeArticlePresentation(byId.get('house-7')!, 'ru').tag).toBe('Время рождения');
  });
});
