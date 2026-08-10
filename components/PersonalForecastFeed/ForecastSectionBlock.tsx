import React, { type CSSProperties, type ReactNode } from 'react';
import type {
  ForecastEvidenceView,
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
  editorialStickerPath?: string | null;
  children?: ReactNode;
  evidence: Record<string, ForecastEvidenceView>;
  showAstrology?: boolean;
  onRequestPremium: () => void;
};

function evidenceMeta(item: ForecastEvidenceView, language: 'ru' | 'en'): string {
  const status = language === 'ru'
    ? {
        applying: 'сходится',
        separating: 'расходится',
        exact: 'точный',
        active: 'активен',
        unknown: '',
      }[item.status]
    : {
        applying: 'applying',
        separating: 'separating',
        exact: 'exact',
        active: 'active',
        unknown: '',
      }[item.status];
  return [
    item.orb != null ? `${language === 'ru' ? 'орб' : 'orb'} ${item.orb}°` : '',
    status,
    item.period || '',
  ].filter(Boolean).join(' · ');
}

function renderContentBlocks(
  section: ForecastSection,
  evidence: Record<string, ForecastEvidenceView>,
  showAstrology: boolean,
  language: 'ru' | 'en',
  editorialStickerPath?: string | null,
): ReactNode {
  const stickerAfterIndex = 0;
  return (
    <div className="forecast-feed-section-copy">
      {section.contentBlocks.map((block, index) => {
        const blockEvidence = (block.evidenceIds || [])
          .map((id) => evidence[id])
          .filter((item): item is ForecastEvidenceView => !!item);
        return (
          <React.Fragment key={block.id}>
            <p
              className={[
                'forecast-feed-section-text',
                block.role === 'lead' ? 'is-lead' : 'is-body',
                block.role === 'action' ? 'is-takeaway' : '',
              ].filter(Boolean).join(' ')}
              data-editorial-role={block.role}
            >
              {block.text}
            </p>
            {showAstrology && blockEvidence.length ? (
              <div
                className="forecast-feed-astro-details"
                aria-label={language === 'ru' ? 'Астрологические пояснения' : 'Astrology details'}
              >
                {blockEvidence.map((item) => (
                  <p key={item.id}>
                    <strong>{item.factor}</strong>
                    {evidenceMeta(item, language) ? (
                      <small>{evidenceMeta(item, language)}</small>
                    ) : null}
                  </p>
                ))}
              </div>
            ) : null}
            {editorialStickerPath && index === stickerAfterIndex ? (
              <img
                className="forecast-feed-editorial-sticker"
                src={editorialStickerPath}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : null}
          </React.Fragment>
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
  showAstrology = false,
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
  const hasChildren = React.Children.count(children) > 0;

  if (section.status !== 'ready') return null;
  if (!locked && !hasReadableCopy && !hasChildren) return null;

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
        ) : (
          renderContentBlocks(
            section,
            evidence,
            showAstrology,
            language,
            editorialStickerPath,
          )
        )}
        {children}
      </div>
    </section>
  );
}
