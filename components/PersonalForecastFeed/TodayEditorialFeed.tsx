import { useMemo, type ReactNode } from 'react';
import type { ForecastSection, PersonalForecastAstrologerBrief } from '../../lib/personalForecastContract';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';
import {
  TodayCalendarClock,
  type TodayClockSignal,
} from './TodayCalendarClock';

type TodayEditorialFeedProps = {
  sections: readonly ForecastSection[];
  lockedSectionIds: ReadonlySet<string>;
  userId: string;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  tone: PersonalForecastAstrologerBrief['tone'];
  personalAttribution?: string | null;
  onRequestPremium: () => void;
  /** «Слушать прогноз», shown above the reading. */
  listen?: ReactNode;
  footer?: ReactNode;
};

function resolveTitle(section?: ForecastSection): string {
  if (!section || section.kind !== 'overview') return '';
  return section.title?.replace(/\s+/gu, ' ').trim() || '';
}

function clockSignalForTone(tone: PersonalForecastAstrologerBrief['tone']): TodayClockSignal {
  if (tone === 'favorable') return 'green';
  if (tone === 'demanding') return 'red';
  return 'yellow';
}

function StoryFragment({
  section,
  language,
  locked,
  onRequestPremium,
  closing,
  personalAttribution,
}: {
  section: ForecastSection;
  language: 'ru' | 'en';
  locked: boolean;
  onRequestPremium: () => void;
  closing: boolean;
  personalAttribution?: string | null;
}) {
  const untitledSection = {
    ...section,
    title: '',
  };
  const fragment = (
    <ForecastSectionBlock
      section={untitledSection}
      period="day"
      language={language}
      locked={locked}
      onRequestPremium={onRequestPremium}
    />
  );

  return closing ? (
    <div className="today-minimal-closing">
      <div className="today-minimal-closing-content">
        {fragment}
      </div>
      {personalAttribution ? (
        <p className="today-period-personal-note forecast-personal-attribution">
          {personalAttribution}
        </p>
      ) : null}
    </div>
  ) : fragment;
}

export function TodayEditorialFeed({
  sections,
  lockedSectionIds,
  userId,
  periodKey,
  timezone,
  language,
  tone,
  personalAttribution,
  onRequestPremium,
  listen,
  footer,
}: TodayEditorialFeedProps) {
  const renderableSections = useMemo(
    () => sections.filter((section) => isRenderableTodaySection(section, lockedSectionIds)),
    [lockedSectionIds, sections],
  );
  const visibleSections = useMemo(
    () => renderableSections.filter((section) => !lockedSectionIds.has(section.id)),
    [lockedSectionIds, renderableSections],
  );
  const closingSectionId = useMemo(
    () => [...visibleSections]
      .reverse()
      .find((section) => section.kind !== 'overview'
        && section.contentBlocks.some((block) => block.role === 'action'))
      ?.id || null,
    [visibleSections],
  );
  const overview = visibleSections.find((section) => section.kind === 'overview');
  const title = resolveTitle(overview);
  const clockSignal = clockSignalForTone(tone);

  return (
    <article
      className="forecast-feed-story forecast-editorial-reading today-editorial-feed today-minimal-feed"
      data-today-layout="calendar-editorial"
      lang={language}
    >
      <section
        className="today-minimal-hero"
        aria-labelledby="today-reading-title"
      >
        <div className="today-minimal-composition">
          {title ? (
            <h1 id="today-reading-title" className="today-minimal-story-title">
              {title}
            </h1>
          ) : (
            <h1 id="today-reading-title" className="sr-only">
              {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
            </h1>
          )}
          <TodayCalendarClock
            userId={userId}
            periodKey={periodKey}
            timezone={timezone}
            language={language}
            signal={clockSignal}
          />
        </div>
      </section>

      <section
        className="today-minimal-reading"
        aria-labelledby="today-reading-title"
      >
        <div className="today-minimal-reading-main">
          {listen}
          {visibleSections.map((section) => (
            <StoryFragment
              key={`day:${periodKey}:${section.id}`}
              section={section}
              language={language}
              locked={false}
              onRequestPremium={onRequestPremium}
              closing={section.id === closingSectionId}
              personalAttribution={section.id === closingSectionId
                ? personalAttribution
                : null}
            />
          ))}
        </div>
      </section>
      {footer}
    </article>
  );
}
