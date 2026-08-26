import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ForecastSection, PersonalForecastAstrologerBrief } from '../../lib/personalForecastContract';
import { selectTodayEndEditorialAsset } from '../../lib/personalForecastVisuals';
import { resolveTodayPremiumTeaserInsertion } from '../../lib/todayPremiumTeaser';
import { ForecastSectionBlock } from './ForecastSectionBlock';
import { isRenderableTodaySection } from './editorialLayout';
import {
  TodayCalendarClock,
  TodayLineField,
  type TodayClockSignal,
} from './TodayCalendarClock';
import { ForecastArc } from './ForecastArc';

type TodayEditorialFeedProps = {
  sections: readonly ForecastSection[];
  lockedSectionIds: ReadonlySet<string>;
  userId: string;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  tone: PersonalForecastAstrologerBrief['tone'];
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

function resolveTitle(section?: ForecastSection): string {
  if (!section || section.kind !== 'overview') return '';
  return section.title?.replace(/\s+/gu, ' ').trim() || '';
}

function resolvePunchline(section?: ForecastSection): string {
  if (!section || section.kind !== 'overview') return '';
  return section.contentBlocks
    .find((block) => block.role === 'lead')
    ?.text.replace(/\s+/gu, ' ')
    .trim() || '';
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
}: {
  section: ForecastSection;
  language: 'ru' | 'en';
  locked: boolean;
  onRequestPremium: () => void;
  closing: boolean;
}) {
  const punchlineIndex = section.kind === 'overview'
    ? section.contentBlocks.findIndex((block) => block.role === 'lead')
    : -1;
  const contentBlocks = punchlineIndex >= 0
    ? section.contentBlocks.filter((_, index) => index !== punchlineIndex)
    : section.contentBlocks;
  const untitledSection = {
    ...section,
    title: '',
    text: contentBlocks.map((block) => block.text.trim()).join('\n\n'),
    contentBlocks,
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
      <ForecastArc
        className="today-minimal-closing-arc"
        direction="down"
        dot="left"
        variant="today"
      />
      <p className="today-minimal-closing-label">
        {language === 'ru' ? 'Совет дня' : 'Advice for today'}
      </p>
      {fragment}
    </div>
  ) : fragment;
}

function TodayForecastBridge() {
  return (
    <div className="today-minimal-forecast-bridge" aria-hidden="true">
      <svg viewBox="0 0 390 156" preserveAspectRatio="none" focusable="false">
        <path d="M218-24C326-14 365 54 316 96C279 128 226 127 184 110C145 94 116 103 82 142" />
        <circle cx="184" cy="110" r="2.2" />
      </svg>
    </div>
  );
}

export function TodayEditorialFeed({
  sections,
  lockedSectionIds,
  userId,
  periodKey,
  timezone,
  language,
  tone,
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
  const endVisual = useMemo(() => selectTodayEndEditorialAsset({
    userId,
    periodKey,
    sections: renderableSections,
  }), [periodKey, renderableSections, userId]);
  const overview = visibleSections.find((section) => section.kind === 'overview');
  const title = resolveTitle(overview);
  const punchline = resolvePunchline(overview);
  const clockSignal = clockSignalForTone(tone);

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
        aria-labelledby={title ? 'today-reading-title' : punchline ? 'today-punchline' : undefined}
        aria-describedby={title && punchline ? 'today-punchline' : undefined}
        aria-label={!title && !punchline
          ? (language === 'ru' ? 'Личный прогноз на сегодня' : 'Personal forecast for today')
          : undefined}
      >
        <div className="today-minimal-composition">
          <TodayLineField userId={userId} periodKey={periodKey} />
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
          {punchline ? (
            <p id="today-punchline" className="today-minimal-punchline">
              {punchline}
            </p>
          ) : null}
        </div>
        <TodayForecastBridge />
      </section>

      <section
        className="today-minimal-reading"
        aria-labelledby="today-reading-title"
      >
        <div className="today-minimal-reading-main">
          {visibleSections.map((section) => (
            <React.Fragment key={`day:${periodKey}:${section.id}`}>
              <StoryFragment
                section={section}
                language={language}
                locked={false}
                onRequestPremium={onRequestPremium}
                closing={section.contentBlocks.some((block) => block.role === 'action')}
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
        {endVisual ? (
          <figure className="today-minimal-end-visual" aria-hidden="true">
            <img
              src={endVisual.path}
              width={endVisual.width}
              height={endVisual.height}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </figure>
        ) : null}
      </section>
    </article>
  );
}
