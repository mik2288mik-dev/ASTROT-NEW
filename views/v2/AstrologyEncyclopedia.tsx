import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { KnowledgeArticleIcon } from '../../components/icons/KnowledgeArticleIcon';
import {
  EditorialCurve,
  EditorialChartsButton,
} from '../../components/editorial/EditorialScreenChrome';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import {
  buildKnowledgeInlineLinkCandidates,
  getKnowledgeArticlePresentation,
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
  knowledgeLanguage,
  normalizeKnowledgeSearch,
  searchKnowledgeTopics,
  splitKnowledgeTextWithLinks,
  type KnowledgeCategoryId,
} from '../../lib/knowledge';

type EncyclopediaScreen = typeof INITIAL_ENCYCLOPEDIA_SCREEN | 'category' | 'article';
type EncyclopediaLocation =
  | { screen: typeof INITIAL_ENCYCLOPEDIA_SCREEN }
  | { screen: 'category'; categoryId: KnowledgeCategoryId }
  | { screen: 'article'; categoryId: KnowledgeCategoryId; topicId: string };

export type AstrologyEncyclopediaProps = {
  profile: UserProfile;
  onOpenCharts?: () => void;
  embedded?: boolean;
};

function russianMaterialCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} материалов`;
  if (last === 1) return `${count} материал`;
  if (last >= 2 && last <= 4) return `${count} материала`;
  return `${count} материалов`;
}

export function AstrologyEncyclopedia({
  profile,
  onOpenCharts,
  embedded = false,
}: AstrologyEncyclopediaProps) {
  const language = knowledgeLanguage(profile.language);
  const ru = language === 'ru';
  const topics = useMemo(() => getKnowledgeTopics(language), [language]);
  const topicGroups = useMemo(
    () => groupKnowledgeTopicsByCategory(topics, language),
    [language, topics],
  );
  const [screen, setScreen] = useState<EncyclopediaScreen>(INITIAL_ENCYCLOPEDIA_SCREEN);
  const [activeCategoryId, setActiveCategoryId] = useState<KnowledgeCategoryId>('start');
  const [activeTopicId, setActiveTopicId] = useState(topics[0]?.id || '');
  const [navigationTrail, setNavigationTrail] = useState<EncyclopediaLocation[]>([]);
  const [query, setQuery] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const categoryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const articleHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const activeCategory = topicGroups.find((group) => group.categoryId === activeCategoryId)
    || topicGroups[0];
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) || topics[0];
  const normalizedQuery = normalizeKnowledgeSearch(query);
  const filteredTopics = useMemo(() => searchKnowledgeTopics(topics, query), [query, topics]);
  const related = useMemo(
    () => activeTopic ? getRelatedKnowledgeTopics(topics, activeTopic) : [],
    [activeTopic, topics],
  );
  const inlineLinkCandidates = useMemo(
    () => activeTopic
      ? buildKnowledgeInlineLinkCandidates(topics, activeTopic.id)
      : [],
    [activeTopic, topics],
  );
  const articlePresentation = useMemo(
    () => activeTopic ? getKnowledgeArticlePresentation(activeTopic, language) : null,
    [activeTopic, language],
  );

  const focusContent = (target: React.RefObject<HTMLHeadingElement | null>) => {
    window.requestAnimationFrame(() => {
      const appScroll = contentRef.current?.closest<HTMLElement>('.lumia-main-scroll');
      if (appScroll) appScroll.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
      target.current?.focus({ preventScroll: true });
    });
  };

  const openCategory = (categoryId: KnowledgeCategoryId) => {
    setNavigationTrail((trail) => [...trail, { screen: INITIAL_ENCYCLOPEDIA_SCREEN }]);
    setActiveCategoryId(categoryId);
    setQuery('');
    setScreen('category');
    focusContent(categoryHeadingRef);
  };

  const openTopic = (topicId: string) => {
    const nextTopic = topics.find((topic) => topic.id === topicId);
    if (!nextTopic) return;
    const currentLocation: EncyclopediaLocation = screen === 'article'
      ? { screen: 'article', categoryId: activeCategoryId, topicId: activeTopicId }
      : screen === 'category'
        ? { screen: 'category', categoryId: activeCategoryId }
        : { screen: INITIAL_ENCYCLOPEDIA_SCREEN };
    setNavigationTrail((trail) => [...trail, currentLocation]);
    setActiveTopicId(topicId);
    setActiveCategoryId(nextTopic.category);
    setScreen('article');
    focusContent(articleHeadingRef);
  };

  const renderLinkedParagraph = (paragraph: string) => (
    splitKnowledgeTextWithLinks(paragraph, inlineLinkCandidates).map((segment, index) => (
      segment.kind === 'text' ? (
        <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>
      ) : (
        <a
          key={`link-${segment.topicId}-${index}`}
          className="encyclopedia-inline-link"
          href={`#knowledge-${segment.topicId}`}
          onClick={(event) => {
            event.preventDefault();
            openTopic(segment.topicId);
          }}
          aria-label={ru
            ? `${segment.text}. Открыть материал`
            : `${segment.text}. Open article`}
        >
          {segment.text}
        </a>
      )
    ))
  );

  const returnToCatalog = (clearSearch = false) => {
    if (clearSearch) setQuery('');
    setNavigationTrail([]);
    setScreen(INITIAL_ENCYCLOPEDIA_SCREEN);
    focusContent(catalogHeadingRef);
  };

  const navigateBack = () => {
    const previous = navigationTrail[navigationTrail.length - 1];
    if (!previous) {
      returnToCatalog();
      return;
    }
    setNavigationTrail((trail) => trail.slice(0, -1));
    if (previous.screen === 'article') {
      setActiveTopicId(previous.topicId);
      setActiveCategoryId(previous.categoryId);
      setScreen('article');
      focusContent(articleHeadingRef);
      return;
    }
    if (previous.screen === 'category') {
      setActiveCategoryId(previous.categoryId);
      setScreen('category');
      focusContent(categoryHeadingRef);
      return;
    }
    setScreen(INITIAL_ENCYCLOPEDIA_SCREEN);
    focusContent(catalogHeadingRef);
  };

  const headerBack: (() => void) | undefined = screen === INITIAL_ENCYCLOPEDIA_SCREEN
    ? undefined
    : navigateBack;
  const previousLocation = navigationTrail[navigationTrail.length - 1];
  const previousLabel = previousLocation?.screen === 'article'
    ? topics.find((topic) => topic.id === previousLocation.topicId)?.title
    : previousLocation?.screen === 'category'
      ? topicGroups.find((group) => group.categoryId === previousLocation.categoryId)?.label
      : normalizedQuery
        ? (ru ? 'Результаты поиска' : 'Search results')
        : (ru ? 'Все материалы' : 'All articles');

  useEffect(() => {
    if (!headerBack) return;
    const handleNativeBack = (event: Event) => {
      headerBack();
      (event as CustomEvent<NativeBackEventDetail>).detail.handled = true;
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  }, [headerBack]);

  if (!activeTopic || !activeCategory) {
    return (
      <div className={`fresh-page encyclopedia-editorial-page${embedded ? ' !min-h-0 !pt-0 !pb-0 before:!hidden' : ''}`}>
        {!embedded ? (
          <AppTopBar
            title={ru ? 'Хочу знать' : 'Learn'}
            rightAction={<EditorialChartsButton label={ru ? 'Открыть мои карты' : 'Open my charts'} onClick={onOpenCharts} />}
          />
        ) : null}
        <div className="encyclopedia-content encyclopedia-empty">
          <p>{ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}</p>
          <h1>{ru ? 'Материалов пока нет' : 'No articles yet'}</h1>
          <span>{ru ? 'Вернитесь позже — здесь появятся понятные объяснения.' : 'Come back later for clear explanations.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`fresh-page encyclopedia-editorial-page${embedded ? ' !min-h-0 !pt-0 !pb-0 before:!hidden' : ''}`}>
      {!embedded ? (
        <AppTopBar
          title={ru ? 'Хочу знать' : 'Learn'}
          onBack={headerBack}
          rightAction={<EditorialChartsButton label={ru ? 'Открыть мои карты' : 'Open my charts'} onClick={onOpenCharts} />}
        />
      ) : null}

      <div
        ref={contentRef}
        className={`encyclopedia-content${screen === 'article' ? ' encyclopedia-content--article' : ''}`}
      >
        {embedded && headerBack && screen !== 'article' ? (
          <button className="encyclopedia-return encyclopedia-return-top" type="button" onClick={headerBack}>
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
            <span>{previousLabel || (ru ? 'Все материалы' : 'All articles')}</span>
          </button>
        ) : null}
        {screen === INITIAL_ENCYCLOPEDIA_SCREEN ? (
          <>
            <header className="encyclopedia-catalog-heading">
              {!embedded ? <p>{ru ? 'Хочу знать' : 'Learn'}</p> : null}
              <h1 ref={catalogHeadingRef} tabIndex={-1}>
                {ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}
              </h1>
              <span>
                {ru
                  ? 'Понятные объяснения о знаках, планетах, домах, аспектах и прогнозах.'
                  : 'Clear explanations of signs, planets, houses, aspects, and forecasts.'}
              </span>
            </header>

            <div className="encyclopedia-search" role="search">
              <label htmlFor="knowledge-search">{ru ? 'Найти материал' : 'Find an article'}</label>
              <div>
                <Search aria-hidden="true" strokeWidth={1.6} />
                <input
                  id="knowledge-search"
                  name="knowledge-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={ru ? 'Например: асцендент, любовь, ретро' : 'For example: ascendant, love, retro'}
                  autoComplete="off"
                />
              </div>
            </div>

            {normalizedQuery ? (
              <section
                className="encyclopedia-search-results"
                aria-labelledby="knowledge-search-results"
                aria-live="polite"
              >
                <h2 id="knowledge-search-results">
                  {ru ? `Найдено: ${filteredTopics.length}` : `Found: ${filteredTopics.length}`}
                </h2>
                {filteredTopics.length ? (
                  <div className="encyclopedia-topic-list">
                    {filteredTopics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => openTopic(topic.id)}
                      >
                        <span>
                          <strong>{topic.title}</strong>
                          <small>{topic.categoryLabel} · {topic.summary}</small>
                        </span>
                        <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="encyclopedia-no-results">
                    {ru
                      ? `По запросу «${query.trim()}» ничего не найдено. Введите более короткое слово или другой термин.`
                      : `No articles found for “${query.trim()}”. Try a shorter or different term.`}
                  </p>
                )}
              </section>
            ) : (
              <nav
                className="encyclopedia-category-navigation"
                aria-label={ru ? 'Разделы энциклопедии' : 'Encyclopedia sections'}
              >
                {topicGroups.map((group) => (
                  <button
                    key={group.categoryId}
                    type="button"
                    onClick={() => openCategory(group.categoryId)}
                    aria-label={ru
                      ? `${group.label}: ${russianMaterialCount(group.topics.length)}`
                      : `${group.label}: ${group.topics.length} articles`}
                  >
                    <span className="encyclopedia-category-navigation-copy">
                      <strong>{group.label}</strong>
                      <small>{group.description}</small>
                    </span>
                    <span className="encyclopedia-category-navigation-meta" aria-hidden="true">
                      <small>{group.topics.length}</small>
                      <ChevronRight strokeWidth={1.5} />
                    </span>
                  </button>
                ))}
              </nav>
            )}
          </>
        ) : screen === 'category' ? (
          <section className="encyclopedia-category-view" aria-labelledby="encyclopedia-category-title">
            <header className="encyclopedia-category-heading">
              <p>{ru ? 'Раздел энциклопедии' : 'Encyclopedia section'}</p>
              <h1 id="encyclopedia-category-title" ref={categoryHeadingRef} tabIndex={-1}>
                {activeCategory.label}
              </h1>
              <span>{activeCategory.description}</span>
            </header>
            <div className="encyclopedia-topic-list">
              {activeCategory.topics.map((topic) => (
                <button key={topic.id} type="button" onClick={() => openTopic(topic.id)}>
                  <span>
                    <strong>{topic.title}</strong>
                    <small>{topic.summary}</small>
                  </span>
                  <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <header className="encyclopedia-article-intro">
              {embedded && headerBack ? (
                <button
                  className="encyclopedia-article-back"
                  type="button"
                  onClick={headerBack}
                  aria-label={ru
                    ? `Назад: ${previousLabel || 'Все материалы'}`
                    : `Back: ${previousLabel || 'All articles'}`}
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.45} />
                </button>
              ) : null}
              <p className="encyclopedia-subtitle">
                {ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}
              </p>
              <EditorialCurve className="encyclopedia-curve" />
            </header>

            <article className="encyclopedia-article" aria-labelledby={`knowledge-${activeTopic.id}`}>
              {articlePresentation ? (
                <div className="encyclopedia-article-symbol" aria-hidden="true">
                  <KnowledgeArticleIcon topicId={activeTopic.id} category={activeTopic.category} />
                </div>
              ) : null}
              <p className="encyclopedia-eyebrow">{activeTopic.categoryLabel}</p>
              <h1 id={`knowledge-${activeTopic.id}`} ref={articleHeadingRef} tabIndex={-1}>{activeTopic.title}</h1>
              {articlePresentation ? (
                <div className="encyclopedia-article-tags" aria-label={ru ? 'Темы материала' : 'Article topics'}>
                  <span>{articlePresentation.tag}</span>
                </div>
              ) : null}

              <div className="encyclopedia-copy">
                <p className="encyclopedia-copy-lead">{renderLinkedParagraph(activeTopic.summary)}</p>
                {activeTopic.sections.flatMap((section) => section.paragraphs).map((paragraph) => (
                  <p key={paragraph}>{renderLinkedParagraph(paragraph)}</p>
                ))}
              </div>

              <aside className="encyclopedia-simple" aria-labelledby="encyclopedia-simple-title">
                <h2 id="encyclopedia-simple-title">{ru ? 'Простыми словами' : 'In plain words'}</h2>
                <p>{activeTopic.shortAnswer}</p>
              </aside>

              {related.length ? (
                <section className="encyclopedia-related" aria-labelledby="encyclopedia-related-title">
                  <h2 id="encyclopedia-related-title">{ru ? 'Читайте также' : 'Read next'}</h2>
                  <div>
                    {related.map((topic) => (
                      <button key={topic.id} type="button" onClick={() => openTopic(topic.id)}>
                        <span>{topic.title}</span>
                        <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          </>
        )}
      </div>
    </div>
  );
}
