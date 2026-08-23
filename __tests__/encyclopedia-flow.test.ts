import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../lib/knowledgeEncyclopedia';

describe('knowledge encyclopedia flow', () => {
  it('opens on the catalog with the same articles in both supported languages', () => {
    const ruTopics = getEncyclopediaTopics('ru');
    const enTopics = getEncyclopediaTopics('en');

    expect(INITIAL_ENCYCLOPEDIA_SCREEN).toBe('catalog');
    expect(ruTopics.map((topic) => topic.id)).toEqual(enTopics.map((topic) => topic.id));
    expect(ruTopics).toHaveLength(4);
  });

  it('keeps compact categories and never links the active article to itself', () => {
    const topics = getEncyclopediaTopics('ru');
    const categories = groupTopicsByCategory(topics);
    const related = getRelatedTopics(topics, 'mercury-retrograde');

    expect(categories.map(([category]) => category)).toEqual(['Ретроградный Меркурий', 'Натальная карта']);
    expect(categories.map(([, articles]) => articles.length)).toEqual([2, 2]);
    expect(related).toHaveLength(3);
    expect(related.some((topic) => topic.id === 'mercury-retrograde')).toBe(false);
  });
});
