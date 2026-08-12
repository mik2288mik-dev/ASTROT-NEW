import React, { useMemo } from 'react';
import type {
  ForecastPresentationStyle,
  ForecastSection,
} from '../../lib/personalForecastContract';
import type {
  DiaryEditorialPause,
  DiaryTodayVisualPlan,
} from '../../lib/personalForecastVisuals';
import { clampDiaryVisualSize } from '../../lib/personalForecastVisuals';
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
  onRequestPremium: () => void;
};

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
  onRequestPremium,
}: TodayEditorialFeedProps) {
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
  const visualAnchorId = useMemo(() => resolveTodayVisualAnchorId({
    layout,
    sections: renderableSections.filter((section) => !lockedSectionIds.has(section.id)),
  }), [layout, lockedSectionIds, renderableSections]);

  return (
    <article
      className="forecast-feed-story today-editorial-feed"
      data-today-layout={layout}
      lang={language}
    >
      {renderableSections.map((section, index) => {
        const locked = lockedSectionIds.has(section.id);
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
          <div
            key={`day:${periodKey}:${section.id}`}
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
                size={pause.asset.collection === 'editorial-v2'
                  ? clampDiaryVisualSize(
                      resolveTodayEditorialVisualSize(layout),
                      pause.asset.displayWeight,
                    )
                  : resolveTodayEditorialVisualSize(layout)}
                priority={index <= 1}
              />
            ) : null}
          </div>
        );
      })}
    </article>
  );
}
