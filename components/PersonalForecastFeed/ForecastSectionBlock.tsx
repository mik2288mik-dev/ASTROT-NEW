import React from 'react';
import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import type { DiaryEditorialPause } from '../../lib/personalForecastVisuals';
import {
  resolveLongForecastParagraphs,
  resolveVisibleForecastTitle,
} from './editorialLayout';
import { ForecastArc } from './ForecastArc';
import { ForecastEndEditorialVisual } from './ForecastEndEditorialVisual';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  onRequestPremium: () => void;
  endVisualAsset?: DiaryEditorialPause['asset'] | null;
};

function adviceLabel(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return period === 'week'
      ? 'Advice for the week'
      : period === 'month'
        ? 'Advice for the month'
        : 'Advice for today';
  }
  return period === 'week'
    ? 'Совет на неделю'
    : period === 'month'
      ? 'Совет на месяц'
      : 'Совет дня';
}

function renderContentBlocks(
  section: ForecastSection,
  period: PersonalForecastPeriod,
) {
  if (period !== 'day') {
    const punchlineBlock = section.kind === 'overview'
      ? section.contentBlocks.find((block) => block.role === 'lead')
      : undefined;
    const bodyBlocks = punchlineBlock
      ? section.contentBlocks.filter((block) => block.id !== punchlineBlock.id)
      : section.contentBlocks;
    const paragraphs = resolveLongForecastParagraphs(
      bodyBlocks.map((block) => block.text),
    );
    return (
      <div className="forecast-feed-section-copy forecast-period-editorial-copy">
        {punchlineBlock ? (
          <>
            <p className="forecast-feed-section-text is-lead forecast-period-editorial-punchline">
              {punchlineBlock.text}
            </p>
            <ForecastArc
              className="forecast-period-punchline-thread"
              direction="down"
              dot="center"
              placement="divider"
              variant={period === 'week' ? 'week' : 'month'}
            />
          </>
        ) : null}
        {paragraphs.map((text, index) => {
          const openingParagraph = index === 0 && section.kind === 'overview';
          return (
            <p
              key={`story-paragraph-${index + 1}`}
              className={[
                'forecast-feed-section-text',
                'is-body',
                index === 0 ? 'is-story-opening' : 'is-story-continuation',
                openingParagraph ? 'is-opening-paragraph' : '',
              ].filter(Boolean).join(' ')}
              data-story-paragraph={index + 1}
            >
              {text}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="forecast-feed-section-copy">
      {section.contentBlocks.map((block) => (
        <p
          key={block.id}
          className={[
            'forecast-feed-section-text',
            block.role === 'lead' ? 'is-lead' : 'is-body',
          ].join(' ')}
        >
          {block.text}
        </p>
      ))}
    </div>
  );
}

export function ForecastSectionBlock({
  section,
  period,
  language,
  locked,
  onRequestPremium,
  endVisualAsset,
}: ForecastSectionBlockProps) {
  const isOverview = section.kind === 'overview';
  const sectionTitle = resolveVisibleForecastTitle({
    period,
    kind: section.kind,
    title: section.title,
  });
  const title = sectionTitle;
  const preview = section.lockedPreview;
  const hasReadableCopy = section.contentBlocks.some((block) => block.text.trim());
  const copyLength = section.contentBlocks.reduce(
    (total, block) => total + block.text.trim().length,
    0,
  );
  const isBrief = !isOverview && copyLength > 0 && copyLength <= 180;
  const isAdvice = !isOverview
    && section.contentBlocks.some((block) => block.role === 'action');
  const showsEndVisual = Boolean(
    endVisualAsset && isAdvice && period !== 'day' && !locked,
  );

  if (section.status !== 'ready') return null;
  if (!locked && !hasReadableCopy) return null;

  return (
    <section
      id={`forecast-section-${section.id}`}
      data-forecast-section={section.id}
      data-period={period}
      className={[
        'forecast-feed-section',
        'forecast-feed-story-fragment',
        isOverview ? 'is-overview' : '',
        isBrief ? 'is-brief' : '',
        isAdvice ? 'is-advice' : '',
        showsEndVisual ? 'has-end-visual' : '',
        title ? 'has-title' : 'is-untitled',
        locked ? 'is-locked' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="forecast-feed-section-content">
        {!locked && period !== 'day' && isOverview ? (
          <ForecastArc
            className="forecast-period-title-thread"
            direction="down"
            dot="right"
            placement="opening"
            variant={period === 'week' ? 'week' : 'month'}
          />
        ) : null}
        {title ? (
          isOverview ? (
            <h1 className="forecast-feed-section-title forecast-feed-screen-headline">
              <span>{title}</span>
            </h1>
          ) : (
            <h2 className="forecast-feed-section-title">
              <span>{title}</span>
            </h2>
          )
        ) : null}
        {!locked && period !== 'day' && isAdvice ? (
          <p className="forecast-period-advice-label">
            {adviceLabel(period, language)}
          </p>
        ) : null}
        {locked ? (
          <div className="forecast-feed-locked">
            <p className="forecast-feed-locked-lead">{preview.lead}</p>
            <button
              type="button"
              className="forecast-feed-locked-blur"
              aria-label={language === 'ru'
                ? 'Открыть полный текст в Premium'
                : 'Unlock the full text with Premium'}
              onClick={onRequestPremium}
            >
              <span>{preview.blurred}</span>
            </button>
            <button
              type="button"
              className="forecast-feed-locked-teaser"
              aria-label={language === 'ru'
                ? `Открыть в Premium: ${preview.teaser}`
                : `Unlock with Premium: ${preview.teaser}`}
              onClick={onRequestPremium}
            >
              {preview.teaser}
            </button>
            <button
              type="button"
              className="forecast-feed-premium-cta"
              onClick={onRequestPremium}
            >
              {language === 'ru' ? 'Показать продолжение' : 'Show the rest'}
            </button>
          </div>
        ) : renderContentBlocks(section, period)}
        {showsEndVisual && endVisualAsset ? (
          <ForecastEndEditorialVisual
            asset={endVisualAsset}
            className="forecast-period-end-visual"
          />
        ) : null}
      </div>
    </section>
  );
}
