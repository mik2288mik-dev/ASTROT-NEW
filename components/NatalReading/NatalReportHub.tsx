import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Bookmark, ChevronRight, Crown, LockKeyhole, Send } from 'lucide-react';
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
import {
  NATAL_REPORT_ANSWER_COUNT,
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
} from '../../lib/natalReading/reportCatalog';

function accessLabel(
  accessState: NatalTopicAccessState,
  language: 'ru' | 'en',
  premiumLoading: boolean,
): string {
  if (accessState === 'open') return language === 'ru' ? 'Открыто' : 'Open';
  if (accessState === 'premium') {
    if (premiumLoading) return language === 'ru' ? 'Готовим' : 'Preparing';
    return language === 'ru' ? 'Продолжение' : 'More';
  }
  return language === 'ru' ? 'Продолжение' : 'More';
}
type LegacyNatalReportHubProps = {
  mode?: 'legacy';
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

const LegacyNatalReportHub: React.FC<LegacyNatalReportHubProps> = ({
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

type CatalogOpenSource = 'section_grid' | 'continue' | 'history' | 'related_question' | 'paywall_return';

type CatalogNatalReportHubProps = {
  mode: 'catalog';
  language: 'ru' | 'en';
  categoryKey: NatalReportCategoryKey;
  categoryPack: NatalReportCategoryPack | null;
  categoryLoading: boolean;
  categoryError: string | null;
  selectedAnswerKey: NatalReportAnswerKey | null;
  answerOriginCategoryKey: NatalReportCategoryKey | null;
  selectedPreview: NatalReportCategoryPack['previews'][number] | null;
  selectedAnswer: NatalReportAnswer | null;
  answerLoading: boolean;
  answerError: string | null;
  isPremium: boolean;
  canPromotePremium: boolean;
  readAnswerKeys: ReadonlySet<NatalReportAnswerKey>;
  bookmarkedAnswerKeys: ReadonlySet<NatalReportAnswerKey>;
  recentAnswerKeys: readonly NatalReportAnswerKey[];
  totalReadCount: number;
  continueAnswerKey: NatalReportAnswerKey | null;
  focusRequestId: number;
  onOpenAnswer: (answerKey: NatalReportAnswerKey, source: CatalogOpenSource) => void;
  onBackToCategory: () => void;
  onRetryCategory: () => void;
  onRetryAnswer: () => void;
  onRequestPremium: (answerKey: NatalReportAnswerKey) => void;
  onToggleBookmark: (answerKey: NatalReportAnswerKey) => void;
  onContinue: () => void;
  onOpenQuestions?: () => void;
};

function categoryLabel(categoryKey: NatalReportCategoryKey, language: 'ru' | 'en'): string {
  return getNatalReportCategory(categoryKey)?.title[language]
    || (language === 'ru' ? 'Разбор' : 'Reading');
}

function lockedCategoryCopy(
  categoryKey: NatalReportCategoryKey,
  lockedCount: number,
  language: 'ru' | 'en',
): { title: string; body: string } {
  if (language === 'en') {
    const label = categoryLabel(categoryKey, language).toLocaleLowerCase();
    return {
      title: `${lockedCount} more answers about ${label}`,
      body: 'Open the questions you can already see, plus every related answer in the chart.',
    };
  }
  const copy: Record<NatalReportCategoryKey, { title: string; body: string }> = {
    main: {
      title: 'Вся карта целиком',
      body: 'Откроются все ответы о характере, любви, общении, работе и деньгах.',
    },
    character: {
      title: `Ещё ${lockedCount} ответов про характер`,
      body: 'Что раздражает, что быстро надоедает, где ты стоишь до конца и что делаешь, когда план ломается.',
    },
    love: {
      title: `Ещё ${lockedCount} ответов про любовь`,
      body: 'Кого ты выбираешь, что тебя отталкивает, почему можешь остыть и какой человек тебе подходит.',
    },
    communication: {
      title: `Ещё ${lockedCount} ответов про общение`,
      body: 'Как ты говоришь, переписываешься, споришь и что делаешь после ссоры.',
    },
    work: {
      title: `Ещё ${lockedCount} ответов про работу`,
      body: 'Как ты работаешь, можешь ли руководить, что быстро надоедает и подходит ли тебе своё дело.',
    },
    money: {
      title: `Ещё ${lockedCount} ответов про деньги`,
      body: 'Как ты тратишь, насколько готов рисковать и что важнее: доход, свобода или стабильность.',
    },
  };
  return copy[categoryKey];
}

function CatalogLoading({ language, compact = false }: { language: 'ru' | 'en'; compact?: boolean }) {
  return (
    <div className={`natal-catalog-loading${compact ? ' is-compact' : ''}`} role="status" aria-busy="true">
      <span className="sr-only">
        {language === 'ru' ? 'Загружаем твой разбор…' : 'Loading your reading…'}
      </span>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      {!compact ? <span aria-hidden="true" /> : null}
    </div>
  );
}

const CatalogNatalReportHub: React.FC<CatalogNatalReportHubProps> = ({
  language,
  categoryKey,
  categoryPack,
  categoryLoading,
  categoryError,
  selectedAnswerKey,
  answerOriginCategoryKey,
  selectedPreview,
  selectedAnswer,
  answerLoading,
  answerError,
  isPremium,
  canPromotePremium,
  readAnswerKeys,
  bookmarkedAnswerKeys,
  recentAnswerKeys,
  totalReadCount,
  continueAnswerKey,
  focusRequestId,
  onOpenAnswer,
  onBackToCategory,
  onRetryCategory,
  onRetryAnswer,
  onRequestPremium,
  onToggleBookmark,
  onContinue,
  onOpenQuestions,
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!selectedAnswerKey) return;
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.closest('.natal-catalog-detail')?.scrollIntoView({
      behavior: 'auto',
      block: 'start',
    });
  }, [focusRequestId, selectedAnswerKey]);

  const continueAnswer = continueAnswerKey ? getNatalReportAnswer(continueAnswerKey) : null;
  const selectedDefinition = selectedAnswerKey ? getNatalReportAnswer(selectedAnswerKey) : null;
  if (selectedAnswerKey && selectedDefinition) {
    const isFreeAnswer = isNatalReportAnswerFree(selectedAnswerKey);
    const canReadAnswer = isFreeAnswer || isPremium;
    const detailCategoryKey = selectedDefinition.categoryKey;
    const backCategoryKey = answerOriginCategoryKey || detailCategoryKey;
    const answerTitle = selectedAnswer?.title
      || selectedPreview?.title
      || selectedDefinition.title[language];
    const fullAnswerIncludes = selectedAnswer?.fullAnswerIncludes
      || selectedPreview?.fullAnswerIncludes
      || [...selectedDefinition.fullAnswerIncludes[language]];
    const relatedKeys = selectedAnswer?.related
      || selectedPreview?.related
      || selectedDefinition.related;
    const lockedCount = categoryPack?.previews.filter((preview) => (
      !isNatalReportAnswerFree(preview.answerKey)
    )).length || 0;
    const lockedCopy = lockedCategoryCopy(detailCategoryKey, lockedCount, language);
    const bookmarked = bookmarkedAnswerKeys.has(selectedAnswerKey);
    const answerPending = canReadAnswer
      && !selectedAnswer
      && !answerError
      && (answerLoading || selectedAnswer == null);

    return (
      <section className="natal-catalog-detail" aria-labelledby="natal-catalog-answer-title">
        <button type="button" className="natal-catalog-back" onClick={onBackToCategory}>
          <ArrowLeft aria-hidden="true" />
          {language === 'ru' ? `К теме «${categoryLabel(backCategoryKey, language)}»` : `Back to ${categoryLabel(backCategoryKey, language)}`}
        </button>

        <header className="natal-catalog-detail-heading">
          <div className="natal-catalog-detail-meta">
            <p>{categoryLabel(detailCategoryKey, language)}</p>
            {canReadAnswer && selectedAnswer ? (
              <button
                type="button"
                className={`natal-catalog-bookmark${bookmarked ? ' is-active' : ''}`}
                aria-pressed={bookmarked}
                aria-label={language === 'ru'
                  ? bookmarked ? 'Убрать ответ из сохранённых' : 'Сохранить ответ'
                  : bookmarked ? 'Remove saved answer' : 'Save answer'}
                onClick={() => onToggleBookmark(selectedAnswerKey)}
              >
                <Bookmark aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <h2 id="natal-catalog-answer-title" ref={headingRef} tabIndex={-1}>{answerTitle}</h2>
        </header>

        {canReadAnswer && selectedAnswer ? (
          <div className="natal-catalog-answer">
            {selectedAnswer.paragraphs.map((paragraph, index) => (
              <p key={`${selectedAnswer.answerKey}-${index}`} className={index === 0 ? 'is-lead' : undefined}>
                {paragraph.text}
              </p>
            ))}
          </div>
        ) : answerPending ? (
          <CatalogLoading language={language} />
        ) : canReadAnswer && answerError ? (
          <section className="natal-catalog-error" role="alert">
            <h3>{language === 'ru' ? 'Ответ не загрузился' : 'The answer did not load'}</h3>
            <p>{answerError}</p>
            <button type="button" onClick={onRetryAnswer}>
              {language === 'ru' ? 'Попробовать снова' : 'Try again'}
            </button>
          </section>
        ) : canReadAnswer ? (
          <section className="natal-catalog-error" role="status">
            <h3>{language === 'ru' ? 'Здесь пока пусто' : 'Nothing here yet'}</h3>
            <p>{language === 'ru'
              ? 'Обнови ответ. Если он не появится, открой соседний вопрос.'
              : 'Refresh the answer. If it stays empty, open a related question.'}</p>
            <button type="button" onClick={onRetryAnswer}>
              {language === 'ru' ? 'Обновить ответ' : 'Refresh answer'}
            </button>
          </section>
        ) : categoryLoading && !selectedPreview ? (
          <CatalogLoading language={language} compact />
        ) : (
          <section className="natal-catalog-locked" aria-labelledby="natal-catalog-locked-title">
            <p className="natal-catalog-locked-preview">
              {selectedPreview?.preview || (language === 'ru'
                ? 'Начало ответа уже готово. Полный текст откроется вместе со всей картой.'
                : 'The beginning is ready. The full text opens with the complete chart.')}
            </p>

            <div className="natal-catalog-includes">
              <p>{language === 'ru' ? 'В полном ответе' : 'In the full answer'}</p>
              <ul role="list">
                {fullAnswerIncludes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="natal-catalog-unlock">
              <h3 id="natal-catalog-locked-title">{lockedCopy.title}</h3>
              <p>{lockedCopy.body}</p>
              {canPromotePremium ? (
                <button
                  id={`natal-answer-unlock-${selectedAnswerKey}`}
                  type="button"
                  className="natal-catalog-unlock-button"
                  onClick={() => onRequestPremium(selectedAnswerKey)}
                >
                  {language === 'ru' ? 'Открыть всю карту' : 'Open the full chart'}
                </button>
              ) : null}
              <p className="natal-catalog-unlock-note">
                {language === 'ru'
                  ? `6 разделов · ${NATAL_REPORT_ANSWER_COUNT} ответов · один Premium для всего NEBO`
                  : `6 topics · ${NATAL_REPORT_ANSWER_COUNT} answers · one Premium across NEBO`}
              </p>
            </div>
          </section>
        )}

        {canReadAnswer && selectedAnswer ? (
          <section className="natal-catalog-related" aria-labelledby="natal-catalog-related-title">
            <h3 id="natal-catalog-related-title">
              {language === 'ru' ? `Ещё про «${categoryLabel(detailCategoryKey, language)}»` : `More about ${categoryLabel(detailCategoryKey, language)}`}
            </h3>
            <ul role="list">
              {relatedKeys.slice(0, onOpenQuestions ? 3 : 4).map((answerKey) => {
                const definition = getNatalReportAnswer(answerKey);
                if (!definition) return null;
                const locked = !isPremium && !isNatalReportAnswerFree(answerKey);
                return (
                  <li key={answerKey}>
                    <button type="button" onClick={() => onOpenAnswer(answerKey, 'related_question')}>
                      <span>{definition.title[language]}</span>
                      {locked ? <LockKeyhole aria-hidden="true" /> : null}
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              {onOpenQuestions ? (
                <li>
                  <button type="button" onClick={onOpenQuestions}>
                    <span>{language === 'ru' ? 'Задать свой вопрос' : 'Ask your own question'}</span>
                    <Send aria-hidden="true" />
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </section>
    );
  }

  if (categoryLoading && !categoryPack) return <CatalogLoading language={language} />;

  if (categoryError || !categoryPack) {
    return (
      <section className="natal-catalog-error natal-catalog-error--category" role="alert">
        <h2>{language === 'ru' ? 'Разбор не загрузился' : 'The reading did not load'}</h2>
        <p>{categoryError || (language === 'ru'
          ? 'Не получилось открыть эту тему. Попробуй ещё раз.'
          : 'This topic could not be opened. Try again.')}</p>
        <button type="button" onClick={onRetryCategory}>
          {language === 'ru' ? 'Попробовать снова' : 'Try again'}
        </button>
      </section>
    );
  }

  const readInCategory = categoryPack.previews.filter((preview) => (
    readAnswerKeys.has(preview.answerKey)
  )).length;

  return (
    <section className="natal-catalog-category" aria-labelledby="natal-catalog-category-title">
      {categoryKey === 'main' ? (
        <>
          <header className="natal-catalog-main-heading">
            <p>{language === 'ru' ? 'Твоя карта без лишних слов' : 'Your chart, straight to the point'}</p>
            <h2 id="natal-catalog-category-title" tabIndex={-1}>
              {language === 'ru' ? 'Самое главное' : 'The main point'}
            </h2>
          </header>
          <div className="natal-catalog-summary">
            {categoryPack.summary.map((statement, index) => (
              <p key={`summary-${index}`}>{statement.text}</p>
            ))}
          </div>

          <section className="natal-catalog-observations" aria-labelledby="natal-catalog-observations-title">
            <h3 id="natal-catalog-observations-title">
              {language === 'ru' ? 'Пять вещей, которые особенно заметны' : 'Five things that stand out'}
            </h3>
            <ul role="list">
              {categoryPack.observations.map((statement, index) => (
                <li key={`observation-${index}`}>{statement.text}</li>
              ))}
            </ul>
          </section>

          {continueAnswer ? (
            <button type="button" className="natal-catalog-continue" onClick={onContinue}>
              <span>
                <span>{language === 'ru' ? 'Продолжить чтение' : 'Continue reading'}</span>
                <strong>{categoryLabel(continueAnswer.categoryKey, language)}</strong>
                <small>{language === 'ru'
                  ? `Прочитано ${totalReadCount} из ${NATAL_REPORT_ANSWER_COUNT} ответов`
                  : `${totalReadCount} of ${NATAL_REPORT_ANSWER_COUNT} answers read`}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}

          {bookmarkedAnswerKeys.size > 0 || recentAnswerKeys.length > 0 ? (
            <div className="natal-catalog-library">
              {bookmarkedAnswerKeys.size > 0 ? (
                <section aria-labelledby="natal-catalog-saved-title">
                  <h3 id="natal-catalog-saved-title">
                    {language === 'ru' ? 'Сохранённое' : 'Saved'}
                  </h3>
                  <ul role="list">
                    {[...bookmarkedAnswerKeys].reverse().slice(0, 4).map((answerKey) => {
                      const definition = getNatalReportAnswer(answerKey);
                      if (!definition) return null;
                      return (
                        <li key={answerKey}>
                          <button type="button" onClick={() => onOpenAnswer(answerKey, 'history')}>
                            <span>
                              <strong>{definition.title[language]}</strong>
                              <small>{categoryLabel(definition.categoryKey, language)}</small>
                            </span>
                            <ChevronRight aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
              {recentAnswerKeys.length > 0 ? (
                <section aria-labelledby="natal-catalog-recent-title">
                  <h3 id="natal-catalog-recent-title">
                    {language === 'ru' ? 'Недавно открыто' : 'Recently opened'}
                  </h3>
                  <ul role="list">
                    {recentAnswerKeys.slice(0, 4).map((answerKey) => {
                      const definition = getNatalReportAnswer(answerKey);
                      if (!definition) return null;
                      return (
                        <li key={answerKey}>
                          <button type="button" onClick={() => onOpenAnswer(answerKey, 'history')}>
                            <span>
                              <strong>{definition.title[language]}</strong>
                              <small>{categoryLabel(definition.categoryKey, language)}</small>
                            </span>
                            <ChevronRight aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <header className="natal-catalog-category-heading">
          <h2 id="natal-catalog-category-title" tabIndex={-1}>{categoryPack.title}</h2>
          <p>{language === 'ru'
            ? `Прочитано ${readInCategory} из ${categoryPack.previews.length} ответов`
            : `${readInCategory} of ${categoryPack.previews.length} answers read`}</p>
        </header>
      )}

      <section className="natal-catalog-list-section" aria-labelledby="natal-catalog-list-title">
        <h3 id="natal-catalog-list-title">
          {categoryKey === 'main'
            ? language === 'ru' ? 'Что ещё открыть' : 'What else to open'
            : language === 'ru' ? 'Выбери вопрос' : 'Choose a question'}
        </h3>
        {categoryPack.previews.length > 0 ? (
          <ul className="natal-catalog-list" role="list">
            {categoryPack.previews.map((preview) => {
              const locked = !isPremium && !isNatalReportAnswerFree(preview.answerKey);
              return (
                <li key={preview.answerKey}>
                  <button
                    id={`natal-catalog-row-${preview.answerKey}`}
                    type="button"
                    data-natal-answer-key={preview.answerKey}
                    aria-label={`${preview.title}${locked
                      ? language === 'ru' ? ', закрыто' : ', locked'
                      : ''}`}
                    onClick={() => onOpenAnswer(preview.answerKey, 'section_grid')}
                  >
                    <span className="natal-catalog-row-copy">
                      <strong>{preview.title}</strong>
                      <span>{preview.preview}</span>
                    </span>
                    {locked ? <LockKeyhole className="natal-catalog-row-lock" aria-hidden="true" /> : null}
                    <ChevronRight className="natal-catalog-row-arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="natal-catalog-empty" role="status">
            <p>{language === 'ru'
              ? 'В этой теме пока нет ответов. Обнови раздел.'
              : 'There are no answers in this topic yet. Refresh it.'}</p>
            <button type="button" onClick={onRetryCategory}>
              {language === 'ru' ? 'Обновить раздел' : 'Refresh topic'}
            </button>
          </div>
        )}
      </section>
    </section>
  );
};

type NatalReportHubProps = LegacyNatalReportHubProps | CatalogNatalReportHubProps;

export const NatalReportHub: React.FC<NatalReportHubProps> = (props) => {
  if (props.mode === 'catalog') {
    return <CatalogNatalReportHub {...props} />;
  }
  return <LegacyNatalReportHub {...props} />;
};
