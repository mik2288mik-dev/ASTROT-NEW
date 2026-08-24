import fs from 'fs';
import path from 'path';
import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../lib/knowledgeEncyclopedia';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('knowledge encyclopedia flow', () => {
  it('keeps the complete catalog and the requested beginner categories', () => {
    const ruTopics = getEncyclopediaTopics('ru');
    const enTopics = getEncyclopediaTopics('en');
    const categories = groupTopicsByCategory(ruTopics);

    expect(INITIAL_ENCYCLOPEDIA_SCREEN).toBe('catalog');
    expect(ruTopics.map((topic) => topic.id)).toEqual(enTopics.map((topic) => topic.id));
    expect(ruTopics).toHaveLength(100);
    expect(categories.map(([category]) => category)).toEqual([
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
    expect(categories.map(([, articles]) => articles.length)).toEqual([8, 17, 12, 15, 5, 8, 5, 3, 6, 9, 4, 8]);
  });

  it('keeps standalone «Хочу знать» and reuses it inside the service screen', () => {
    const app = read('App.tsx');
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const services = read('views/v2/ServiceScreen.tsx');

    expect(app).toContain("view === 'encyclopedia'");
    expect(app).toContain("view === 'services'");
    expect(app).toContain('<AstrologyEncyclopedia');
    expect(app).not.toContain('<MoreHub');
    expect(encyclopedia).toContain("title={ru ? 'Хочу знать' : 'Learn'}");
    expect(encyclopedia).toContain('<AppTopBar');
    expect(encyclopedia).not.toContain('<EditorialTabs');
    expect(services).toContain('<AstrologyEncyclopedia');
    expect(services).toContain('embedded');
    expect(services).toContain('<EditorialTabs');
    expect(services).not.toContain('MoreHub');
  });

  it('keeps natal calculations and personal actions outside the encyclopedia', () => {
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const app = read('App.tsx');
    const knowledgeIndex = read('lib/knowledge/index.ts');

    [
      'primaryChartData',
      'personalReliability',
      'resolvePersonalKnowledge',
      'PersonalKnowledgeAccordion',
      'onAskAboutSelf',
      'onSpecifyBirthTime',
      'Что это значит в моей карте?',
      'Указать время рождения',
      'Спросить о себе',
    ].forEach((fragment) => expect(encyclopedia).not.toContain(fragment));
    expect(app).not.toContain('primaryKnowledgeChart');
    expect(app).not.toContain('openKnowledgeQuestion');
    expect(knowledgeIndex).not.toContain('personalKnowledge');
    expect(fs.existsSync(path.join(ROOT, 'lib/knowledge/personalKnowledge.ts'))).toBe(false);
  });

  it('shows category navigation first and restores the original encyclopedia article hierarchy', () => {
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');
    const articleIcon = read('components/icons/KnowledgeArticleIcon.tsx');

    expect(encyclopedia).toContain("type EncyclopediaScreen = typeof INITIAL_ENCYCLOPEDIA_SCREEN | 'category' | 'article'");
    expect(encyclopedia).toContain('className="encyclopedia-category-navigation"');
    expect(encyclopedia).toContain('aria-live="polite"');
    expect(encyclopedia).toContain('topicGroups.map((group)');
    expect(encyclopedia).not.toContain('group.topics.map');
    expect(encyclopedia).toContain('activeCategory.topics.map((topic)');

    const articleStart = encyclopedia.indexOf('<header className="encyclopedia-article-intro"');
    const article = encyclopedia.slice(articleStart);
    const hierarchy = [
      'encyclopedia-subtitle',
      '<EditorialCurve className="encyclopedia-curve"',
      '<article className="encyclopedia-article"',
      'encyclopedia-article-symbol',
      '<p className="encyclopedia-eyebrow"',
      '<h1 id={`knowledge-${activeTopic.id}`}',
      'encyclopedia-article-tags',
      'encyclopedia-copy',
      'encyclopedia-copy-lead',
      'encyclopedia-simple',
      'Простыми словами',
      'encyclopedia-related',
      'Читайте также',
    ].map((fragment) => article.indexOf(fragment));
    expect(hierarchy.every((index) => index >= 0)).toBe(true);
    expect([...hierarchy].sort((a, b) => a - b)).toEqual(hierarchy);
    expect(article).toContain('activeTopic.sections.flatMap((section) => section.paragraphs)');
    expect(article).toContain('<KnowledgeArticleIcon');
    expect(article).not.toContain('articlePresentation.symbol');
    expect(articleIcon).toContain('<ZodiacIcon');
    expect(articleIcon).toContain('<PlanetIcon');
    expect(articleIcon).toContain('<AstroTechnicalIcon');
    expect(article).not.toContain('<h2>{section.title}</h2>');
    expect(article).not.toContain('Sparkles');
  });

  it('handles Android Back inside an article or category before leaving Knowledge', () => {
    const encyclopedia = read('views/v2/AstrologyEncyclopedia.tsx');

    expect(encyclopedia).toContain('NATIVE_BACK_EVENT');
    expect(encyclopedia).toContain('if (!headerBack) return');
    expect(encyclopedia).toContain('headerBack();');
    expect(encyclopedia).toContain('detail.handled = true');
    expect(encyclopedia).toContain('navigationTrail[navigationTrail.length - 1]');
    expect(encyclopedia).toContain("previous.screen === 'article'");
  });

  it('keeps explicit related links and never links an article to itself', () => {
    const topics = getEncyclopediaTopics('ru');
    const related = getRelatedTopics(topics, 'planet-mercury');

    expect(related).toHaveLength(3);
    expect(related.some((topic) => topic.id === 'planet-mercury')).toBe(false);
  });
});
