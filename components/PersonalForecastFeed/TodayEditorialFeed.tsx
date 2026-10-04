import { useMemo, type ReactNode } from 'react';
import type { ForecastSection, PersonalForecastAstrologerBrief } from '../../lib/personalForecastContract';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';
import { SkyHero } from '../home/SkyHero';

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
  /** «Слушать прогноз», shown on the sky under the opening text. */
  listen?: ReactNode;
  /** The top bar, drawn over the sky cover. */
  top?: ReactNode;
  /** Right under the cover: the entries into every section. */
  afterHero?: ReactNode;
  footer?: ReactNode;
};

function resolveTitle(section?: ForecastSection): string {
  if (!section || section.kind !== 'overview') return '';
  return section.title?.replace(/\s+/gu, ' ').trim() || '';
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
  periodKey,
  language,
  personalAttribution,
  onRequestPremium,
  listen,
  top,
  afterHero,
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
  const rest = visibleSections.filter((section) => section !== overview);
  const scrollToSky = () => {
    document.getElementById('today-sky')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <article
      className="forecast-feed-story forecast-editorial-reading today-editorial-feed today-minimal-feed"
      data-today-layout="sky-cover"
      lang={language}
    >
      <SkyHero
        dayKey={periodKey}
        language={language}
        top={top}
        kicker={language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
        title={title || undefined}
        titleId="today-reading-title"
        onMoon={scrollToSky}
      >
        {!title ? (
          <h1 id="today-reading-title" className="sr-only">
            {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
          </h1>
        ) : null}
        {overview ? (
          <div className="sky-hero-text">
            <StoryFragment
              section={overview}
              language={language}
              locked={false}
              onRequestPremium={onRequestPremium}
              closing={overview.id === closingSectionId}
              personalAttribution={null}
            />
          </div>
        ) : null}
        {listen ? <div className="sky-hero-listen">{listen}</div> : null}
      </SkyHero>

      {afterHero}

      {rest.length ? (
        <section
          className="today-minimal-reading"
          aria-labelledby="today-reading-title"
        >
          <div className="today-minimal-reading-main">
            {rest.map((section) => (
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
      ) : null}
      {footer}
    </article>
  );
}
