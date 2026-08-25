import fs from 'fs';
import path from 'path';
import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../lib/knowledgeEncyclopedia';
import {
  getKnowledgeTopics,
  INITIAL_KNOWLEDGE_NAVIGATION,
  knowledgeNavigationReducer,
  searchKnowledgeTopics,
} from '../lib/knowledge';
import {
  ENCYCLOPEDIA_CATEGORY_GROUPS,
  ENCYCLOPEDIA_HUBS,
  HUB_BRANCH_PREVIEW_TOPIC_IDS,
  POPULAR_KNOWLEDGE_TOPICS,
  shouldShowKnowledgeContents,
} from '../views/v2/encyclopediaPresentation';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('knowledge encyclopedia flow', () => {
  const topics = getEncyclopediaTopics('ru');

  it('opens with a beginner map of the subject instead of an alphabetic dump', () => {
    expect(INITIAL_ENCYCLOPEDIA_SCREEN).toBe('catalog');
    expect(groupTopicsByCategory(topics).map(([category]) => category)).toEqual([
      'С чего начать',
      'Знаки зодиака',
      'Планеты и светила',
      'Дома',
      'Углы карты',
      'Аспекты',
      'Движение планет',
      'Дополнительные точки и объекты',
      'Структуры карты',
      'Отношения',
      'Прогностические методы',
      'Луна и лунный цикл',
      'Другие понятия и методы',
    ]);
  });

  it('keeps the thirteen data categories behind six human entry points', () => {
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const categoryIds = ENCYCLOPEDIA_HUBS.flatMap((hub) => hub.categoryIds);

    expect(ENCYCLOPEDIA_HUBS).toHaveLength(6);
    expect(new Set(categoryIds).size).toBe(13);
    expect(categoryIds).toEqual([
      'start',
      'planets', 'signs',
      'houses', 'angles', 'aspects', 'synthesis',
      'moon-cycles',
      'retrogrades', 'forecasts',
      'nodes-points', 'compatibility', 'branches-tools',
    ]);
    expect(POPULAR_KNOWLEDGE_TOPICS.map((topic) => topic.topicId)).toEqual([
      'ascendant',
      'retrograde-mercury',
      'full-moon',
      'houses-overview',
      'black-moon-lilith',
    ]);
    expect(ENCYCLOPEDIA_HUBS.find((hub) => hub.id === 'other-concepts')?.featuredTopicIds)
      .toEqual(['planet-chiron']);
    expect(encyclopedia).toContain('Часто ищут');
    expect(encyclopedia).toContain('Разобраться по теме');
    expect(encyclopedia).toContain("hub?.categoryIds.length === 1");
    expect(encyclopedia).toContain('Выберите подраздел');
    expect(encyclopedia).not.toContain('russianMaterialCount');
    expect(encyclopedia).not.toContain('categoryMeta');
  });

  it('uses valid representative articles for every navigation branch', () => {
    const topicById = new Map(topics.map((topic) => [topic.id, topic]));

    Object.entries(HUB_BRANCH_PREVIEW_TOPIC_IDS).forEach(([categoryId, topicIds]) => {
      expect(topicIds).toHaveLength(3);
      topicIds.forEach((topicId) => {
        expect(topicById.get(topicId)?.category).toBe(categoryId);
      });
    });
  });

  it('groups long topic pages without adding another navigation level', () => {
    Object.entries(ENCYCLOPEDIA_CATEGORY_GROUPS).forEach(([categoryId, groups]) => {
      const groupedIds = groups.flatMap((group) => group.topicIds);
      const categoryIds = topics
        .filter((topic) => topic.category === categoryId)
        .map((topic) => topic.id);

      expect(new Set(groupedIds).size).toBe(groupedIds.length);
      expect(new Set(groupedIds)).toEqual(new Set(categoryIds));
      expect(groups.length).toBeGreaterThanOrEqual(2);
      expect(groups.length).toBeLessThanOrEqual(4);
    });
  });

  it('returns from an article through its category and human section to the catalog', () => {
    let state = knowledgeNavigationReducer(INITIAL_KNOWLEDGE_NAVIGATION, {
      type: 'open-hub', hubId: 'chart-structure',
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-category', categoryId: 'houses',
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-article', categoryId: 'houses', topicId: 'houses-overview',
    });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({ screen: 'category', categoryId: 'houses' });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({ screen: 'hub', hubId: 'chart-structure' });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({ screen: 'catalog' });
    expect(state.history).toEqual([]);
    expect(state.restoreScrollTop).toBe(0);
  });

  it('restores article previews and scroll positions through A → B → C → B → A', () => {
    let state = knowledgeNavigationReducer(INITIAL_KNOWLEDGE_NAVIGATION, {
      type: 'open-article', categoryId: 'moon-cycles', topicId: 'full-moon', scrollTop: 40,
    });
    state = knowledgeNavigationReducer(state, {
      type: 'show-inline-preview',
      preview: {
        targetTopicId: 'lunar-eclipse',
        blockId: 'full-moon-section-2-paragraph-0',
        triggerId: 'full-moon-eclipse-link',
      },
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-article',
      categoryId: 'moon-cycles',
      topicId: 'lunar-eclipse',
      scrollTop: 780,
    });
    state = knowledgeNavigationReducer(state, {
      type: 'show-inline-preview',
      preview: {
        targetTopicId: 'solar-eclipse',
        blockId: 'lunar-eclipse-section-1-paragraph-0',
        triggerId: 'lunar-eclipse-solar-link',
      },
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-article',
      categoryId: 'moon-cycles',
      topicId: 'solar-eclipse',
      scrollTop: 460,
    });
    expect(state.current).toEqual({
      screen: 'article', categoryId: 'moon-cycles', topicId: 'solar-eclipse',
    });

    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({
      screen: 'article', categoryId: 'moon-cycles', topicId: 'lunar-eclipse',
    });
    expect(state.restoreScrollTop).toBe(460);
    expect(state.inlinePreview?.targetTopicId).toBe('solar-eclipse');

    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({
      screen: 'article', categoryId: 'moon-cycles', topicId: 'full-moon',
    });
    expect(state.restoreScrollTop).toBe(780);
    expect(state.inlinePreview?.targetTopicId).toBe('lunar-eclipse');
  });

  it('keeps standalone and embedded routes without connecting personal chart data', () => {
    const app = read('App.tsx');
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const services = read('views/v2/ServiceScreen.tsx');

    expect(app).toContain("view === 'encyclopedia'");
    expect(app).toContain('<AstrologyEncyclopedia');
    expect(services).toContain('<AstrologyEncyclopedia');
    expect(services).toContain('embedded');
    expect(encyclopedia).toContain("title={ru ? 'Энциклопедия' : 'Encyclopedia'}");
    expect(encyclopedia).toContain('AstrologyEncyclopedia.module.css');
    expect(encyclopedia).not.toContain('EditorialChartsButton');
    [
      'primaryChartData',
      'personalReliability',
      'resolvePersonalKnowledge',
      'PersonalKnowledgeAccordion',
      'Что это значит в моей карте?',
      'Спросить о себе',
    ].forEach((fragment) => expect(encyclopedia).not.toContain(fragment));
  });

  it('keeps visible article layers, related concepts, sources, and native Android Back', () => {
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const knowledgeTopics = getKnowledgeTopics('ru');

    expect(encyclopedia).toContain('Что хотите понять?');
    expect(encyclopedia).toContain("section.depth !== 'deep'");
    expect(encyclopedia).toContain('renderArticleSection');
    expect(encyclopedia).toContain('В этой статье');
    expect(shouldShowKnowledgeContents(
      knowledgeTopics.find((topic) => topic.id === 'full-moon')!,
    )).toBe(true);
    expect(shouldShowKnowledgeContents(
      knowledgeTopics.find((topic) => topic.id === 'stellium')!,
    )).toBe(false);
    expect(encyclopedia).toContain('Разобраться глубже');
    expect(encyclopedia).toContain('Связанные понятия');
    expect(encyclopedia).toContain('Источники и определения');
    expect(encyclopedia).toContain('NATIVE_BACK_EVENT');
    expect(encyclopedia).toContain("const navigateBack = () => dispatch({ type: 'back' })");
    expect(encyclopedia).toContain('detail.handled = true');
  });

  it('returns a useful empty result and a safe result for an absent internal destination', () => {
    expect(searchKnowledgeTopics(topics, 'совершенно неизвестный термин')).toEqual([]);
    expect(getRelatedTopics(topics, 'missing-article')).toEqual([]);
  });

  it('links Full Moon to Lunar Eclipse and never links an article to itself', () => {
    const related = getRelatedTopics(topics, 'full-moon');
    expect(related.map((topic) => topic.id)).toContain('lunar-eclipse');
    expect(related.map((topic) => topic.id)).not.toContain('full-moon');
  });
});
