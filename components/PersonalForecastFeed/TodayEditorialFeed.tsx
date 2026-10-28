import { useMemo, useState, type ReactNode } from 'react';
import type { ForecastSection, PersonalForecastAstrologerBrief } from '../../lib/personalForecastContract';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';

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

const RU_WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** «Среда, 28 октября» from the forecast day key. */
function dateLine(dayKey: string, language: 'ru' | 'en'): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
  return language === 'ru'
    ? `${RU_WEEKDAYS[weekday]}, ${day} ${RU_MONTHS[(month || 1) - 1]}`
    : `${EN_WEEKDAYS[weekday]}, ${EN_MONTHS[(month || 1) - 1]} ${day}`;
}

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
  const [readingOpen, setReadingOpen] = useState(false);
  const ru = language === 'ru';
  return (
    <article
      className="forecast-feed-story forecast-editorial-reading today-editorial-feed today-minimal-feed"
      data-today-layout="sky-cover"
      lang={language}
    >
      <section className="nebo-today-hero" data-telemetry-content="Личный прогноз" aria-labelledby="today-reading-title">
        <p className="nebo-today-date">{dateLine(periodKey, language)}</p>
        <p className="nebo-today-kicker">{ru ? 'Для тебя сегодня' : 'For you today'}</p>
        <h1 id="today-reading-title" className="nebo-today-title">
          {title || (ru ? 'Личный прогноз на сегодня' : 'Your personal forecast for today')}
        </h1>
      </section>
      <div className="nebo-today-cta-row">
        <button
          type="button"
          className="nebo-today-cta"
          aria-expanded={readingOpen}
          aria-controls="today-reading"
          onClick={() => setReadingOpen((open) => !open)}
        >
          <span>{readingOpen
            ? (ru ? 'Свернуть прогноз' : 'Hide the forecast')
            : (ru ? 'Прочитай свой личный прогноз тут' : 'Read your personal forecast')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={readingOpen ? 'is-open' : undefined}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {readingOpen ? (
        <div id="today-reading" className="nebo-today-reading">
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
        </div>
      ) : null}

      {afterHero}

      {footer}
    </article>
  );
}
