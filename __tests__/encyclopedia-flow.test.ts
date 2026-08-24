import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../lib/knowledgeEncyclopedia';

describe('knowledge encyclopedia flow', () => {
  it('opens on the complete catalog with the same articles in both supported languages', () => {
    const ruTopics = getEncyclopediaTopics('ru');
    const enTopics = getEncyclopediaTopics('en');

    expect(INITIAL_ENCYCLOPEDIA_SCREEN).toBe('catalog');
    expect(ruTopics.map((topic) => topic.id)).toEqual(enTopics.map((topic) => topic.id));
    expect(ruTopics).toHaveLength(100);
  });

  it('keeps the ordered categories and never links the active article to itself', () => {
    const topics = getEncyclopediaTopics('ru');
    const categories = groupTopicsByCategory(topics);
    const related = getRelatedTopics(topics, 'planet-mercury');

    expect(categories.map(([category]) => category)).toEqual([
      'С чего начать',
      'Знаки',
      'Планеты',
      'Дома',
      'Углы карты',
      'Аспекты',
      'Ретроградность',
      'Узлы и расчётные точки',
      'Как читать всё вместе',
      'Отношения и совместимость',
      'Прогнозы',
      'Луна и циклы',
    ]);
    expect(categories.map(([, articles]) => articles.length)).toEqual([8, 17, 12, 15, 5, 8, 5, 3, 6, 9, 4, 8]);
    expect(related).toHaveLength(3);
    expect(related.some((topic) => topic.id === 'planet-mercury')).toBe(false);
  });
});
