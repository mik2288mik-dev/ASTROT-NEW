import React from 'react';
import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import type { DiaryEditorialAsset } from '../../lib/personalForecastVisuals';
import { EditorialSticker } from '../EditorialSticker';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  sticker?: DiaryEditorialAsset | null;
  onRequestPremium: () => void;
};

function renderContentBlocks(section: ForecastSection) {
  return (
    <div className="forecast-feed-section-copy">
      {section.contentBlocks.map((block) => (
        <p
          key={block.id}
          className={[
            'forecast-feed-section-text',
            block.role === 'lead' ? 'is-lead' : 'is-body',
          ].filter(Boolean).join(' ')}
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
  sticker,
  onRequestPremium,
}: ForecastSectionBlockProps) {
  const isOverview = section.kind === 'overview';
  const sectionTitle = section.title?.trim() || '';
  const technicalOverviewTitles = new Set([
    'Личный гороскоп на сегодня',
    'Личный гороскоп на неделю',
    'Личный гороскоп на месяц',
    'Your horoscope for today',
    'Your horoscope for the week',
    'Your horoscope for the month',
  ]);
  const title = isOverview && technicalOverviewTitles.has(sectionTitle)
    ? ''
    : sectionTitle;
  const preview = section.lockedPreview;
  const hasReadableCopy = section.contentBlocks.some((block) => block.text.trim());
  const copyLength = section.contentBlocks.reduce(
    (total, block) => total + block.text.trim().length,
    0,
  );
  const isBrief = !isOverview && copyLength > 0 && copyLength <= 180;

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
        ) : renderContentBlocks(section)}
      </div>
      {!locked && sticker ? (
        <div
          className={`forecast-feed-editorial-pause is-${sticker.collection}`}
          aria-hidden="true"
        >
          <EditorialSticker
            asset={sticker}
            className="forecast-feed-editorial-pause-image"
          />
        </div>
      ) : null}
    </section>
  );
}
