import fs from 'fs';
import path from 'path';
import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../lib/knowledgeEncyclopedia';
import {
  INITIAL_KNOWLEDGE_NAVIGATION,
  knowledgeNavigationReducer,
  searchKnowledgeTopics,
} from '../lib/knowledge';
import {
  ENCYCLOPEDIA_HUBS,
  POPULAR_KNOWLEDGE_TOPICS,
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
    expect(encyclopedia).toContain('Часто ищут');
    expect(encyclopedia).toContain('Разобраться по теме');
    expect(encyclopedia).not.toContain('russianMaterialCount');
    expect(encyclopedia).not.toContain('categoryMeta');
  });

  it('returns from an article to its human section and then to the catalog', () => {
    let state = knowledgeNavigationReducer(INITIAL_KNOWLEDGE_NAVIGATION, {
      type: 'open-hub', hubId: 'moon-sky',
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-article', categoryId: 'moon-cycles', topicId: 'full-moon',
    });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({ screen: 'hub', hubId: 'moon-sky' });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state).toEqual(INITIAL_KNOWLEDGE_NAVIGATION);
  });

  it('opens an article, follows an internal link, and restores both steps with Back', () => {
    let state = knowledgeNavigationReducer(INITIAL_KNOWLEDGE_NAVIGATION, {
      type: 'open-article', categoryId: 'moon-cycles', topicId: 'full-moon',
    });
    state = knowledgeNavigationReducer(state, {
      type: 'open-article', categoryId: 'moon-cycles', topicId: 'lunar-eclipse',
    });
    expect(state.current).toEqual({
      screen: 'article', categoryId: 'moon-cycles', topicId: 'lunar-eclipse',
    });

    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state.current).toEqual({
      screen: 'article', categoryId: 'moon-cycles', topicId: 'full-moon',
    });
    state = knowledgeNavigationReducer(state, { type: 'back' });
    expect(state).toEqual(INITIAL_KNOWLEDGE_NAVIGATION);
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

    expect(encyclopedia).toContain('Что хотите понять?');
    expect(encyclopedia).toContain("activeTopic?.sections.filter((section) => section.depth !== 'deep')");
    expect(encyclopedia).toContain('renderArticleSection');
    expect(encyclopedia).toContain('Разобраться глубже');
    expect(encyclopedia).toContain('Связанные понятия');
    expect(encyclopedia).toContain('Источники и определения');
    expect(encyclopedia).toContain('NATIVE_BACK_EVENT');
    expect(encyclopedia).toContain("dispatch({ type: 'back' })");
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
