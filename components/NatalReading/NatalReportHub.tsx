import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ChevronRight, Crown, LockKeyhole, Send } from 'lucide-react';
import type {
  NatalPermanentFreeReport,
  NatalPermanentPremiumReport,
} from '../../lib/natalReading/permanentReport';
import {
  buildNatalReportTopics,
  type NatalTopicAccessState,
  type NatalTopicContent,
  type NatalTopicKey,
} from '../../lib/natalReading/reportTopics';
import { FormattedAiText } from '../ui/FormattedAiText';

function accessLabel(
  accessState: NatalTopicAccessState,
  language: 'ru' | 'en',
  premiumLoading: boolean,
): string {
  if (accessState === 'open') return language === 'ru' ? 'Открыто' : 'Open';
  if (accessState === 'premium') {
    if (premiumLoading) return language === 'ru' ? 'Готовим' : 'Preparing';
    return 'Premium';
  }
  return 'Premium';
}

type NatalReportHubProps = {
  language: 'ru' | 'en';
  report: NatalPermanentFreeReport;
  premiumReport: NatalPermanentPremiumReport | null;
  isPremium: boolean;
  premiumLoading: boolean;
  premiumError: string | null;
  canPromotePremium: boolean;
  selectedTopicKey: NatalTopicKey | null;
  focusRequestId: number;
  onSelectTopic: (topic: NatalTopicContent, source: 'section_grid' | 'continue') => void;
  onBackToTopics: () => void;
  onRequestPremium: (topicKey: NatalTopicKey) => void;
  onRetryPremium: () => void;
  onOpenQuestions?: () => void;
  renderEvidence?: (evidenceIds: string[]) => React.ReactNode;
};

export const NatalReportHub: React.FC<NatalReportHubProps> = ({
  language,
  report,
  premiumReport,
  isPremium,
  premiumLoading,
  premiumError,
  canPromotePremium,
  selectedTopicKey,
  focusRequestId,
  onSelectTopic,
  onBackToTopics,
  onRequestPremium,
  onRetryPremium,
  onOpenQuestions,
  renderEvidence,
}) => {
  const topics = useMemo(() => buildNatalReportTopics({
    language,
    report,
    premiumReport,
    isPremium,
  }), [isPremium, language, premiumReport, report]);
  const selectedTopic = selectedTopicKey
    ? topics.find((topic) => topic.key === selectedTopicKey) || null
    : null;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!selectedTopic) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focusRequestId, selectedTopic?.key]);

  if (!selectedTopic) {
    return (
      <section className="natal-topic-hub" aria-labelledby="natal-topic-hub-title">
        <header className="natal-topic-hub-heading">
          <p>{language === 'ru' ? 'Твоя карта по темам' : 'Your chart by topic'}</p>
          <h2 id="natal-topic-hub-title" tabIndex={-1}>
            {language === 'ru' ? 'Что ещё узнать о себе' : 'What else to learn about yourself'}
          </h2>
        </header>
        <ul className="natal-topic-grid" role="list">
          {topics.map((topic) => (
            <li key={topic.key}>
              <button
                type="button"
                className="natal-topic-card"
                onClick={() => onSelectTopic(topic, 'section_grid')}
              >
                <span className="natal-topic-card-meta">
                  {topic.accessState === 'locked' ? <LockKeyhole aria-hidden="true" /> : null}
                  {accessLabel(topic.accessState, language, premiumLoading)}
                </span>
                <span className="natal-topic-card-title">{topic.title}</span>
                <span id={`natal-topic-description-${topic.key}`} className="natal-topic-card-description">
                  {topic.description}
                </span>
                <ChevronRight className="natal-topic-card-arrow" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const canReadTopic = selectedTopic.accessState !== 'locked';
  const relatedTopicKeys = [
    ...selectedTopic.related,
    ...topics.map((topic) => topic.key),
  ].filter((key, index, keys) => key !== selectedTopic.key && keys.indexOf(key) === index);
  const relatedTopics = relatedTopicKeys
    .map((key) => topics.find((topic) => topic.key === key))
    .filter((topic): topic is NatalTopicContent => topic != null)
    .slice(0, onOpenQuestions ? 3 : 4);
  const contentReady = selectedTopic.paragraphs.length > 0;
  const canOfferExplicitUnlock = !isPremium
    && (canPromotePremium || selectedTopic.accessState === 'locked');

  return (
    <section
      id={`natal-topic-${selectedTopic.key}`}
      className="natal-topic-detail"
      aria-labelledby="natal-topic-detail-title"
    >
      <button type="button" className="natal-topic-back" onClick={onBackToTopics}>
        <ArrowLeft aria-hidden="true" />
        {language === 'ru' ? 'Все разделы' : 'All topics'}
      </button>

      <header className="natal-topic-detail-heading">
        <p>{language === 'ru' ? 'Натальная карта' : 'Natal chart'}</p>
        <h2 id="natal-topic-detail-title" ref={headingRef} tabIndex={-1}>{selectedTopic.title}</h2>
      </header>

      {canReadTopic && contentReady ? (
        <div className="natal-topic-reading">
          {selectedTopic.paragraphs.map((paragraph, index) => (
            <FormattedAiText
              key={`${selectedTopic.key}-${index}`}
              text={paragraph.text}
              className="natal-topic-reading-text"
              paragraphClassName="natal-topic-reading-paragraph"
            />
          ))}
          {renderEvidence?.(selectedTopic.evidenceIds)}
        </div>
      ) : canReadTopic && premiumLoading ? (
        <div className="natal-topic-loading" role="status" aria-busy="true">
          <span className="sr-only">
            {language === 'ru' ? 'Готовим этот раздел…' : 'Preparing this topic…'}
          </span>
          <span className="natal-topic-loading-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : canReadTopic && premiumError ? (
        <section className="natal-topic-error" role="alert">
          <p>{premiumError}</p>
          <button type="button" onClick={onRetryPremium}>
            {language === 'ru' ? 'Повторить загрузку' : 'Try loading again'}
          </button>
        </section>
      ) : canReadTopic ? (
        <div className="natal-topic-unavailable">
          {language === 'ru'
            ? 'Для этой карты отдельный текст по теме не сформировался. Открой одну из тем ниже.'
            : 'This chart has no separate reading for this topic. Open one of the topics below.'}
        </div>
      ) : (
        <section
          className="natal-topic-locked"
          aria-labelledby={canOfferExplicitUnlock ? 'natal-topic-locked-title' : undefined}
        >
          <p className="natal-topic-locked-preview">{selectedTopic.description}</p>
          {canOfferExplicitUnlock ? (
            <div className="natal-topic-unlock">
              <p>{language === 'ru' ? 'Ещё по твоей карте' : 'More from your chart'}</p>
              <h3 id="natal-topic-locked-title">
                {language === 'ru'
                  ? 'Открой отношения, работу, решения и сложные ситуации'
                  : 'Open relationships, work, decisions, and difficult situations'}
              </h3>
              <button
                id={`natal-topic-premium-${selectedTopic.key}`}
                type="button"
                className="natal-topic-premium-button"
                onClick={() => onRequestPremium(selectedTopic.key)}
              >
                <Crown aria-hidden="true" />
                {language === 'ru' ? 'Открыть все разделы' : 'Open every topic'}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {canReadTopic ? (
        <section className="natal-topic-next" aria-labelledby="natal-topic-next-title">
          <h3 id="natal-topic-next-title">
            {language === 'ru' ? 'Что открыть дальше' : 'What to open next'}
          </h3>
          <ul role="list">
            {relatedTopics.map((topic) => (
              <li key={topic.key}>
                <button type="button" onClick={() => onSelectTopic(topic, 'continue')}>
                  <span>{topic.title}</span>
                  {topic.accessState === 'locked' ? (
                    <span className="natal-topic-next-access">Premium</span>
                  ) : null}
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            ))}
            {onOpenQuestions ? (
              <li>
                <button type="button" onClick={onOpenQuestions}>
                  <span>{language === 'ru' ? 'Задать вопрос по своей карте' : 'Ask a question about your chart'}</span>
                  <Send aria-hidden="true" />
                </button>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </section>
  );
};
