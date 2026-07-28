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

function renderTextWithAnchors(
  section: ForecastSection,
  onExplain: ForecastSectionBlockProps['onExplain'],
): ReactNode {
  const text = section.text.trim();
  if (!text) return null;

  const located = section.explanationAnchors
    .map((anchor) => ({
      anchor,
      index: text.indexOf(anchor.conclusion),
    }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index);

  if (!located.length) {
    return (
      <>
        <p className="forecast-feed-section-text">{text}</p>
        {section.explanationAnchors.length ? (
          <div className="forecast-feed-anchor-list">
            {section.explanationAnchors.map((anchor) => (
              <button
                key={anchor.id}
                type="button"
                className="forecast-feed-anchor"
                onClick={() => onExplain(section, anchor)}
              >
                <span>{anchor.conclusion}</span>
                <span className="forecast-feed-info-icon" aria-hidden>i</span>
              </button>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { anchor, index } of located) {
    if (index < cursor) continue;
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <Fragment key={anchor.id}>
        {anchor.conclusion}
        <button
          type="button"
          className="forecast-feed-inline-info"
          aria-label="Показать основание вывода"
          onClick={() => onExplain(section, anchor)}
        >
          i
        </button>
      </Fragment>,
    );
    cursor = index + anchor.conclusion.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  const unlocated = section.explanationAnchors.filter(
    (anchor) => !located.some((entry) => entry.anchor.id === anchor.id),
  );

  return (
    <>
      <p className="forecast-feed-section-text">{parts}</p>
      {unlocated.length ? (
        <div className="forecast-feed-anchor-list">
          {unlocated.map((anchor) => (
            <button
              key={anchor.id}
              type="button"
              className="forecast-feed-anchor"
              onClick={() => onExplain(section, anchor)}
            >
              <span>{anchor.conclusion}</span>
              <span className="forecast-feed-info-icon" aria-hidden>i</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
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
  const title = section.title?.trim();
  const isOverview = section.kind === 'overview';
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
      <span className="forecast-feed-section-shade" aria-hidden />
      <div className="forecast-feed-section-content">
        {title ? <h2 className="forecast-feed-section-title">{title}</h2> : null}
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
              <span aria-hidden>✦</span>
              {language === 'ru' ? 'Открыть в Premium' : 'Unlock with Premium'}
            </button>
          </div>
        ) : (
          <>
            {renderTextWithAnchors(section, onExplain)}
            {section.inlineAstroAccent?.text ? (
              <p className="forecast-feed-inline-astro">
                {section.inlineAstroAccent.text}
              </p>
            ) : null}
          </>
        )}
        {children}
      </div>
    </section>
  );
}
