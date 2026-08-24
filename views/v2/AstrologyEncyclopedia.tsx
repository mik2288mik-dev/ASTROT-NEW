import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { EditorialProfileButton } from '../../components/editorial/EditorialScreenChrome';
import {
  getKnowledgeTopics,
  getRelatedKnowledgeTopics,
  groupKnowledgeTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
  knowledgeLanguage,
  normalizeKnowledgeSearch,
  resolvePersonalKnowledge,
  searchKnowledgeTopics,
  type KnowledgePersonalizationKind,
  type PersonalKnowledgeReliability,
  type PersonalKnowledgeResult,
} from '../../lib/knowledge';

type EncyclopediaScreen = typeof INITIAL_ENCYCLOPEDIA_SCREEN | 'article';

export type AstrologyEncyclopediaProps = {
  profile: UserProfile;
  onOpenProfile?: () => void;
  embedded?: boolean;
  primaryChartData?: NatalChartData | null;
  personalReliability?: PersonalKnowledgeReliability | null;
  onAskAboutSelf?: (question: string) => void;
  onSpecifyBirthTime?: () => void;
};

function unavailableTimeMessage(
  kind: KnowledgePersonalizationKind | undefined,
  ru: boolean,
): string {
  if (!ru) {
    if (kind?.type === 'house') return `House ${kind.house} cannot be calculated reliably without an accurate birth time.`;
    if (kind?.type === 'angle') return 'This angle cannot be calculated reliably without an accurate birth time.';
    return 'This part of the chart cannot be calculated reliably without an accurate birth time.';
  }
  if (kind?.type === 'house') return `${kind.house} дом без точного времени рождения надёжно посчитать нельзя.`;
  if (kind?.type === 'angle') {
    const label = {
      ascendant: 'Асцендент', descendant: 'Десцендент', mc: 'MC', ic: 'IC',
    }[kind.key];
    return `${label} без точного времени рождения надёжно посчитать нельзя.`;
  }
  return 'Эту часть карты без точного времени рождения надёжно посчитать нельзя.';
}

function PersonalKnowledgeAccordion({
  result,
  kind,
  ru,
  onAskAboutSelf,
  onSpecifyBirthTime,
}: {
  result: PersonalKnowledgeResult;
  kind: KnowledgePersonalizationKind | undefined;
  ru: boolean;
  onAskAboutSelf?: (question: string) => void;
  onSpecifyBirthTime?: () => void;
}) {
  return (
    <details className="encyclopedia-personal">
      <summary>
        <span>{ru ? 'Что это значит в моей карте?' : 'What does this mean in my chart?'}</span>
        <ChevronDown aria-hidden="true" strokeWidth={1.6} />
      </summary>
      <div className="encyclopedia-personal-body">
        {result.status === 'requires_exact_birth_time' ? (
          <>
            <p>{unavailableTimeMessage(kind, ru)}</p>
            {onSpecifyBirthTime ? (
              <button type="button" className="encyclopedia-personal-action" onClick={onSpecifyBirthTime}>
                {ru ? 'Указать время рождения' : 'Add birth time'}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <ul className="encyclopedia-personal-facts" role="list">
              {result.facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
            {result.suggestedQuestion ? (
              <p className="encyclopedia-suggested-question">{result.suggestedQuestion}</p>
            ) : null}
            {result.suggestedQuestion && onAskAboutSelf ? (
              <button
                type="button"
                className="encyclopedia-personal-action"
                onClick={() => onAskAboutSelf(result.suggestedQuestion!)}
              >
                {ru ? 'Спросить о себе' : 'Ask about yourself'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

export function AstrologyEncyclopedia({
  profile,
  onOpenProfile,
  embedded = false,
  primaryChartData,
  personalReliability,
  onAskAboutSelf,
  onSpecifyBirthTime,
}: AstrologyEncyclopediaProps) {
  const language = knowledgeLanguage(profile.language);
  const ru = language === 'ru';
  const topics = useMemo(() => getKnowledgeTopics(language), [language]);
  const [screen, setScreen] = useState<EncyclopediaScreen>(INITIAL_ENCYCLOPEDIA_SCREEN);
  const [activeTopicId, setActiveTopicId] = useState(topics[0]?.id || '');
  const [query, setQuery] = useState('');
  const contentRef = useRef<HTMLElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const articleHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) || topics[0];
  const normalizedQuery = normalizeKnowledgeSearch(query);
  const filteredTopics = useMemo(() => searchKnowledgeTopics(topics, query), [query, topics]);
  const topicGroups = useMemo(
    () => groupKnowledgeTopicsByCategory(topics, language),
    [language, topics],
  );
  const related = useMemo(
    () => activeTopic ? getRelatedKnowledgeTopics(topics, activeTopic) : [],
    [activeTopic, topics],
  );
  const personal = useMemo(() => (
    activeTopic
      ? resolvePersonalKnowledge(activeTopic, primaryChartData, personalReliability, language)
      : null
  ), [activeTopic, language, personalReliability, primaryChartData]);

  const focusContent = (target: React.RefObject<HTMLHeadingElement | null>) => {
    window.requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ block: 'start' });
      target.current?.focus({ preventScroll: true });
    });
  };

  const openTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    setScreen('article');
    focusContent(articleHeadingRef);
  };

  const returnToCatalog = () => {
    setQuery('');
    setScreen(INITIAL_ENCYCLOPEDIA_SCREEN);
    focusContent(catalogHeadingRef);
  };

  if (!activeTopic) {
    return (
      <div className={`fresh-page encyclopedia-editorial-page${embedded ? ' !min-h-0 !pt-0 !pb-0 before:!hidden' : ''}`}>
        {!embedded ? (
          <AppTopBar
            title={ru ? 'Хочу знать' : 'Learn'}
            rightAction={<EditorialProfileButton label={ru ? 'Открыть профиль' : 'Open profile'} onClick={onOpenProfile} />}
          />
        ) : null}
        <main className="encyclopedia-content encyclopedia-empty">
          <p>{ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}</p>
          <h1>{ru ? 'Материалов пока нет' : 'No articles yet'}</h1>
          <span>{ru ? 'Вернитесь позже — здесь появятся понятные объяснения.' : 'Come back later for clear explanations.'}</span>
        </main>
      </div>
    );
  }

  return (
    <div className={`fresh-page encyclopedia-editorial-page${embedded ? ' !min-h-0 !pt-0 !pb-0 before:!hidden' : ''}`}>
      {!embedded ? (
        <AppTopBar
          title={ru ? 'Хочу знать' : 'Learn'}
          onBack={screen === 'article' ? returnToCatalog : undefined}
          rightAction={<EditorialProfileButton label={ru ? 'Открыть профиль' : 'Open profile'} onClick={onOpenProfile} />}
        />
      ) : null}

      <main ref={contentRef} className="encyclopedia-content">
        {screen === INITIAL_ENCYCLOPEDIA_SCREEN ? (
          <>
            <header className="encyclopedia-catalog-heading">
              <p>{ru ? 'Энциклопедия астрологии' : 'Astrology encyclopedia'}</p>
              <h1 ref={catalogHeadingRef} tabIndex={-1}>{ru ? 'Понять карту с нуля' : 'Understand a chart from scratch'}</h1>
              <span>
                {ru
                  ? 'Знаки, планеты, дома и прогнозы — простыми словами и без страшилок.'
                  : 'Signs, planets, houses, and forecasts in plain language and without scare stories.'}
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
              <section className="encyclopedia-search-results" aria-labelledby="knowledge-search-results">
                <h2 id="knowledge-search-results">
                  {ru ? `Найдено: ${filteredTopics.length}` : `Found: ${filteredTopics.length}`}
                </h2>
                {filteredTopics.length ? (
                  <div className="encyclopedia-topic-list">
                    {filteredTopics.map((topic) => (
                      <button key={topic.id} type="button" onClick={() => openTopic(topic.id)}>
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
                      ? `По запросу «${query.trim()}» ничего не найдено. Попробуйте короткое слово или другой термин.`
                      : `No articles found for “${query.trim()}”. Try a shorter or different term.`}
                  </p>
                )}
              </section>
            ) : (
              <div className="encyclopedia-catalog" aria-label={ru ? 'Материалы энциклопедии' : 'Encyclopedia articles'}>
                {topicGroups.map((group) => (
                  <section key={group.categoryId} className="encyclopedia-category" aria-labelledby={`knowledge-category-${group.categoryId}`}>
                    <header>
                      <h2 id={`knowledge-category-${group.categoryId}`}>{group.label}</h2>
                      <p>{group.description}</p>
                    </header>
                    <div className="encyclopedia-topic-list">
                      {group.topics.map((topic) => (
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
                ))}
              </div>
            )}
          </>
        ) : (
          <article className="encyclopedia-article" aria-labelledby="encyclopedia-article-title">
            <button className="encyclopedia-return encyclopedia-return-top" type="button" onClick={returnToCatalog}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
              <span>{ru ? 'Все материалы' : 'All articles'}</span>
            </button>
            <p className="encyclopedia-eyebrow">{activeTopic.categoryLabel}</p>
            <h1 id="encyclopedia-article-title" ref={articleHeadingRef} tabIndex={-1}>{activeTopic.title}</h1>
            <p className="encyclopedia-summary">{activeTopic.summary}</p>

            <div className="encyclopedia-copy">
              {activeTopic.sections.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </section>
              ))}
            </div>

            <aside className="encyclopedia-simple" aria-labelledby="encyclopedia-simple-title">
              <h2 id="encyclopedia-simple-title">{ru ? 'Коротко' : 'In brief'}</h2>
              <p>{activeTopic.shortAnswer}</p>
            </aside>

            {personal ? (
              <PersonalKnowledgeAccordion
                key={activeTopic.id}
                result={personal}
                kind={activeTopic.personalizationKind}
                ru={ru}
                onAskAboutSelf={onAskAboutSelf}
                onSpecifyBirthTime={onSpecifyBirthTime}
              />
            ) : null}

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
        )}
      </main>
    </div>
  );
}
