import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ForecastSection } from '../../lib/personalForecastContract';
import { resolveTodayPremiumTeaserInsertion } from '../../lib/todayPremiumTeaser';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';
import { TodayCalendarClock, TodayLineField } from './TodayCalendarClock';

type TodayEditorialFeedProps = {
  sections: readonly ForecastSection[];
  lockedSectionIds: ReadonlySet<string>;
  userId: string;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  premium: boolean;
  onRequestPremium: () => void;
  onFirstValueViewed?: () => void;
  onPremiumTeaserImpression?: () => void;
  onPremiumTeaserClick?: () => void;
  onPremiumTeaserDismiss?: () => void;
};

function TodayPremiumTeaser({
  language,
  onRequestPremium,
  onPremiumTeaserClick,
  onPremiumTeaserDismiss,
  teaserRef,
}: Pick<
  TodayEditorialFeedProps,
  | 'language'
  | 'onRequestPremium'
  | 'onPremiumTeaserClick'
  | 'onPremiumTeaserDismiss'
> & { teaserRef: React.RefObject<HTMLElement | null> }) {
  return (
    <section
      id="today-premium-teaser"
      ref={teaserRef}
      className="forecast-feed-section forecast-feed-story-fragment is-locked"
      data-premium-inline-teaser="today"
      aria-label={language === 'ru' ? 'Продолжение Today в Premium' : 'Continue Today with Premium'}
    >
      <div className="forecast-feed-section-content forecast-feed-locked">
        <p className="forecast-feed-locked-lead">
          {language === 'ru'
            ? 'Главное на сегодня уже открыто. В Premium — продолжение Today, личные неделя и месяц.'
            : 'The essentials for today are already open. Premium adds the rest of Today plus your personal week and month.'}
        </p>
        <button
          type="button"
          className="forecast-feed-premium-cta"
          onClick={() => {
            onPremiumTeaserClick?.();
            onRequestPremium();
          }}
        >
          {language === 'ru' ? 'Показать весь Today' : 'Show all of Today'}
        </button>
        <button
          type="button"
          className="forecast-feed-locked-teaser"
          onClick={onPremiumTeaserDismiss}
          aria-label={language === 'ru' ? 'Скрыть предложение Premium' : 'Dismiss Premium offer'}
        >
          {language === 'ru' ? 'Не сейчас' : 'Not now'}
        </button>
      </div>
    </section>
  );
}

function resolvePunchline(section?: ForecastSection): string {
  if (!section || section.kind !== 'overview') return '';
  return section.title?.replace(/\s+/gu, ' ').trim() || '';
}

function StoryFragment({
  section,
  language,
  locked,
  onRequestPremium,
}: {
  section: ForecastSection;
  language: 'ru' | 'en';
  locked: boolean;
  onRequestPremium: () => void;
}) {
  const untitledSection = section.title
    ? { ...section, title: '' }
    : section;
  return (
    <ForecastSectionBlock
      section={untitledSection}
      period="day"
      language={language}
      locked={locked}
      onRequestPremium={onRequestPremium}
    />
  );
}

export function TodayEditorialFeed({
  sections,
  lockedSectionIds,
  userId,
  periodKey,
  timezone,
  language,
  premium,
  onRequestPremium,
  onFirstValueViewed,
  onPremiumTeaserImpression,
  onPremiumTeaserClick,
  onPremiumTeaserDismiss,
}: TodayEditorialFeedProps) {
  const [teaserDismissed, setTeaserDismissed] = useState(false);
  const impressionKeyRef = useRef<string | null>(null);
  const teaserRef = useRef<HTMLElement | null>(null);
  const renderableSections = useMemo(
    () => sections.filter((section) => isRenderableTodaySection(section, lockedSectionIds)),
    [lockedSectionIds, sections],
  );
  const teaserInsertion = useMemo(() => resolveTodayPremiumTeaserInsertion({
    premium,
    sectionIds: renderableSections.map((section) => section.id),
    lockedSectionIds,
  }), [lockedSectionIds, premium, renderableSections]);
  const visibleSections = useMemo(
    () => renderableSections.filter((section) => !lockedSectionIds.has(section.id)),
    [lockedSectionIds, renderableSections],
  );
  const punchlineSource = visibleSections.find((section) => section.kind === 'overview');
  const punchline = resolvePunchline(punchlineSource);

  useEffect(() => {
    setTeaserDismissed(false);
    impressionKeyRef.current = null;
  }, [periodKey, userId]);

  useEffect(() => {
    if (!teaserInsertion || teaserDismissed) return;
    const impressionKey = `${userId}:${periodKey}:${teaserInsertion.afterSectionId}`;
    if (impressionKeyRef.current === impressionKey) return;
    const teaser = teaserRef.current;
    if (!teaser || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) return;
      if (impressionKeyRef.current === impressionKey) return;
      impressionKeyRef.current = impressionKey;
      onFirstValueViewed?.();
      onPremiumTeaserImpression?.();
      observer.disconnect();
    }, { threshold: [0.35] });
    observer.observe(teaser);
    return () => observer.disconnect();
  }, [
    onFirstValueViewed,
    onPremiumTeaserImpression,
    periodKey,
    teaserDismissed,
    teaserInsertion,
    userId,
  ]);

  return (
    <article
      className="forecast-feed-story forecast-editorial-reading today-editorial-feed today-minimal-feed"
      data-today-layout="calendar-editorial"
      lang={language}
    >
      <section
        className="today-minimal-hero"
        aria-labelledby={punchline ? 'today-punchline' : undefined}
        aria-label={!punchline
          ? (language === 'ru' ? 'Личный прогноз на сегодня' : 'Personal forecast for today')
          : undefined}
      >
        <TodayLineField userId={userId} periodKey={periodKey} />
        <div className="today-minimal-composition">
          <TodayCalendarClock
            userId={userId}
            periodKey={periodKey}
            timezone={timezone}
            language={language}
          />
          {punchline ? (
            <p id="today-punchline" className="today-minimal-punchline">
              {punchline}
            </p>
          ) : null}
        </div>
      </section>

      <section
        className="today-minimal-reading"
        aria-labelledby="today-reading-title"
      >
        <h1 id="today-reading-title" className="sr-only">
          {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
        </h1>

        <div className="today-minimal-reading-main">
          {visibleSections.map((section) => (
            <React.Fragment key={`day:${periodKey}:${section.id}`}>
              <StoryFragment
                section={section}
                language={language}
                locked={false}
                onRequestPremium={onRequestPremium}
              />
              {!teaserDismissed && teaserInsertion?.afterSectionId === section.id ? (
                <TodayPremiumTeaser
                  language={language}
                  teaserRef={teaserRef}
                  onRequestPremium={onRequestPremium}
                  onPremiumTeaserClick={() => {
                    const impressionKey = `${userId}:${periodKey}:${teaserInsertion.afterSectionId}`;
                    if (impressionKeyRef.current !== impressionKey) {
                      impressionKeyRef.current = impressionKey;
                      onFirstValueViewed?.();
                      onPremiumTeaserImpression?.();
                    }
                    onPremiumTeaserClick?.();
                  }}
                  onPremiumTeaserDismiss={() => {
                    setTeaserDismissed(true);
                    onPremiumTeaserDismiss?.();
                  }}
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </section>
    </article>
  );
}
