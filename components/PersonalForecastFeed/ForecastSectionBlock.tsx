import React, {
  Fragment,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
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

function splitForecastSentences(value: string): string[] {
  return value
    .match(/[^.!?…]+(?:[.!?…]+|$)/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];
}

function buildEditorialParagraphs(text: string): string[] {
  const explicitParagraphs = text
    .split(/\n{2,}/u)
    .map((value) => value.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) {
    const openingSentences = splitForecastSentences(explicitParagraphs[0]);
    if (openingSentences.length > 1) {
      return [
        openingSentences[0],
        openingSentences.slice(1).join(' '),
        ...explicitParagraphs.slice(1),
      ];
    }
    return explicitParagraphs;
  }

  const sentences = splitForecastSentences(text);
  if (sentences.length <= 1) return explicitParagraphs;

  return [
    sentences[0],
    ...sentences.slice(1).reduce<string[]>((groups, sentence, index) => {
      const groupIndex = Math.floor(index / 2);
      groups[groupIndex] = groups[groupIndex]
        ? `${groups[groupIndex]} ${sentence}`
        : sentence;
      return groups;
    }, []),
  ];
}

function renderTextWithAnchors(
  section: ForecastSection,
  evidence: ForecastSectionBlockProps['evidence'],
  expandedAnchorId: string | null,
  onToggleExplanation: (anchorId: string) => void,
  language: 'ru' | 'en',
): ReactNode {
  const text = section.text.trim();
  if (!text) return null;

  const paragraphs = buildEditorialParagraphs(text);
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
        const paragraphFallback = !locatedAnchorIds.size && paragraphIndex === 0
          ? fallbackAnchor
          : null;
        const paragraphAnchors = [
          ...located.map(({ anchor }) => anchor),
          ...(paragraphFallback ? [paragraphFallback] : []),
        ];
        const expandedAnchor = paragraphAnchors.find(
          (anchor) => anchor.id === expandedAnchorId,
        );
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
                className={[
                  'forecast-feed-inline-explanation-toggle',
                  expandedAnchorId === anchor.id ? 'is-expanded' : '',
                ].filter(Boolean).join(' ')}
                aria-label={language === 'ru'
                  ? `${expandedAnchorId === anchor.id ? 'Скрыть' : 'Показать'} объяснение вывода`
                  : `${expandedAnchorId === anchor.id ? 'Hide' : 'Show'} the explanation`}
                aria-expanded={expandedAnchorId === anchor.id}
                aria-controls={`forecast-explanation-${section.id}-${anchor.id}`}
                onClick={() => onToggleExplanation(anchor.id)}
              >
                <ChevronDown size={15} strokeWidth={1.9} aria-hidden />
              </button>
            </Fragment>,
          );
          cursor = index + anchor.conclusion.length;
        }
        if (cursor < paragraph.length) parts.push(paragraph.slice(cursor));

        return (
          <Fragment key={`${section.id}:${paragraphIndex}`}>
            <p
              className={[
                'forecast-feed-section-text',
                paragraphIndex === 0 ? 'is-lead' : 'is-body',
                paragraphIndex > 0 && paragraphIndex === paragraphs.length - 1
                  ? 'is-takeaway'
                  : '',
              ].filter(Boolean).join(' ')}
              data-editorial-role={paragraphIndex === 0
                ? 'lead'
                : paragraphIndex === paragraphs.length - 1
                  ? 'takeaway'
                  : 'detail'}
            >
              {parts}
              {paragraphFallback ? (
                <button
                  type="button"
                  className={[
                    'forecast-feed-inline-explanation-toggle',
                    expandedAnchorId === paragraphFallback.id ? 'is-expanded' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={language === 'ru'
                    ? `${expandedAnchorId === paragraphFallback.id ? 'Скрыть' : 'Показать'} объяснение вывода`
                    : `${expandedAnchorId === paragraphFallback.id ? 'Hide' : 'Show'} the explanation`}
                  aria-expanded={expandedAnchorId === paragraphFallback.id}
                  aria-controls={`forecast-explanation-${section.id}-${paragraphFallback.id}`}
                  onClick={() => onToggleExplanation(paragraphFallback.id)}
                >
                  <ChevronDown size={15} strokeWidth={1.9} aria-hidden />
                </button>
              ) : null}
            </p>
            {expandedAnchor ? (
              <div
                id={`forecast-explanation-${section.id}-${expandedAnchor.id}`}
                className="forecast-feed-inline-explanation"
                aria-live="polite"
              >
                <p>{expandedAnchor.explanation}</p>
                {expandedAnchor.evidenceIds.some((id) => evidence[id]) ? (
                  <div className="forecast-feed-inline-explanation-evidence">
                    {expandedAnchor.evidenceIds.map((id) => {
                      const item = evidence[id];
                      if (!item) return null;
                      return (
                        <span key={id}>
                          {item.meaning}
                          {item.period ? <small>{item.period}</small> : null}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Fragment>
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
  evidence,
  onRequestPremium,
}: ForecastSectionBlockProps) {
  const [expandedAnchorId, setExpandedAnchorId] = useState<string | null>(null);
  const isOverview = section.kind === 'overview';
  const title = isOverview
    ? overviewTitle(period, language)
    : section.title?.trim();
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
          <h2 className="forecast-feed-section-title">{title}</h2>
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
          renderTextWithAnchors(
            section,
            evidence,
            expandedAnchorId,
            (anchorId) => {
              setExpandedAnchorId((current) => (
                current === anchorId ? null : anchorId
              ));
            },
            language,
          )
        )}
        {children}
      </div>
    </section>
  );
}
