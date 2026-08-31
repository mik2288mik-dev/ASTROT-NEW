import React from 'react';
import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import type { DiaryEditorialPause } from '../../lib/personalForecastVisuals';
import { resolveVisibleForecastTitle } from './editorialLayout';
import { ForecastEndEditorialVisual } from './ForecastEndEditorialVisual';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  onRequestPremium: () => void;
  endVisualAsset?: DiaryEditorialPause['asset'] | null;
};

function closingLabel(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return period === 'week'
      ? 'Week takeaway'
      : period === 'month'
        ? 'Month takeaway'
        : 'Today takeaway';
  }
  return period === 'week'
    ? 'Итог недели'
    : period === 'month'
      ? 'Итог месяца'
      : 'Итог дня';
}

function renderContentBlocks(
  section: ForecastSection,
  period: PersonalForecastPeriod,
) {
  const text = section.contentBlocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[
      'forecast-feed-section-copy',
      period !== 'day' ? 'forecast-period-editorial-copy' : '',
    ].filter(Boolean).join(' ')}>
      <p
        className={[
          'forecast-feed-section-text',
          'is-body',
          period !== 'day' ? 'is-story-opening' : '',
          period !== 'day' && section.kind === 'overview' ? 'is-opening-paragraph' : '',
        ].filter(Boolean).join(' ')}
        data-story-paragraph={period !== 'day' ? 1 : undefined}
      >
        {text}
      </p>
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
            {closingLabel(period, language)}
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
