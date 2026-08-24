import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { UserProfile } from '../../types';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { EditorialProfileButton } from '../../components/editorial/EditorialScreenChrome';
import {
  getEncyclopediaTopics,
  getRelatedTopics,
  groupTopicsByCategory,
  INITIAL_ENCYCLOPEDIA_SCREEN,
} from '../../lib/knowledgeEncyclopedia';

type EncyclopediaScreen = typeof INITIAL_ENCYCLOPEDIA_SCREEN | 'article';

type AstrologyEncyclopediaProps = {
  profile: UserProfile;
  onOpenProfile?: () => void;
  embedded?: boolean;
};

export function AstrologyEncyclopedia({
  profile,
  onOpenProfile,
  embedded = false,
}: AstrologyEncyclopediaProps) {
  const ru = profile.language !== 'en';
  const topics = getEncyclopediaTopics(profile.language);
  const [screen, setScreen] = useState<EncyclopediaScreen>(INITIAL_ENCYCLOPEDIA_SCREEN);
  const [activeTopicId, setActiveTopicId] = useState(topics[0]?.id || '');
  const contentRef = useRef<HTMLElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const articleHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const activeTopic = topics.find((topic) => topic.id === activeTopicId) || topics[0];
  const topicGroups = useMemo(() => groupTopicsByCategory(topics), [topics]);
  const related = activeTopic ? getRelatedTopics(topics, activeTopic.id) : [];

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
          <span>{ru ? 'Вернитесь позже — здесь появятся короткие объяснения.' : 'Come back later for short, clear explanations.'}</span>
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
              <h1 ref={catalogHeadingRef} tabIndex={-1}>{ru ? 'Разобраться в главном' : 'Start with the essentials'}</h1>
              <span>{ru ? 'Короткие объяснения без сложных слов и лишних обещаний.' : 'Short explanations without unnecessary jargon or promises.'}</span>
            </header>

            <div className="encyclopedia-catalog" aria-label={ru ? 'Материалы энциклопедии' : 'Encyclopedia articles'}>
              {topicGroups.map(([category, categoryTopics]) => (
                <section key={category} className="encyclopedia-category" aria-labelledby={`encyclopedia-category-${categoryTopics[0].id}`}>
                  <h2 id={`encyclopedia-category-${categoryTopics[0].id}`}>{category}</h2>
                  <div className="encyclopedia-topic-list">
                    {categoryTopics.map((topic) => (
                      <button key={topic.id} type="button" onClick={() => openTopic(topic.id)}>
                        <span>
                          <strong>{topic.title}</strong>
                          <small>{topic.simple}</small>
                        </span>
                        <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <article className="encyclopedia-article" aria-labelledby="encyclopedia-article-title">
            <p className="encyclopedia-eyebrow">{activeTopic.eyebrow}</p>
            <h1 id="encyclopedia-article-title" ref={articleHeadingRef} tabIndex={-1}>{activeTopic.title}</h1>
            <div className="encyclopedia-copy">
              {activeTopic.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <aside className="encyclopedia-simple" aria-labelledby="encyclopedia-simple-title">
              <h2 id="encyclopedia-simple-title">{ru ? 'Коротко' : 'In brief'}</h2>
              <p>{activeTopic.simple}</p>
            </aside>
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
            <button className="encyclopedia-return" type="button" onClick={returnToCatalog}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
              <span>{ru ? 'Все материалы' : 'All articles'}</span>
            </button>
          </article>
        )}
      </main>
    </div>
  );
}
