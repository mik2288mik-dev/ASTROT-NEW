import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import {
  buildKnowledgeInlineLinkCandidates,
  getKnowledgeSources,
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  INITIAL_KNOWLEDGE_NAVIGATION,
  knowledgeLanguage,
  knowledgeNavigationReducer,
  normalizeKnowledgeSearch,
  searchKnowledgeTopics,
  splitKnowledgeTextWithLinks,
  type KnowledgeArticleSection,
  type KnowledgeCategoryId,
} from '../../lib/knowledge';
import { KnowledgeDiagram } from './KnowledgeDiagram';
import styles from './AstrologyEncyclopedia.module.css';

export type AstrologyEncyclopediaProps = {
  profile: UserProfile;
  /** Kept for route compatibility; the library intentionally does not use personal chart data. */
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
  embedded = false,
}: AstrologyEncyclopediaProps) {
  const language = knowledgeLanguage(profile.language);
  const ru = language === 'ru';
  const topics = useMemo(() => getKnowledgeTopics(language), [language]);
  const topicGroups = useMemo(
    () => groupKnowledgeTopicsByCategory(topics, language),
    [language, topics],
  );
  const [navigation, dispatch] = useReducer(
    knowledgeNavigationReducer,
    INITIAL_KNOWLEDGE_NAVIGATION,
  );
  const [query, setQuery] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const categoryHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const articleHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const current = navigation.current;
  const normalizedQuery = normalizeKnowledgeSearch(query);
  const filteredTopics = useMemo(
    () => searchKnowledgeTopics(topics, query),
    [query, topics],
  );
  const activeCategory = current.screen === 'category'
    ? topicGroups.find((group) => group.categoryId === current.categoryId)
    : current.screen === 'article'
      ? topicGroups.find((group) => group.categoryId === current.categoryId)
      : undefined;
  const activeTopic = current.screen === 'article'
    ? topics.find((topic) => topic.id === current.topicId)
    : undefined;
  const related = useMemo(
    () => activeTopic ? getRelatedKnowledgeTopics(topics, activeTopic) : [],
    [activeTopic, topics],
  );
  const inlineLinkCandidates = useMemo(
    () => activeTopic ? buildKnowledgeInlineLinkCandidates(topics, activeTopic.id) : [],
    [activeTopic, topics],
  );
  const sources = useMemo(
    () => activeTopic ? getKnowledgeSources(activeTopic.sourceIds, language) : [],
    [activeTopic, language],
  );

  const openCategory = (categoryId: KnowledgeCategoryId) => {
    setQuery('');
    dispatch({ type: 'open-category', categoryId });
  };

  const openTopic = (topicId: string) => {
    const nextTopic = topics.find((topic) => topic.id === topicId);
    if (!nextTopic) return false;
    dispatch({ type: 'open-article', categoryId: nextTopic.category, topicId });
    return true;
  };

  const navigateBack = () => dispatch({ type: 'back' });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const appScroll = contentRef.current?.closest<HTMLElement>('.lumia-main-scroll');
      if (appScroll) appScroll.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
      const heading = current.screen === 'article'
        ? articleHeadingRef.current
        : current.screen === 'category'
          ? categoryHeadingRef.current
          : catalogHeadingRef.current;
      heading?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current]);

  useEffect(() => {
    if (current.screen === 'catalog') return;
    const handleNativeBack = (event: Event) => {
      dispatch({ type: 'back' });
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail) detail.handled = true;
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  }, [current.screen]);

  const renderLinkedParagraph = (paragraph: string) => (
    splitKnowledgeTextWithLinks(paragraph, inlineLinkCandidates).map((segment, index) => (
      segment.kind === 'text' ? (
        <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>
      ) : (
        <a
          key={`link-${segment.topicId}-${index}`}
          className={styles.inlineLink}
          href={`#knowledge-${segment.topicId}`}
          onClick={(event) => {
            event.preventDefault();
            openTopic(segment.topicId);
          }}
        >
          {segment.text}
        </a>
      )
    ))
  );

  const renderArticleSection = (section: KnowledgeArticleSection, index: number) => {
    const sectionClassName = [
      styles.articleSection,
      section.kind === 'astrology' ? styles.sectionAstrology : '',
      section.kind === 'confusion' ? styles.sectionConfusion : '',
    ].filter(Boolean).join(' ');
    return (
      <section className={sectionClassName} key={`${section.title}-${index}`}>
        <h2>{section.title}</h2>
        {section.paragraphs.map((paragraph, paragraphIndex) => (
          <p key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>
            {renderLinkedParagraph(paragraph)}
          </p>
        ))}
      </section>
    );
  };

  const previous = navigation.history[navigation.history.length - 1];
  const previousLabel = previous?.screen === 'article'
    ? topics.find((topic) => topic.id === previous.topicId)?.title
    : previous?.screen === 'category'
      ? topicGroups.find((group) => group.categoryId === previous.categoryId)?.label
      : ru ? 'Все разделы' : 'All sections';
  const headerBack = current.screen === 'catalog' ? undefined : navigateBack;

  if (!topics.length) {
    return (
      <div className={`fresh-page encyclopedia-editorial-page ${styles.page}`}>
        {!embedded ? <AppTopBar title={ru ? 'Энциклопедия' : 'Encyclopedia'} /> : null}
        <div className={`${styles.content} ${styles.empty}`}>
          <h1>{ru ? 'Материалов пока нет' : 'No articles yet'}</h1>
          <p>{ru ? 'Здесь появятся понятные объяснения терминов.' : 'Clear explanations will appear here.'}</p>
        </div>
      </div>
    );
  }

  const coreSections = activeTopic?.sections.filter((section) => section.depth !== 'deep') || [];
  const deepSections = activeTopic?.sections.filter((section) => section.depth === 'deep') || [];

  return (
    <div className={`fresh-page encyclopedia-editorial-page ${styles.page}${embedded ? ' !min-h-0 !pt-0 !pb-0 before:!hidden' : ''}`}>
      {!embedded ? (
        <AppTopBar
          title={ru ? 'Энциклопедия' : 'Encyclopedia'}
          onBack={headerBack}
        />
      ) : null}

      <div ref={contentRef} className={styles.content}>
        {embedded && headerBack ? (
          <button className={styles.backButton} type="button" onClick={headerBack}>
            <ChevronLeft aria-hidden="true" strokeWidth={1.7} />
            <span>{previousLabel}</span>
          </button>
        ) : null}

        {current.screen === 'catalog' ? (
          <>
            <header className={styles.catalogHeader}>
              <h1 ref={catalogHeadingRef} tabIndex={-1}>{ru ? 'Энциклопедия' : 'Encyclopedia'}</h1>
              <p>
                {ru
                  ? 'Астрология простыми словами. Что это, как работает и почему так называется.'
                  : 'Astrology in plain language: what terms mean, how they work, and why they have those names.'}
              </p>
            </header>

            <div className={styles.search} role="search">
              <label htmlFor="knowledge-search">{ru ? 'Что хотите понять?' : 'What do you want to understand?'}</label>
              <div className={styles.searchControl}>
                <Search aria-hidden="true" strokeWidth={1.7} />
                <input
                  id="knowledge-search"
                  name="knowledge-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={ru
                    ? 'Асцендент, полнолуние, дома, ретроградный Меркурий…'
                    : 'Ascendant, full moon, houses, Mercury retrograde…'}
                  autoComplete="off"
                />
              </div>
            </div>

            {normalizedQuery ? (
              <section className={styles.searchResults} aria-live="polite" aria-labelledby="knowledge-search-results">
                <div className={styles.searchResultsHeader}>
                  <h2 id="knowledge-search-results">
                    {ru ? `Найдено: ${filteredTopics.length}` : `Found: ${filteredTopics.length}`}
                  </h2>
                  <button className={styles.clearButton} type="button" onClick={() => setQuery('')}>
                    {ru ? 'Очистить поиск' : 'Clear search'}
                  </button>
                </div>
                {filteredTopics.length ? (
                  <ul className={styles.topicList} role="list">
                    {filteredTopics.map((topic) => (
                      <li key={topic.id}>
                        <button className={styles.topicButton} type="button" onClick={() => openTopic(topic.id)}>
                          <span className={styles.topicCopy}>
                            <strong>{topic.title}</strong>
                            <small>{topic.categoryLabel} · {topic.summary}</small>
                          </span>
                          <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.noResults}>
                    <p>
                      {ru
                        ? `По запросу «${query.trim()}» ничего не найдено. Попробуйте более короткое слово или другое название.`
                        : `No results for “${query.trim()}”. Try a shorter word or another name.`}
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <section aria-labelledby="knowledge-categories-title">
                <h2 className={styles.sectionTitle} id="knowledge-categories-title">
                  {ru ? 'Разделы' : 'Sections'}
                </h2>
                <ul className={styles.categoryList} role="list">
                  {topicGroups.map((group) => (
                    <li key={group.categoryId}>
                      <button
                        className={styles.categoryButton}
                        type="button"
                        onClick={() => openCategory(group.categoryId)}
                        aria-label={ru
                          ? `${group.label}: ${russianMaterialCount(group.topics.length)}`
                          : `${group.label}: ${group.topics.length} articles`}
                      >
                        <span className={styles.categoryCopy}>
                          <strong>{group.label}</strong>
                          <small>{group.description}</small>
                        </span>
                        <span className={styles.categoryMeta} aria-hidden="true">
                          <small>{group.topics.length}</small>
                          <ChevronRight strokeWidth={1.6} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : current.screen === 'category' && activeCategory ? (
          <section className={styles.categoryView} aria-labelledby="encyclopedia-category-title">
            <header className={styles.categoryHeader}>
              <h1 id="encyclopedia-category-title" ref={categoryHeadingRef} tabIndex={-1}>
                {activeCategory.label}
              </h1>
              <p>{activeCategory.description}</p>
            </header>
            <ul className={styles.topicList} role="list">
              {activeCategory.topics.map((topic) => (
                <li key={topic.id}>
                  <button className={styles.topicButton} type="button" onClick={() => openTopic(topic.id)}>
                    <span className={styles.topicCopy}>
                      <strong>{topic.title}</strong>
                      <small>{topic.summary}</small>
                    </span>
                    <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : activeTopic ? (
          <article className={styles.article} aria-labelledby={`knowledge-${activeTopic.id}`}>
            <header className={styles.articleHeader}>
              <p className={styles.eyebrow}>{activeTopic.categoryLabel}</p>
              <h1 id={`knowledge-${activeTopic.id}`} ref={articleHeadingRef} tabIndex={-1}>
                {activeTopic.title}
              </h1>
              <p className={styles.lead}>{renderLinkedParagraph(activeTopic.summary)}</p>
            </header>

            <aside className={styles.shortAnswer} aria-label={ru ? 'Короткий ответ' : 'Short answer'}>
              <strong>{ru ? 'Если совсем коротко' : 'In one sentence'}</strong>
              <p>{activeTopic.shortAnswer}</p>
            </aside>

            {activeTopic.diagram ? <KnowledgeDiagram diagram={activeTopic.diagram} language={language} /> : null}

            <div className={styles.articleSections}>
              {coreSections.map(renderArticleSection)}
            </div>

            {deepSections.length ? (
              <details className={styles.deepDisclosure}>
                <summary>{ru ? 'Разобраться глубже' : 'Go deeper'}</summary>
                <div className={styles.deepSections}>
                  {deepSections.map(renderArticleSection)}
                </div>
              </details>
            ) : null}

            {related.length ? (
              <section className={styles.related} aria-labelledby="encyclopedia-related-title">
                <h2 id="encyclopedia-related-title">{ru ? 'Связанные понятия' : 'Related concepts'}</h2>
                <ul className={styles.relatedList} role="list">
                  {related.map((topic) => (
                    <li key={topic.id}>
                      <button className={styles.relatedButton} type="button" onClick={() => openTopic(topic.id)}>
                        <span>{topic.title}</span>
                        <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {sources.length ? (
              <details className={styles.sources}>
                <summary>{ru ? 'Источники и определения' : 'Sources and definitions'}</summary>
                <ul className={styles.sourceList} role="list">
                  {sources.map((source) => (
                    <li key={source.id}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <strong>{source.localizedTitle}</strong>
                        <small>{source.publisher}</small>
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <footer className={styles.articleFooter}>
              <button className={styles.backButton} type="button" onClick={navigateBack}>
                <ChevronLeft aria-hidden="true" strokeWidth={1.7} />
                <span>{ru ? `Назад: ${previousLabel}` : `Back: ${previousLabel}`}</span>
              </button>
            </footer>
          </article>
        ) : (
          <div className={styles.empty}>
            <h1>{ru ? 'Материал не найден' : 'Article not found'}</h1>
            <p>{ru ? 'Вернитесь к разделам и выберите другой материал.' : 'Return to the sections and choose another article.'}</p>
            <button className={styles.backButton} type="button" onClick={() => dispatch({ type: 'catalog' })}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.7} />
              <span>{ru ? 'К разделам' : 'All sections'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
