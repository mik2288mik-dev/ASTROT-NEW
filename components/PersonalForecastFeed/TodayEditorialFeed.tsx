import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ForecastPresentationStyle,
  ForecastSection,
} from '../../lib/personalForecastContract';
import type {
  DiaryEditorialPause,
  DiaryTodayVisualPlan,
} from '../../lib/personalForecastVisuals';
import { clampDiaryVisualSize } from '../../lib/personalForecastVisuals';
import { resolveTodayPremiumTeaserInsertion } from '../../lib/todayPremiumTeaser';
import { EditorialForecastVisual } from './EditorialForecastVisual';
import { EditorialPaperNote } from './EditorialPaperNote';
import { EditorialQuote } from './EditorialQuote';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import {
  isRenderableTodaySection,
  resolveForecastEditorialLayout,
  resolveTodayEditorialLayoutFromVisualPlan,
  resolveTodayEditorialVisualSize,
  resolveTodayVisualAnchorId,
  resolveVisibleForecastTitle,
  type TodayEditorialLayout,
} from './editorialLayout';

type TodayEditorialFeedProps = {
  sections: readonly ForecastSection[];
  lockedSectionIds: ReadonlySet<string>;
  pauses?: readonly DiaryEditorialPause[];
  visualPlan?: DiaryTodayVisualPlan | null;
  userId: string;
  periodKey: string;
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

function sectionPresentationStyle(
  section: ForecastSection,
  locked: boolean,
): ForecastPresentationStyle {
  if (locked) return 'prose';
  const style = section.presentationStyle;
  return style === 'pull_quote' || style === 'paper_note' ? style : 'prose';
}

function EditorialOverviewPresentation({
  section,
  style,
  userId,
  periodKey,
  language,
  paperTemplate,
}: {
  section: ForecastSection;
  style: Exclude<ForecastPresentationStyle, 'prose'>;
  userId: string;
  periodKey: string;
  language: 'ru' | 'en';
  paperTemplate: DiaryTodayVisualPlan['paperTemplate'];
}) {
  const title = resolveVisibleForecastTitle({
    period: 'day',
    kind: section.kind,
    title: section.title,
  });
  const sectionElementId = `forecast-section-${section.id}`;

  return (
    <section
      id={sectionElementId}
      data-forecast-section={section.id}
      data-period="day"
      className={[
        'forecast-feed-section',
        'forecast-feed-story-fragment',
        'is-overview',
        title ? 'has-title' : 'is-untitled',
      ].join(' ')}
    >
      <div className="forecast-feed-section-content">
        {title ? (
          <h1 className="forecast-feed-section-title forecast-feed-screen-headline">
            <span>{title}</span>
          </h1>
        ) : null}
        {style === 'pull_quote' ? (
          <EditorialQuote
            id={`${sectionElementId}-presentation`}
            sectionId={section.id}
            text={section.text}
            language={language}
          />
        ) : (
          <EditorialPaperNote
            id={`${sectionElementId}-presentation`}
            sectionId={section.id}
            text={section.text}
            seed={`${userId}|${periodKey}|${section.id}`}
            language={language}
            template={paperTemplate}
          />
        )}
      </div>
    </section>
  );
}

export function TodayEditorialFeed({
  sections,
  lockedSectionIds,
  pauses = [],
  visualPlan,
  userId,
  periodKey,
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
  const layout = visualPlan
    ? resolveTodayEditorialLayoutFromVisualPlan(visualPlan.layout)
    : resolveForecastEditorialLayout({
        userId,
        period: 'day',
        periodKey,
      }) as TodayEditorialLayout;
  const pausesBySection = useMemo(
    () => new Map(pauses.map((pause) => [pause.afterSectionId, pause])),
    [pauses],
  );
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
  const visualAnchorId = useMemo(() => resolveTodayVisualAnchorId({
    layout,
    sections: visibleSections,
  }), [layout, visibleSections]);

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
      className="forecast-feed-story forecast-editorial-reading today-editorial-feed"
      data-today-layout={layout}
      lang={language}
    >
      {visibleSections.map((section, index) => {
        const locked = false;
        const style = sectionPresentationStyle(section, locked);
        const plannedPause = visualPlan?.asset && section.id === visualAnchorId
          ? { afterSectionId: section.id, asset: visualPlan.asset }
          : undefined;
        const pause = locked
          ? undefined
          : (visualPlan
              ? plannedPause
              : pausesBySection.get(section.id));
        const sectionElementId = `forecast-section-${section.id}`;
        const specialOverviewStyle = section.kind === 'overview' && style !== 'prose'
          ? style
          : null;
        const beatClassName = [
          'today-editorial-beat',
          `is-${style.replace('_', '-')}`,
          section.kind === 'overview' ? 'is-overview' : '',
          pause ? 'has-visual' : '',
        ].filter(Boolean).join(' ');

        return (
          <React.Fragment key={`day:${periodKey}:${section.id}`}>
            <div
              className={beatClassName}
              data-editorial-beat={index + 1}
            >
            {specialOverviewStyle ? (
              <EditorialOverviewPresentation
                section={section}
                style={specialOverviewStyle}
                userId={userId}
                periodKey={periodKey}
                language={language}
                paperTemplate={visualPlan?.paperTemplate || null}
              />
            ) : style === 'pull_quote' ? (
              <EditorialQuote
                id={sectionElementId}
                sectionId={section.id}
                text={section.text}
                language={language}
              />
            ) : style === 'paper_note' ? (
              <EditorialPaperNote
                id={sectionElementId}
                sectionId={section.id}
                text={section.text}
                seed={`${userId}|${periodKey}|${section.id}`}
                language={language}
                template={visualPlan?.paperTemplate || null}
              />
            ) : (
              <ForecastSectionBlock
                section={section}
                period="day"
                language={language}
                locked={locked}
                onRequestPremium={onRequestPremium}
              />
            )}

            {pause ? (
              <EditorialForecastVisual
                asset={pause.asset}
                size={clampDiaryVisualSize(
                  resolveTodayEditorialVisualSize(layout),
                  pause.asset.displayWeight,
                )}
                priority={index <= 1}
              />
            ) : null}
            </div>
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
        );
      })}
    </article>
  );
}
