import React, { Fragment, type CSSProperties, type ReactNode } from 'react';
import type {
  ExplanationAnchor,
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  style?: CSSProperties;
  hasVisual?: boolean;
  children?: ReactNode;
  onExplain: (section: ForecastSection, anchor: ExplanationAnchor) => void;
  onRequestPremium: () => void;
};

function overviewTitle(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return {
      day: 'Your horoscope for today',
      week: 'Your horoscope for the week',
      month: 'Your horoscope for the month',
      year: 'Your horoscope for the year',
    }[period];
  }
  return {
    day: 'Личный гороскоп на сегодня',
    week: 'Личный гороскоп на неделю',
    month: 'Личный гороскоп на месяц',
    year: 'Личный гороскоп на год',
  }[period];
}

function renderTextWithAnchors(
  section: ForecastSection,
  onExplain: ForecastSectionBlockProps['onExplain'],
  language: 'ru' | 'en',
): ReactNode {
  const text = section.text.trim();
  if (!text) return null;

  const explicitParagraphs = text
    .split(/\n{2,}/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const sentences = explicitParagraphs.length === 1
    ? text.match(/[^.!?…]+(?:[.!?…]+|$)/gu)?.map((value) => value.trim()).filter(Boolean) || []
    : [];
  const paragraphs = explicitParagraphs.length > 1 || sentences.length <= 2
    ? explicitParagraphs
    : sentences.reduce<string[]>((groups, sentence, index) => {
        const groupIndex = Math.floor(index / 2);
        groups[groupIndex] = groups[groupIndex]
          ? `${groups[groupIndex]} ${sentence}`
          : sentence;
        return groups;
      }, []);
  const locatedAnchorIds = new Set(
    section.explanationAnchors
      .filter((anchor) => paragraphs.some((paragraph) => paragraph.includes(anchor.conclusion)))
      .map((anchor) => anchor.id),
  );
  const fallbackAnchor = section.explanationAnchors.find(
    (anchor) => !locatedAnchorIds.has(anchor.id),
  );

  return (
    <div className="forecast-feed-section-copy">
      {paragraphs.map((paragraph, paragraphIndex) => {
        const located = section.explanationAnchors
          .map((anchor) => ({
            anchor,
            index: paragraph.indexOf(anchor.conclusion),
          }))
          .filter((entry) => entry.index >= 0)
          .sort((left, right) => left.index - right.index);
        const parts: ReactNode[] = [];
        let cursor = 0;
        for (const { anchor, index } of located) {
          if (index < cursor) continue;
          if (index > cursor) parts.push(paragraph.slice(cursor, index));
          parts.push(
            <Fragment key={anchor.id}>
              {anchor.conclusion}
              <button
                type="button"
                className="forecast-feed-inline-info"
                aria-label={language === 'ru'
                  ? 'Показать, почему получился этот вывод'
                  : 'Show why this conclusion was reached'}
                onClick={() => onExplain(section, anchor)}
              >
                i
              </button>
            </Fragment>,
          );
          cursor = index + anchor.conclusion.length;
        }
        if (cursor < paragraph.length) parts.push(paragraph.slice(cursor));

        return (
          <p key={`${section.id}:${paragraphIndex}`} className="forecast-feed-section-text">
            {parts}
            {!locatedAnchorIds.size && paragraphIndex === 0 && fallbackAnchor ? (
              <button
                type="button"
                className="forecast-feed-inline-info"
                aria-label={language === 'ru'
                  ? 'Показать, почему получился этот вывод'
                  : 'Show why this conclusion was reached'}
                onClick={() => onExplain(section, fallbackAnchor)}
              >
                i
              </button>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

export function ForecastSectionBlock({
  section,
  period,
  language,
  locked,
  style,
  hasVisual = false,
  children,
  onExplain,
  onRequestPremium,
}: ForecastSectionBlockProps) {
  const isOverview = section.kind === 'overview';
  const title = isOverview
    ? overviewTitle(period, language)
    : section.title?.trim();
  const overviewAnchor = isOverview ? section.explanationAnchors[0] : null;
  const preview = section.lockedPreview;

  return (
    <section
      id={`forecast-section-${section.id}`}
      data-forecast-section={section.id}
      data-period={period}
      className={[
        'forecast-feed-section',
        `forecast-feed-section--${section.kind}`,
        isOverview ? 'is-overview' : '',
        locked ? 'is-locked' : '',
        hasVisual ? 'has-visual' : 'has-visual-fallback',
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <div className="forecast-feed-section-content">
        {title ? (
          <h2 className="forecast-feed-section-title">
            {title}
            {overviewAnchor ? (
              <button
                type="button"
                className="forecast-feed-info-icon"
                aria-label={language === 'ru'
                  ? 'Показать, почему получился этот вывод'
                  : 'Show why this conclusion was reached'}
                onClick={() => onExplain(section, overviewAnchor)}
              >
                i
              </button>
            ) : null}
          </h2>
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
        ) : (
          renderTextWithAnchors(section, onExplain, language)
        )}
        {children}
      </div>
    </section>
  );
}
