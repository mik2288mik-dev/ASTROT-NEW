import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search, Send } from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  getApprovedPersonalForecastQuestions,
  type LocalizedPersonalForecastQuestion,
  type PersonalForecastQuestionPeriod,
  type PersonalForecastQuestionTheme,
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
  onSelectPeriod: (period: PersonalForecastQuestionPeriod) => void;
  onUnreadChange: (notifications: PersonalForecastQuestionNotification[]) => void;
  onFocusConsumed: () => void;
};

type QuestionRequestToken = {
  contextIdentity: string;
  sequence: number;
};

const PERIODS: PersonalForecastQuestionPeriod[] = ['day', 'week', 'month', 'year'];

const THEME_LABELS: Record<
  'ru' | 'en',
  Record<PersonalForecastQuestionTheme, string>
> = {
  ru: {
    daily: 'Главное',
    relationships: 'Отношения',
    family: 'Семья',
    friends: 'Друзья',
    career: 'Карьера',
    profession: 'Профессия',
    work_environment: 'Работа',
    it: 'IT',
    business: 'Бизнес',
    money: 'Деньги',
    relocation: 'Переезд',
    decisions: 'Решения',
    future: 'Будущее',
    strengths: 'Сильные стороны',
  },
  en: {
    daily: 'Main',
    relationships: 'Relationships',
    family: 'Family',
    friends: 'Friends',
    career: 'Career',
    profession: 'Profession',
    work_environment: 'Work',
    it: 'IT',
    business: 'Business',
    money: 'Money',
    relocation: 'Relocation',
    decisions: 'Decisions',
    future: 'Future',
    strengths: 'Strengths',
  },
};

const PERIOD_LABELS: Record<
  'ru' | 'en',
  Record<PersonalForecastQuestionPeriod, string>
> = {
  ru: { day: 'Сегодня', week: 'Неделя', month: 'Месяц', year: 'Год' },
  en: { day: 'Today', week: 'Week', month: 'Month', year: 'Year' },
};

function statusLabel(
  record: PersonalForecastQuestionClientRecord,
  language: 'ru' | 'en',
): string {
  if (record.status === 'answered') {
    return language === 'ru' ? 'Ответ готов' : 'Answered';
  }
  if (record.status === 'pending') {
    return language === 'ru' ? 'На проверке' : 'Pending review';
  }
  if (record.status === 'rejected') {
    return language === 'ru' ? 'Нужна другая формулировка' : 'Try another wording';
  }
  if (record.isGenerating) {
    return language === 'ru' ? 'Одобрен — готовим ответ' : 'Approved — preparing answer';
  }
  return language === 'ru' ? 'Одобрен' : 'Approved';
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
  onSelectPeriod,
  onUnreadChange,
  onFocusConsumed,
}: ForecastQuestionsProps) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const [snapshot, setSnapshot] = useState<PersonalForecastQuestionSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<PersonalForecastQuestionTheme | 'all'>('all');
  const [customQuestion, setCustomQuestion] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
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
    setTheme('all');
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
    const source = getApprovedPersonalForecastQuestions({
      language,
      period,
      query,
      themes: theme === 'all' ? undefined : [theme],
    });
    return source;
  }, [language, period, query, theme]);

  const visibleThemes = useMemo(() => {
    const values = new Set<PersonalForecastQuestionTheme>();
    getApprovedPersonalForecastQuestions({ language, period })
      .forEach((question) => values.add(question.theme));
    return [...values];
  }, [language, period]);

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
    const question = customQuestion.trim();
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
        setCustomQuestion('');
        setCustomOpen(false);
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
    customQuestion,
    isRequestCurrent,
    language,
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
      <div className="forecast-feed-questions-heading">
        <p className="forecast-feed-questions-kicker">
          {language === 'ru' ? 'Вопросы к периоду' : 'Questions for this period'}
        </p>
        <h2>
          {language === 'ru'
            ? 'Спроси о том, что важно сейчас'
            : 'Ask about what matters now'}
        </h2>
      </div>

      {!premium ? (
        <div className="forecast-feed-questions-lock">
          <p>
            {language === 'ru'
              ? 'Ответ строится по этой карте и расчёту периода.'
              : 'The answer is based on this chart and period calculation.'}
          </p>
          <button
            type="button"
            className="forecast-feed-premium-cta"
            onClick={onRequestPremium}
          >
            <span aria-hidden>✦</span>
            {language === 'ru' ? 'Открыть вопросы' : 'Unlock questions'}
          </button>
        </div>
      ) : (
        <>
          <div
            className="forecast-question-periods"
            role="tablist"
            aria-label={language === 'ru' ? 'Период вопроса' : 'Question period'}
          >
            {PERIODS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={item === period}
                className={item === period ? 'is-active' : ''}
                onClick={() => onSelectPeriod(item)}
              >
                {PERIOD_LABELS[language][item]}
              </button>
            ))}
          </div>

          <label className="forecast-question-search">
            <Search size={17} aria-hidden />
            <input
              type="search"
              value={query}
              placeholder={language === 'ru'
                ? 'Найти вопрос'
                : 'Search questions'}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="forecast-question-themes" aria-label={language === 'ru' ? 'Темы' : 'Themes'}>
            <button
              type="button"
              className={theme === 'all' ? 'is-active' : ''}
              onClick={() => setTheme('all')}
            >
              {language === 'ru' ? 'Все' : 'All'}
            </button>
            {visibleThemes.map((item) => (
              <button
                key={item}
                type="button"
                className={theme === item ? 'is-active' : ''}
                onClick={() => setTheme(item)}
              >
                {THEME_LABELS[language][item]}
              </button>
            ))}
          </div>

          {snapshot?.usage ? (
            <p className="forecast-question-usage">
              {language === 'ru'
                ? `Ответов сегодня: ${snapshot.usage.answersRemaining} из ${snapshot.usage.answerLimit} · своих вопросов: ${snapshot.usage.customRemaining} из ${snapshot.usage.customLimit}`
                : `Answers today: ${snapshot.usage.answersRemaining} of ${snapshot.usage.answerLimit} · custom questions: ${snapshot.usage.customRemaining} of ${snapshot.usage.customLimit}`}
            </p>
          ) : null}

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
            {!catalog.length ? (
              <p>
                {language === 'ru'
                  ? 'По этому запросу вопросов нет.'
                  : 'No questions match this search.'}
              </p>
            ) : null}
          </div>

          <div className="forecast-question-custom">
            <button
              type="button"
              className="forecast-question-custom-toggle"
              onClick={() => setCustomOpen((current) => !current)}
            >
              {language === 'ru' ? 'Задать свой вопрос' : 'Ask your own question'}
            </button>
            {customOpen ? (
              <div className="forecast-question-custom-form">
                <textarea
                  value={customQuestion}
                  maxLength={320}
                  placeholder={language === 'ru'
                    ? 'О чём ты хочешь спросить в рамках этого периода?'
                    : 'What do you want to ask about this period?'}
                  onChange={(event) => setCustomQuestion(event.target.value)}
                />
                <button
                  type="button"
                  disabled={!customQuestion.trim() || busyKey === 'custom'}
                  onClick={() => void submitCustom()}
                >
                  <Send size={16} aria-hidden />
                  {busyKey === 'custom'
                    ? (language === 'ru' ? 'Отправляем' : 'Sending')
                    : (language === 'ru' ? 'Отправить' : 'Submit')}
                </button>
              </div>
            ) : null}
          </div>

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
                      ? 'Вопрос отправлен на модерацию. Пока можно выбрать похожий одобренный вопрос:'
                      : 'Your question was sent for review. Meanwhile, you can choose a similar approved question:')
                    : (language === 'ru'
                      ? 'Попробуй близкий одобренный вопрос:'
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
              <h3>{language === 'ru' ? 'Вопросы этого периода' : 'Questions for this period'}</h3>
              {snapshot.questions.map((record) => (
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
                    <small>{statusLabel(record, language)}</small>
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
              ))}
            </div>
          ) : null}
        </>
      )}

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
