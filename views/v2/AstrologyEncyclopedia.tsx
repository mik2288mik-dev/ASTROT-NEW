import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import {
  buildKnowledgeInlineLinkCandidates,
  getKnowledgeInlineTargetIds,
  getKnowledgeSources,
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  INITIAL_KNOWLEDGE_NAVIGATION,
  knowledgeLanguage,
  knowledgeNavigationReducer,
  normalizeKnowledgeSearch,
  searchKnowledgeTopics,
  splitKnowledgeBlockWithLinks,
  type KnowledgeArticleSection,
  type KnowledgeCategoryId,
  type KnowledgeDiagramId,
  type KnowledgeHubId,
  type KnowledgeInlineTextSegment,
} from '../../lib/knowledge';
import { KnowledgeDiagram } from './KnowledgeDiagram';
import { hasKnowledgeArticleVisual, KnowledgeArticleVisual } from './KnowledgeArticleVisual';
import {
  ENCYCLOPEDIA_HUBS,
  getEncyclopediaCategoryGroups,
  getEncyclopediaHub,
  HUB_BRANCH_PREVIEW_TOPIC_IDS,
  POPULAR_KNOWLEDGE_TOPICS,
  shouldShowKnowledgeContents,
} from './encyclopediaPresentation';
import styles from './AstrologyEncyclopedia.module.css';

export type AstrologyEncyclopediaProps = {
  profile: UserProfile;
  /** Kept for route compatibility; the library intentionally does not use personal chart data. */
  onOpenCharts?: () => void;
  embedded?: boolean;
};

const CATEGORY_DIAGRAMS: Partial<Record<KnowledgeCategoryId, KnowledgeDiagramId>> = {
  signs: 'zodiac-wheel',
  houses: 'houses',
  aspects: 'aspects',
  retrogrades: 'retrograde-motion',
  'nodes-points': 'lunar-nodes',
  'moon-cycles': 'moon-phases',
};

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
  const hubHeadingRef = useRef<HTMLHeadingElement | null>(null);
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
  const activeHub = current.screen === 'hub' ? getEncyclopediaHub(current.hubId) : undefined;
  const activeHubGroups = activeHub
    ? topicGroups.filter((group) => activeHub.categoryIds.includes(group.categoryId))
    : [];
  const activeHubFeaturedTopics = activeHub?.featuredTopicIds
    ?.flatMap((topicId) => {
      const topic = topics.find((candidate) => candidate.id === topicId);
      return topic ? [topic] : [];
    }) || [];
  const popularTopics = POPULAR_KNOWLEDGE_TOPICS.flatMap((popular) => {
    const topic = topics.find((candidate) => candidate.id === popular.topicId);
    return topic ? [{ topic, label: popular.label[language] }] : [];
  });
  const activeTopic = current.screen === 'article'
    ? topics.find((topic) => topic.id === current.topicId)
    : undefined;
  const activeDiagram = activeTopic
    ? activeTopic.diagram || (!hasKnowledgeArticleVisual(activeTopic.id) ? CATEGORY_DIAGRAMS[activeTopic.category] : undefined)
    : undefined;
  const activeCategoryGroups = useMemo(
    () => activeCategory
      ? getEncyclopediaCategoryGroups(activeCategory.categoryId, activeCategory.topics, language)
      : [],
    [activeCategory, language],
  );
  const related = useMemo(
    () => activeTopic ? getRelatedKnowledgeTopics(topics, activeTopic) : [],
    [activeTopic, topics],
  );
  const inlineLinkCandidates = useMemo(
    () => activeTopic
      ? buildKnowledgeInlineLinkCandidates(
        topics,
        activeTopic.id,
        getKnowledgeInlineTargetIds(activeTopic),
      )
      : [],
    [activeTopic, topics],
  );
  const linkedArticleContent = useMemo(() => activeTopic ? {
    summary: splitKnowledgeBlockWithLinks(
      [activeTopic.summary],
      inlineLinkCandidates,
      1,
    )[0] || [{ kind: 'text' as const, text: activeTopic.summary }],
    sections: activeTopic.sections.map((section) => (
      splitKnowledgeBlockWithLinks(section.paragraphs, inlineLinkCandidates)
    )),
  } : null, [activeTopic, inlineLinkCandidates]);
  const inlinePreviewTopic = navigation.inlinePreview
    ? topics.find((topic) => topic.id === navigation.inlinePreview?.targetTopicId)
    : undefined;
  const restoredInlineTriggerId = navigation.restoreScrollTop !== null
    ? navigation.inlinePreview?.triggerId
    : undefined;
  const sources = useMemo(
    () => activeTopic ? getKnowledgeSources(activeTopic.sourceIds, language) : [],
    [activeTopic, language],
  );

  const getCurrentScrollTop = () => {
    const appScroll = contentRef.current?.closest<HTMLElement>('.lumia-main-scroll');
    return Math.max(appScroll?.scrollTop || 0, window.scrollY);
  };

  const openHub = (hubId: KnowledgeHubId) => {
    setQuery('');
    const hub = getEncyclopediaHub(hubId);
    const [onlyCategoryId] = hub?.categoryIds || [];
    if (hub?.categoryIds.length === 1 && onlyCategoryId) {
      dispatch({
        type: 'open-category',
        categoryId: onlyCategoryId,
        scrollTop: getCurrentScrollTop(),
      });
      return;
    }
    dispatch({ type: 'open-hub', hubId, scrollTop: getCurrentScrollTop() });
  };

  const openCategory = (categoryId: KnowledgeCategoryId) => {
    dispatch({ type: 'open-category', categoryId, scrollTop: getCurrentScrollTop() });
  };

  const getBranchPreview = (categoryId: KnowledgeCategoryId) => (
    HUB_BRANCH_PREVIEW_TOPIC_IDS[categoryId]
      .flatMap((topicId) => {
        const topic = topics.find((candidate) => candidate.id === topicId);
        return topic ? [topic.title] : [];
      })
      .join(' · ')
  );

  const openTopic = (topicId: string) => {
    const nextTopic = topics.find((topic) => topic.id === topicId);
    if (!nextTopic) return false;
    dispatch({
      type: 'open-article',
      categoryId: nextTopic.category,
      topicId,
      scrollTop: getCurrentScrollTop(),
    });
    return true;
  };

  const navigateBack = () => dispatch({ type: 'back' });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const appScroll = contentRef.current?.closest<HTMLElement>('.lumia-main-scroll');
      const scrollTop = navigation.restoreScrollTop ?? 0;
      if (appScroll) appScroll.scrollTo({ top: scrollTop, behavior: 'auto' });
      window.scrollTo({ top: scrollTop, behavior: 'auto' });
      if (navigation.restoreScrollTop !== null) {
        if (restoredInlineTriggerId) {
          document.getElementById(restoredInlineTriggerId)?.focus({ preventScroll: true });
        }
        return;
      }
      const heading = current.screen === 'article'
        ? articleHeadingRef.current
        : current.screen === 'hub'
          ? hubHeadingRef.current
          : current.screen === 'category'
            ? categoryHeadingRef.current
            : catalogHeadingRef.current;
      heading?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current, navigation.restoreScrollTop, restoredInlineTriggerId]);

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

  const closeInlinePreview = () => {
    const triggerId = navigation.inlinePreview?.triggerId;
    dispatch({ type: 'close-inline-preview' });
    if (triggerId) {
      window.requestAnimationFrame(() => {
        document.getElementById(triggerId)?.focus({ preventScroll: true });
      });
    }
  };

  const renderInlinePreview = (blockId: string) => {
    if (!navigation.inlinePreview || navigation.inlinePreview.blockId !== blockId) return null;
    if (!inlinePreviewTopic) return null;
    const previewId = `knowledge-preview-${blockId}`;
    const headingId = `${previewId}-title`;
    return (
      <aside className={styles.inlinePreview} id={previewId} aria-labelledby={headingId}>
        <div className={styles.inlinePreviewHeader}>
          <p>{inlinePreviewTopic.categoryLabel}</p>
          <button
            className={styles.inlinePreviewClose}
            type="button"
            aria-label={ru ? 'Закрыть определение' : 'Close definition'}
            onClick={closeInlinePreview}
          >
            <X aria-hidden="true" strokeWidth={1.7} />
          </button>
        </div>
        <h2 id={headingId}>{inlinePreviewTopic.title}</h2>
        <p>{inlinePreviewTopic.shortAnswer}</p>
        <button
          className={styles.inlinePreviewAction}
          type="button"
          onClick={() => openTopic(inlinePreviewTopic.id)}
        >
          <span>{ru ? 'Открыть статью' : 'Open article'}</span>
          <ChevronRight aria-hidden="true" strokeWidth={1.6} />
        </button>
      </aside>
    );
  };

  const renderLinkedSegments = (
    segments: readonly KnowledgeInlineTextSegment[],
    blockId: string,
  ) => (
    segments.map((segment, index) => {
      if (segment.kind === 'text') {
        return <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>;
      }
      const isExpanded = navigation.inlinePreview?.blockId === blockId
        && navigation.inlinePreview.targetTopicId === segment.topicId;
      return (
        <button
          key={`link-${segment.topicId}-${index}`}
          id={`knowledge-link-${blockId}-${segment.topicId}-${index}`}
          className={styles.inlineLink}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? `knowledge-preview-${blockId}` : undefined}
          onClick={() => {
            const triggerId = `knowledge-link-${blockId}-${segment.topicId}-${index}`;
            if (
              navigation.inlinePreview?.blockId === blockId
              && navigation.inlinePreview.targetTopicId === segment.topicId
            ) {
              closeInlinePreview();
              return;
            }
            dispatch({
              type: 'show-inline-preview',
              preview: { targetTopicId: segment.topicId, blockId, triggerId },
            });
          }}
        >
          {segment.text}
        </button>
      );
    })
  );

  const renderArticleSection = ({
    section,
    index,
  }: { section: KnowledgeArticleSection; index: number }) => {
    const sectionClassName = [
      styles.articleSection,
      section.kind === 'astrology' ? styles.sectionAstrology : '',
      section.kind === 'confusion' ? styles.sectionConfusion : '',
    ].filter(Boolean).join(' ');
    return (
      <section
        className={sectionClassName}
        id={`knowledge-section-${activeTopic?.id}-${index}`}
        key={`${section.title}-${index}`}
      >
        <h2>{section.title}</h2>
        {section.paragraphs.map((paragraph, paragraphIndex) => (
          <React.Fragment key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>
            <p>
              {renderLinkedSegments(
                linkedArticleContent?.sections[index]?.[paragraphIndex]
                  || [{ kind: 'text', text: paragraph }],
                `${activeTopic?.id}-section-${index}-paragraph-${paragraphIndex}`,
              )}
            </p>
            {renderInlinePreview(`${activeTopic?.id}-section-${index}-paragraph-${paragraphIndex}`)}
          </React.Fragment>
        ))}
      </section>
    );
  };

  const previous = navigation.history[navigation.history.length - 1];
  const previousLocation = previous?.location;
  const previousLabel = previousLocation?.screen === 'article'
    ? topics.find((topic) => topic.id === previousLocation.topicId)?.title
    : previousLocation?.screen === 'hub'
      ? getEncyclopediaHub(previousLocation.hubId)?.title[language]
      : previousLocation?.screen === 'category'
        ? topicGroups.find((group) => group.categoryId === previousLocation.categoryId)?.label
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

  const indexedSections = activeTopic?.sections.map((section, index) => ({ section, index })) || [];
  const coreSections = indexedSections.filter(({ section }) => section.depth !== 'deep');
  const deepSections = indexedSections.filter(({ section }) => section.depth === 'deep');
  const showArticleContents = activeTopic ? shouldShowKnowledgeContents(activeTopic) : false;

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
              <h1 className={styles.visuallyHidden} ref={catalogHeadingRef} tabIndex={-1}>
                {ru ? 'Энциклопедия' : 'Encyclopedia'}
              </h1>
              <p>
                {ru
                  ? 'Астрология простыми словами.'
                  : 'Astrology in plain language.'}
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
              <>
                <section className={styles.popular} aria-labelledby="knowledge-popular-title">
                  <h2 id="knowledge-popular-title">{ru ? 'Часто ищут' : 'Popular topics'}</h2>
                  <ul className={styles.popularList} role="list">
                    {popularTopics.map(({ topic, label }) => (
                      <li key={topic.id}>
                        <button
                          className={styles.popularButton}
                          type="button"
                          onClick={() => openTopic(topic.id)}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section aria-labelledby="knowledge-directions-title">
                  <h2 className={styles.sectionTitle} id="knowledge-directions-title">
                    {ru ? 'Разобраться по теме' : 'Browse by topic'}
                  </h2>
                  <ul className={styles.hubGrid} role="list">
                    {ENCYCLOPEDIA_HUBS.map((hub) => (
                      <li key={hub.id}>
                        <button
                          className={styles.hubCard}
                          data-hub={hub.id}
                          type="button"
                          onClick={() => openHub(hub.id)}
                        >
                          <strong>{hub.title[language]}</strong>
                          <small>{hub.preview[language]}</small>
                          <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        ) : current.screen === 'hub' && activeHub ? (
          <section className={styles.hubView} aria-labelledby="encyclopedia-hub-title">
            <header className={styles.hubHeader}>
              <h1 id="encyclopedia-hub-title" ref={hubHeadingRef} tabIndex={-1}>
                {activeHub.title[language]}
              </h1>
              <p>{activeHub.preview[language]}</p>
            </header>
            <section className={styles.hubBranches} aria-labelledby="encyclopedia-hub-branches-title">
              <h2 className={styles.hubBranchHeading} id="encyclopedia-hub-branches-title">
                {ru ? 'Выберите подраздел' : 'Choose a section'}
              </h2>
              <ul className={styles.hubBranchList} role="list">
                {activeHubGroups.map((group) => (
                  <li key={group.categoryId}>
                    <button
                      className={styles.hubBranchButton}
                      type="button"
                      onClick={() => openCategory(group.categoryId)}
                    >
                      <span className={styles.hubBranchCopy}>
                        <strong>{group.label}</strong>
                        <small>{group.description}</small>
                        <span className={styles.hubBranchExamples}>{getBranchPreview(group.categoryId)}</span>
                      </span>
                      <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
                {activeHubFeaturedTopics.map((topic) => (
                  <li key={topic.id}>
                    <button
                      className={styles.hubBranchButton}
                      type="button"
                      onClick={() => openTopic(topic.id)}
                    >
                      <span className={styles.hubBranchCopy}>
                        <strong>{topic.title}</strong>
                        <small>{topic.summary}</small>
                      </span>
                      <ChevronRight aria-hidden="true" strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        ) : current.screen === 'category' && activeCategory ? (
          <section className={styles.categoryView} aria-labelledby="encyclopedia-category-title">
            <header className={styles.categoryHeader}>
              <h1 id="encyclopedia-category-title" ref={categoryHeadingRef} tabIndex={-1}>
                {activeCategory.label}
              </h1>
              <p>{activeCategory.description}</p>
            </header>
            <div className={styles.categoryGroups}>
              {activeCategoryGroups.map((group) => (
                <section className={styles.categoryGroup} key={group.id}>
                  {group.title ? <h2>{group.title}</h2> : null}
                  <ul className={styles.topicList} role="list">
                    {group.topics.map((topic) => (
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
              ))}
            </div>
          </section>
        ) : activeTopic ? (
          <article className={styles.article} aria-labelledby={`knowledge-${activeTopic.id}`}>
            <header className={styles.articleHeader}>
              <p className={styles.eyebrow}>{activeTopic.categoryLabel}</p>
              <h1 id={`knowledge-${activeTopic.id}`} ref={articleHeadingRef} tabIndex={-1}>
                {activeTopic.title}
              </h1>
              <p className={styles.lead}>
                {renderLinkedSegments(
                  linkedArticleContent?.summary || [{ kind: 'text', text: activeTopic.summary }],
                  `${activeTopic.id}-summary`,
                )}
              </p>
              {renderInlinePreview(`${activeTopic.id}-summary`)}
            </header>

            <aside className={styles.shortAnswer} aria-label={ru ? 'Короткий ответ' : 'Short answer'}>
              <strong>{ru ? 'Если совсем коротко' : 'In one sentence'}</strong>
              <p>{activeTopic.shortAnswer}</p>
            </aside>

            {showArticleContents ? (
              <nav className={styles.articleContents} aria-labelledby="knowledge-contents-title">
                <h2 id="knowledge-contents-title">{ru ? 'В этой статье' : 'In this article'}</h2>
                <ol role="list">
                  {coreSections.map(({ section, index }) => {
                    const sectionId = `knowledge-section-${activeTopic.id}-${index}`;
                    return (
                      <li key={sectionId}>
                        <a
                          href={`#${sectionId}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(sectionId)?.scrollIntoView({ behavior: 'auto' });
                          }}
                        >
                          {section.title}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : null}

            {activeDiagram
              ? <KnowledgeDiagram diagram={activeDiagram} language={language} />
              : <KnowledgeArticleVisual topicId={activeTopic.id} category={activeTopic.category} language={language} />}

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
