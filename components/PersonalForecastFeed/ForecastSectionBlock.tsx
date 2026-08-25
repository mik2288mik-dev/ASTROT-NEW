import React from 'react';
import type {
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import {
  clampDiaryVisualSize,
  type DiaryEditorialPause,
} from '../../lib/personalForecastVisuals';
import { EditorialForecastVisual } from './EditorialForecastVisual';
import {
  resolveLongForecastParagraphs,
  resolveVisibleForecastTitle,
} from './editorialLayout';
import { ForecastArc } from './ForecastArc';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  sticker?: DiaryEditorialPause['asset'] | null;
  onRequestPremium: () => void;
};

function renderContentBlocks(
  section: ForecastSection,
  period: PersonalForecastPeriod,
  sticker?: DiaryEditorialPause['asset'] | null,
) {
  if (period !== 'day') {
    const paragraphs = resolveLongForecastParagraphs(
      section.contentBlocks.map((block) => block.text),
    );
    const visualParagraphIndex = Math.min(1, paragraphs.length - 1);

    return (
      <div className="forecast-feed-section-copy forecast-period-editorial-copy">
        {paragraphs.map((text, index) => {
          const paragraph = (
            <p
              className={[
                'forecast-feed-section-text',
                index === 0 ? 'is-lead is-story-opening' : 'is-body is-story-continuation',
              ].join(' ')}
              data-story-paragraph={index + 1}
            >
              {text}
            </p>
          );

          return (
            <React.Fragment key={`story-paragraph-${index + 1}`}>
              {index === 1 ? (
                <ForecastArc
                  className="forecast-period-editorial-arc is-divider"
                  direction="down"
                  dot="center"
                  placement="divider"
                  variant={period === 'week' ? 'week' : 'month'}
                />
              ) : null}
              {sticker && index === visualParagraphIndex ? (
                <div className="forecast-period-editorial-scene">
                  {paragraph}
                  <EditorialForecastVisual
                    asset={sticker}
                    size={clampDiaryVisualSize('medium', sticker.displayWeight)}
                    priority
                  />
                </div>
              ) : paragraph}
            </React.Fragment>
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
        {!locked && period !== 'day' && isOverview ? (
          <ForecastArc
            className="forecast-period-editorial-arc is-opening"
            direction="up"
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
        ) : renderContentBlocks(section, period, sticker)}
        {!locked && period !== 'day' && isOverview ? (
          <ForecastArc
            className="forecast-period-editorial-arc is-closing"
            direction="up"
            dot="left"
            placement="closing"
            variant={period === 'week' ? 'week' : 'month'}
          />
        ) : null}
      </div>
      {!locked && period === 'day' && sticker ? (
        <div
          className={`forecast-feed-editorial-pause is-${sticker.collection}`}
          aria-hidden="true"
        >
          <EditorialForecastVisual
            asset={sticker}
            size={clampDiaryVisualSize('medium', sticker.displayWeight)}
          />
        </div>
      ) : null}
    </section>
  );
}
