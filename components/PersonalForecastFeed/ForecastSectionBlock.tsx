import React, { useState, type CSSProperties, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type {
  ForecastEvidenceView,
  ForecastSection,
  PersonalForecastPeriod,
} from '../../lib/personalForecastContract';
import { ForecastBottomSheet } from './ForecastBottomSheet';

type ForecastSectionBlockProps = {
  section: ForecastSection;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
  locked: boolean;
  style?: CSSProperties;
  hasVisual?: boolean;
  editorialStickerPath?: string | null;
  children?: ReactNode;
  evidence: Record<string, ForecastEvidenceView>;
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
    }[period];
  }
  return {
    day: 'Личный гороскоп на сегодня',
    week: 'Личный гороскоп на неделю',
    month: 'Личный гороскоп на месяц',
  }[period];
}

function renderContentBlocks(
  section: ForecastSection,
  activeAnchorId: string | null,
  onOpenExplanation: (anchorId: string) => void,
  language: 'ru' | 'en',
): ReactNode {
  return (
    <div className="forecast-feed-section-copy">
      {section.contentBlocks.map((block) => {
        const explanationAnchor = block.explanationAnchorId
          ? section.explanationAnchors.find(
              (anchor) => anchor.id === block.explanationAnchorId,
            )
          : null;
        return (
          <p
            key={block.id}
            className={[
              'forecast-feed-section-text',
              block.role === 'lead' ? 'is-lead' : 'is-body',
              block.role === 'action' ? 'is-takeaway' : '',
            ].filter(Boolean).join(' ')}
            data-editorial-role={block.role}
          >
            {block.text}
            {explanationAnchor ? (
              <button
                type="button"
                className={[
                  'forecast-feed-inline-explanation-toggle',
                  activeAnchorId === explanationAnchor.id ? 'is-expanded' : '',
                ].filter(Boolean).join(' ')}
                aria-label={language === 'ru'
                  ? 'Показать, на чём основан вывод'
                  : 'Show what this conclusion is based on'}
                aria-haspopup="dialog"
                aria-expanded={activeAnchorId === explanationAnchor.id}
                onClick={() => onOpenExplanation(explanationAnchor.id)}
              >
                <Info size={15} strokeWidth={1.9} aria-hidden />
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
  editorialStickerPath,
  children,
  evidence,
  onRequestPremium,
}: ForecastSectionBlockProps) {
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
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
  const activeAnchor = section.explanationAnchors.find(
    (anchor) => anchor.id === activeAnchorId,
  ) || null;

  if (section.status !== 'ready') return null;

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
            <span>{title}</span>
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
          renderContentBlocks(
            section,
            activeAnchorId,
            (anchorId) => {
              setActiveAnchorId(anchorId);
            },
            language,
          )
        )}
        {editorialStickerPath ? (
          <img className="forecast-feed-editorial-sticker" src={editorialStickerPath} alt="" aria-hidden />
        ) : null}
        {children}
      </div>
      <ForecastBottomSheet
        open={!!activeAnchor}
        title={language === 'ru' ? 'Почему такой вывод' : 'Why this conclusion'}
        subtitle={activeAnchor?.conclusion}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setActiveAnchorId(null)}
      >
        {activeAnchor ? (
          <div className="forecast-feed-how-copy">
            <p>{activeAnchor.explanation}</p>
            {activeAnchor.evidenceIds.some((id) => evidence[id]) ? (
              <div className="forecast-feed-inline-explanation-evidence">
                {activeAnchor.evidenceIds.map((id) => {
                  const item = evidence[id];
                  if (!item) return null;
                  return (
                    <span key={id}>
                      <strong>{item.factor}</strong>
                      <span>{item.meaning}</span>
                      {item.period ? <small>{item.period}</small> : null}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </ForecastBottomSheet>
    </section>
  );
}
