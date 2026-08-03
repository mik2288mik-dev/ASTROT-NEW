import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search } from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  getApprovedPersonalForecastQuestions,
  type LocalizedPersonalForecastQuestion,
  type PersonalForecastQuestionPeriod,
} from '../../lib/personalForecastQuestionCatalog';
import {
  answerApprovedPersonalForecastQuestion,
  loadPersonalForecastQuestions,
  markPersonalForecastQuestionAnswerRead,
  retryPersonalForecastQuestion,
  submitCustomPersonalForecastQuestion,
  type PersonalForecastQuestionClientRecord,
  type PersonalForecastQuestionNotification,
  type PersonalForecastQuestionSnapshot,
} from '../../services/personalForecastQuestionService';
import { ForecastBottomSheet } from './ForecastBottomSheet';

type ForecastQuestionsProps = {
  profile: UserProfile;
  chartId?: number | null;
  contextFingerprint: string;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  premium: boolean;
  focusNotification?: PersonalForecastQuestionNotification | null;
  onRequestPremium: () => void;
  onUnreadChange: (notifications: PersonalForecastQuestionNotification[]) => void;
  onFocusConsumed: () => void;
};

type QuestionRequestToken = {
  contextIdentity: string;
  sequence: number;
};

function statusLabel(
  record: PersonalForecastQuestionClientRecord,
  language: 'ru' | 'en',
): string {
  if (record.status === 'answered') {
    if (record.notificationUnread) {
      return language === 'ru' ? 'Есть ответ' : 'Answered';
    }
    return language === 'ru' ? 'Просмотрено' : 'Viewed';
  }
  return language === 'ru' ? 'На модерации' : 'Under review';
}

function periodLabel(
  record: PersonalForecastQuestionClientRecord,
  language: 'ru' | 'en',
): string {
  if (record.period === 'day') {
    const date = new Date(`${record.periodKey}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'long',
      }).format(date);
    }
  }
  const labels = language === 'ru'
    ? { week: 'Неделя', month: 'Месяц' }
    : { week: 'Week', month: 'Month' };
  return `${labels[record.period as keyof typeof labels] || record.period} · ${record.periodKey}`;
}

export function ForecastQuestions({
  profile,
  chartId,
  contextFingerprint,
  period,
  periodKey,
  premium,
  focusNotification,
  onRequestPremium,
  onUnreadChange,
  onFocusConsumed,
}: ForecastQuestionsProps) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const [snapshot, setSnapshot] = useState<PersonalForecastQuestionSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedAnswer, setSelectedAnswer] =
    useState<PersonalForecastQuestionClientRecord | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const activeMutationRef = useRef<number | null>(null);

  const context = useMemo(() => ({
    profile,
    chartId,
    chartFingerprint: contextFingerprint,
    period,
    periodKey,
  }), [chartId, contextFingerprint, period, periodKey, profile]);
  const contextIdentity = useMemo(() => [
    String(profile.id || ''),
    chartId ?? 'primary',
    contextFingerprint,
    period,
    periodKey,
    language,
  ].join('|'), [
    chartId,
    contextFingerprint,
    language,
    period,
    periodKey,
    profile.id,
  ]);
  const contextIdentityRef = useRef(contextIdentity);
  contextIdentityRef.current = contextIdentity;

  const beginRequest = useCallback((): QuestionRequestToken => ({
    contextIdentity,
    sequence: ++requestSequenceRef.current,
  }), [contextIdentity]);

  const isRequestCurrent = useCallback((request: QuestionRequestToken): boolean => (
    contextIdentityRef.current === request.contextIdentity
    && requestSequenceRef.current === request.sequence
  ), []);

  const refresh = useCallback(async () => {
    if (!premium || activeMutationRef.current !== null) return null;
    const request = beginRequest();
    try {
      const next = await loadPersonalForecastQuestions(context);
      if (!isRequestCurrent(request)) return null;
      setSnapshot(next);
      onUnreadChange(next.unreadNotifications);
      return next;
    } catch (requestError) {
      if (isRequestCurrent(request)) throw requestError;
      return null;
    }
  }, [beginRequest, context, isRequestCurrent, onUnreadChange, premium]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    activeMutationRef.current = null;
    setSnapshot(null);
    setError(null);
    setQuery('');
    setExpanded(false);
    setCatalogOpen(false);
    setHistoryOpen(false);
    setBusyKey(null);
    setSelectedAnswer(null);
    if (!premium) {
      onUnreadChange([]);
      return;
    }
    void refresh().catch(() => {
      setError(language === 'ru'
        ? 'Не удалось загрузить вопросы.'
        : 'Could not load questions.');
    });
  }, [
    contextIdentity,
    language,
    onUnreadChange,
    period,
    periodKey,
    premium,
    refresh,
  ]);

  useEffect(() => {
    if (!premium || !snapshot || busyKey) return;
    const needsRefresh = snapshot.questions.some(
      (question) => question.status === 'pending'
        || question.status === 'approved'
        || question.isGenerating,
    );
    const timer = window.setTimeout(() => {
      void refresh().catch(() => undefined);
    }, needsRefresh ? 12_000 : 30_000);
    return () => window.clearTimeout(timer);
  }, [busyKey, premium, refresh, snapshot]);

  useEffect(() => {
    if (!focusNotification || !premium) return;
    const request = beginRequest();
    onFocusConsumed();
    const targetContext = {
      profile,
      chartId,
      chartFingerprint: contextFingerprint,
      period: focusNotification.period,
      periodKey: focusNotification.periodKey,
    };
    void loadPersonalForecastQuestions(targetContext)
      .then(async (targetSnapshot) => {
        if (!isRequestCurrent(request)) return;
        const record = targetSnapshot.questions.find(
          (question) => question.id === focusNotification.questionId,
        );
        if (!record) return;
        setSelectedAnswer(record);
        if (!record.notificationUnread) return;
        const next = await markPersonalForecastQuestionAnswerRead({
          ...targetContext,
          questionRecordId: record.id,
        });
        if (!isRequestCurrent(request)) return;
        onUnreadChange(next.unreadNotifications);
        setSelectedAnswer((current) => current?.id === record.id
          ? { ...current, notificationUnread: false }
          : current);
        if (
          targetContext.period === period
          && targetContext.periodKey === periodKey
        ) {
          setSnapshot(next);
        }
      })
      .catch(() => undefined);
  }, [
    beginRequest,
    chartId,
    contextFingerprint,
    focusNotification,
    isRequestCurrent,
    onFocusConsumed,
    onUnreadChange,
    period,
    periodKey,
    premium,
    profile,
  ]);

  const catalog = useMemo(() => {
    return getApprovedPersonalForecastQuestions({
      language,
      period,
      query,
    });
  }, [language, period, query]);

  const applySnapshot = useCallback((
    next: PersonalForecastQuestionSnapshot,
    request?: QuestionRequestToken,
  ): boolean => {
    if (request && !isRequestCurrent(request)) return false;
    setSnapshot(next);
    onUnreadChange(next.unreadNotifications);
    if (next.question?.status === 'answered') {
      setSelectedAnswer(next.question);
    }
    return true;
  }, [isRequestCurrent, onUnreadChange]);

  const askCatalog = useCallback(async (
    question: LocalizedPersonalForecastQuestion,
  ) => {
    if (activeMutationRef.current !== null) return;
    const request = beginRequest();
    activeMutationRef.current = request.sequence;
    setBusyKey(question.id);
    setError(null);
    try {
      const next = await answerApprovedPersonalForecastQuestion({
        ...context,
        questionId: question.id,
      });
      applySnapshot(next, request);
    } catch (requestError: any) {
      if (isRequestCurrent(request)) {
        setError(requestError?.code?.includes('LIMIT')
          ? (language === 'ru'
            ? 'Лимит ответов на сегодня исчерпан.'
            : 'Today’s answer limit has been reached.')
          : (language === 'ru'
            ? 'Ответ не загрузился. Попробуй ещё раз.'
            : 'The answer did not load. Try again.'));
      }
    } finally {
      if (activeMutationRef.current === request.sequence) {
        activeMutationRef.current = null;
        setBusyKey(null);
      }
    }
  }, [
    applySnapshot,
    beginRequest,
    context,
    isRequestCurrent,
    language,
  ]);

  const submitCustom = useCallback(async () => {
    const question = query.trim();
    if (!question || activeMutationRef.current !== null) return;
    const request = beginRequest();
    activeMutationRef.current = request.sequence;
    setBusyKey('custom');
    setError(null);
    try {
      const next = await submitCustomPersonalForecastQuestion({
        ...context,
        question,
      });
      const applied = applySnapshot(next, request);
      if (applied && next.moderation?.status !== 'rejected') {
        setQuery('');
        setCatalogOpen(false);
      }
    } catch (requestError: any) {
      if (isRequestCurrent(request)) {
        setError(requestError?.code?.includes('CUSTOM')
          ? (language === 'ru'
            ? 'Три своих вопроса на сегодня уже использованы.'
            : 'All three custom questions for today have been used.')
          : (language === 'ru'
            ? 'Не удалось отправить вопрос.'
            : 'Could not submit the question.'));
      }
    } finally {
      if (activeMutationRef.current === request.sequence) {
        activeMutationRef.current = null;
        setBusyKey(null);
      }
    }
  }, [
    applySnapshot,
    beginRequest,
    context,
    isRequestCurrent,
    language,
    query,
  ]);

  const openRecord = useCallback((
    record: PersonalForecastQuestionClientRecord,
  ) => {
    setSelectedAnswer(record);
    if (!record.notificationUnread) return;
    const request = beginRequest();
    void markPersonalForecastQuestionAnswerRead({
      ...context,
      questionRecordId: record.id,
    }).then((next) => applySnapshot(next, request)).catch(() => undefined);
  }, [applySnapshot, beginRequest, context]);

  const retryRecord = useCallback(async (
    record: PersonalForecastQuestionClientRecord,
  ) => {
    if (activeMutationRef.current !== null) return;
    const request = beginRequest();
    activeMutationRef.current = request.sequence;
    setBusyKey(`record:${record.id}`);
    setError(null);
    try {
      applySnapshot(await retryPersonalForecastQuestion({
        ...context,
        questionRecordId: record.id,
      }), request);
    } catch {
      if (isRequestCurrent(request)) {
        setError(language === 'ru'
          ? 'Повторная загрузка не удалась.'
          : 'Retry failed.');
      }
    } finally {
      if (activeMutationRef.current === request.sequence) {
        activeMutationRef.current = null;
        setBusyKey(null);
      }
    }
  }, [
    applySnapshot,
    beginRequest,
    context,
    isRequestCurrent,
    language,
  ]);

  return (
    <section
      id="forecast-questions"
      className={`forecast-feed-questions${premium ? '' : ' is-locked'}`}
    >
      <button
        type="button"
        className="forecast-feed-questions-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>
          <strong>{language === 'ru' ? 'Вопросы по карте' : 'Chart questions'}</strong>
          <small>
            {premium
              ? (
                snapshot?.usage
                  ? (language === 'ru'
                    ? `Осталось ответов: ${snapshot.usage.answersRemaining}`
                    : `Answers left: ${snapshot.usage.answersRemaining}`)
                  : (language === 'ru' ? 'Считаем остаток лимита' : 'Checking the limit')
              )
              : (language === 'ru' ? 'Доступно с Premium' : 'Available with Premium')}
          </small>
        </span>
        <span>{expanded
          ? (language === 'ru' ? 'Свернуть' : 'Collapse')
          : (language === 'ru' ? 'Развернуть' : 'Expand')}</span>
      </button>

      {expanded ? (
        <div className="forecast-feed-questions-body">
          {!premium ? (
            <div className="forecast-feed-questions-lock">
              <p>
                {language === 'ru'
                  ? 'Ответ строится по этой карте и расчёту выбранного периода.'
                  : 'The answer is based on this chart and the selected period calculation.'}
              </p>
              <button
                type="button"
                className="forecast-feed-premium-cta"
                onClick={onRequestPremium}
              >
                {language === 'ru' ? 'Открыть вопросы' : 'Unlock questions'}
              </button>
            </div>
          ) : (
            <>
              <form
                className="forecast-question-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!catalog.length) void submitCustom();
                }}
              >
                <Search size={17} aria-hidden />
                <input
                  type="search"
                  value={query}
                  maxLength={320}
                  placeholder={language === 'ru'
                    ? 'Найди вопрос или напиши свой'
                    : 'Find a question or write your own'}
                  onFocus={() => setCatalogOpen(true)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCatalogOpen(true);
                  }}
                />
              </form>

              {catalogOpen ? (
                <div className="forecast-question-catalog">
                  {catalog.map((question) => (
                    <button
                      key={question.id}
                      type="button"
                      disabled={busyKey === question.id}
                      onClick={() => void askCatalog(question)}
                    >
                      <span>{question.text}</span>
                      <span aria-hidden>{busyKey === question.id ? '…' : '→'}</span>
                    </button>
                  ))}
                  {!catalog.length && query.trim() ? (
                    <button
                      type="button"
                      className="forecast-question-submit-custom"
                      disabled={busyKey === 'custom'}
                      onClick={() => void submitCustom()}
                    >
                      {busyKey === 'custom'
                        ? (language === 'ru' ? 'Отправляем' : 'Sending')
                        : (language === 'ru' ? 'Задать свой вопрос' : 'Ask your own question')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {snapshot?.moderation
                && (
                  snapshot.moderation.status === 'pending'
                  || snapshot.moderation.status === 'rejected'
                ) ? (
                  <div
                    className="forecast-question-suggestions"
                    role={snapshot.moderation.status === 'pending' ? 'status' : undefined}
                  >
                    <p>
                      {snapshot.moderation.status === 'pending'
                        ? (language === 'ru'
                          ? 'На модерации. Пока можно выбрать похожий готовый вопрос:'
                          : 'Under review. Meanwhile, choose a similar approved question:')
                        : (language === 'ru'
                          ? 'Попробуй близкий готовый вопрос:'
                          : 'Try a similar approved question:')}
                    </p>
                    {snapshot.moderation.suggestions.map((question) => (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => void askCatalog(question)}
                      >
                        {question.text}
                      </button>
                    ))}
                  </div>
                ) : null}

              {error ? (
                <p className="forecast-question-error" role="alert">{error}</p>
              ) : null}

              {snapshot?.questions.length ? (
                <div className="forecast-question-history">
                  <button
                    type="button"
                    className="forecast-question-history-toggle"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((current) => !current)}
                  >
                    <span>
                      {language === 'ru' ? 'Мои вопросы и ответы' : 'My questions and answers'}
                      {' · '}
                      {snapshot.questions.length}
                    </span>
                    <span aria-hidden>{historyOpen ? '−' : '+'}</span>
                  </button>
                  {historyOpen ? snapshot.questions.map((record) => (
                    <article
                      key={record.id}
                      id={`forecast-question-${record.id}`}
                      className={record.notificationUnread ? 'has-unread' : ''}
                    >
                      <button
                        type="button"
                        className="forecast-question-record-main"
                        disabled={record.status !== 'answered'}
                        onClick={() => openRecord(record)}
                      >
                        <span>{record.question}</span>
                        <small>
                          {periodLabel(record, language)}
                          {' · '}
                          {statusLabel(record, language)}
                        </small>
                      </button>
                      {record.canRetry ? (
                        <button
                          type="button"
                          className="forecast-question-retry"
                          disabled={busyKey === `record:${record.id}`}
                          onClick={() => void retryRecord(record)}
                        >
                          {language === 'ru' ? 'Повторить' : 'Retry'}
                        </button>
                      ) : null}
                    </article>
                  )) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <ForecastBottomSheet
        open={!!selectedAnswer}
        title={selectedAnswer?.question || ''}
        subtitle={selectedAnswer ? statusLabel(selectedAnswer, language) : undefined}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setSelectedAnswer(null)}
      >
        {selectedAnswer?.answer ? (
          <p className="forecast-question-answer">{selectedAnswer.answer}</p>
        ) : (
          <p className="forecast-question-answer is-pending">
            {selectedAnswer?.status === 'pending'
              ? (language === 'ru'
                ? 'Вопрос ждёт ручной проверки. После одобрения ответ появится здесь.'
                : 'This question is awaiting manual review. The answer will appear here after approval.')
              : (language === 'ru'
                ? 'Ответ готовится.'
                : 'The answer is being prepared.')}
          </p>
        )}
      </ForecastBottomSheet>
    </section>
  );
}
