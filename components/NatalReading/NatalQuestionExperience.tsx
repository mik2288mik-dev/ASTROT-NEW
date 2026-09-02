import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import { hasActivePremium } from '../../lib/accessMatrix';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import type { PaywallContext } from '../../lib/paywallContext';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../../lib/natalReading/natalQuestionStore';
import {
  getNatalReportCategory,
  type NatalReportCategoryKey,
} from '../../lib/natalReading/reportCatalog';
import { normalizePersonalForecastQuestionInput } from '../../lib/personalForecastQuestionModeration';
import {
  askNatalQuestion,
  loadNatalQuestionSnapshot,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { recordUserAppEvent } from '../../services/sessionService';
import { FormattedAiText } from '../ui/FormattedAiText';
import {
  NatalEvidenceSheet,
  type NatalExplanationTarget,
} from './NatalEvidenceSheet';

const QUESTION_CONTEXTS = [
  'main',
  'character',
  'love',
  'communication',
  'work',
  'money',
] as const satisfies readonly NatalReportCategoryKey[];

const QUESTION_STARTERS: Record<NatalReportCategoryKey, {
  ru: readonly string[];
  en: readonly string[];
}> = {
  main: {
    ru: [
      'Как я принимаю важные решения?',
      'Почему я могу резко потерять интерес?',
      'Что во мне люди понимают не сразу?',
      'Какая моя сильная сторона чаще всего помогает?',
    ],
    en: [
      'How do I make important decisions?',
      'Why can I suddenly lose interest?',
      'What do people not understand about me at first?',
      'Which of my strengths helps me most often?',
    ],
  },
  character: {
    ru: [
      'Почему я иногда меняю решение в последний момент?',
      'Что меня раздражает быстрее всего?',
      'Почему мне быстро становится скучно?',
      'Что я делаю, когда план ломается?',
    ],
    en: [
      'Why do I sometimes change a decision at the last moment?',
      'What irritates me fastest?',
      'Why do I get bored quickly?',
      'What do I do when a plan falls apart?',
    ],
  },
  love: {
    ru: [
      'Какие люди мне обычно нравятся?',
      'Как я показываю, что человек мне интересен?',
      'Почему я могу быстро отдалиться?',
      'Какой человек мне действительно подходит?',
    ],
    en: [
      'Which people do I usually like?',
      'How do I show that someone interests me?',
      'Why can I pull away quickly?',
      'What kind of person really fits me?',
    ],
  },
  communication: {
    ru: [
      'Какое первое впечатление я создаю?',
      'Почему меня иногда понимают неправильно?',
      'Как я веду себя в ссоре?',
      'Почему мне бывает трудно попросить о помощи?',
    ],
    en: [
      'What first impression do I create?',
      'Why am I sometimes misunderstood?',
      'How do I act during an argument?',
      'Why can asking for help be difficult for me?',
    ],
  },
  work: {
    ru: [
      'Какая работа мне быстро надоедает?',
      'Мне легче работать одному или с людьми?',
      'Как я веду себя под давлением сроков?',
      'Подходит ли мне своё дело?',
    ],
    en: [
      'What kind of work bores me quickly?',
      'Do I work better alone or with people?',
      'How do I act under deadline pressure?',
      'Would running my own business fit me?',
    ],
  },
  money: {
    ru: [
      'Я скорее коплю или трачу?',
      'Как я принимаю крупные денежные решения?',
      'Насколько я готов рисковать деньгами?',
      'Почему мне бывает трудно назвать цену своей работе?',
    ],
    en: [
      'Am I more likely to save or spend?',
      'How do I make large financial decisions?',
      'How willing am I to take financial risks?',
      'Why can naming a price for my work be difficult?',
    ],
  },
};

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  contextCategory: NatalReportCategoryKey;
  onContextChange: (categoryKey: NatalReportCategoryKey) => void;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
};

type QuestionPair = {
  question: NatalQuestionStoredMessage;
  answer: NatalQuestionStoredMessage | null;
};

function questionMessageEvidenceIds(message: NatalQuestionStoredMessage): string[] {
  const value = message.payload?.evidenceIds || message.payload?.evidence_ids;
  return Array.isArray(value)
    ? [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
}

function buildQuestionPairs(messages: readonly NatalQuestionStoredMessage[]): QuestionPair[] {
  const answersByQuestionId = new Map<string, NatalQuestionStoredMessage>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const questionId = String(message.payload?.questionMessageId || '').trim();
    if (questionId) answersByQuestionId.set(questionId, message);
  }
  return messages
    .filter((message) => message.role === 'user')
    .map((question) => ({
      question,
      answer: answersByQuestionId.get(String(question.id)) || null,
    }));
}

function formatQuestionError(error: unknown, language: 'ru' | 'en'): string {
  const value = error as HumanReadingError;
  if (value?.code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Эта часть пока закрыта. Открой вопросы, чтобы продолжить.'
      : 'This part is locked for now. Open questions to continue.';
  }
  if (value?.code === 'FREE_NATAL_QUESTION_USED') {
    return language === 'ru'
      ? 'Первый вопрос уже использован. Открой вопросы, чтобы продолжить.'
      : 'Your first question has been used. Open questions to continue.';
  }
  if (value?.code === 'NATAL_QUESTION_DAILY_LIMIT') {
    return language === 'ru'
      ? 'На сегодня вопросы закончились. Можно вернуться завтра.'
      : 'You have used today\'s questions. You can return tomorrow.';
  }
  if (value?.code === 'NATAL_QUESTION_CHART_REQUIRED') {
    return language === 'ru'
      ? 'Сначала сохрани натальную карту, затем задай вопрос.'
      : 'Save the natal chart before asking a question.';
  }
  if (value?.code === 'NATAL_QUESTION_REJECTED') {
    return language === 'ru'
      ? 'Здесь нужен конкретный вопрос о себе по сохранённой натальной карте.'
      : 'Ask a specific question about yourself based on the saved birth chart.';
  }
  if (value?.code === 'NATAL_QUESTION_SELF_CHART_REQUIRED') {
    return language === 'ru'
      ? 'Свой вопрос можно задать только по основной карте.'
      : 'You can ask your own question only about your primary chart.';
  }
  if (
    value?.code === 'NATAL_QUESTION_GENERATION_FAILED'
    || value?.code === 'NATAL_QUESTION_VALIDATION_FAILED'
    || value?.code === 'NATAL_QUESTION_REQUEST_FAILED'
    || value?.code === 'CONTENT_GENERATION_TIMEOUT'
  ) {
    return language === 'ru'
      ? 'Не удалось закончить ответ. Отправь этот же вопрос ещё раз — лимит не спишется.'
      : 'The answer did not finish. Submit the same question again without using another question.';
  }
  return language === 'ru'
    ? 'Не удалось загрузить ответы. Проверь соединение и попробуй ещё раз.'
    : 'Unable to load the answers. Check your connection and try again.';
}

function contextTitle(categoryKey: NatalReportCategoryKey, language: 'ru' | 'en'): string {
  if (categoryKey === 'main') return language === 'ru' ? 'обо всём' : 'anything about you';
  const title = getNatalReportCategory(categoryKey)?.title[language]
    || (language === 'ru' ? 'эту часть' : 'this part');
  return language === 'ru' ? title.toLocaleLowerCase() : title.toLocaleLowerCase();
}

export const NatalQuestionExperience: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  contextCategory,
  onContextChange,
  requestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = profile.id ? String(profile.id) : '';
  const isPremium = hasActivePremium(profile);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${buildNatalChartFingerprint(chartData)}`;
  const [snapshot, setSnapshot] = useState<NatalQuestionSnapshot | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unansweredQuestionText, setUnansweredQuestionText] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const pairs = useMemo(() => buildQuestionPairs(snapshot?.messages || []), [snapshot?.messages]);
  const starters = QUESTION_STARTERS[contextCategory][language];

  useEffect(() => {
    setSnapshot(null);
    setQuestionText('');
    setError(null);
    setUnansweredQuestionText(null);
  }, [reportIdentity]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadNatalQuestionSnapshot(userId, chartId)
      .then((next) => {
        if (cancelled) return;
        setSnapshot(next);
        const latest = buildQuestionPairs(next.messages).at(-1);
        const pendingText = latest && !latest.answer ? latest.question.text : null;
        setUnansweredQuestionText(pendingText);
        if (pendingText) setQuestionText((current) => current.trim() ? current : pendingText);
      })
      .catch((loadError) => {
        if (!cancelled) setError(formatQuestionError(loadError, language));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [chartId, language, reportIdentity, retryToken, userId]);

  useEffect(() => {
    if (
      !isPremium
      || !premiumContinuation
      || premiumContinuation.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_questions'
      || premiumContinuation.returnAction !== 'open_natal_questions'
    ) return;
    requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true });
      composerRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [isPremium, onPremiumContinuationHandled, premiumContinuation]);

  useEffect(() => {
    if (!pairs.length) return;
    historyEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pairs.length]);

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = questionText.trim();
    const retryMatches = !unansweredQuestionText || (
      normalizePersonalForecastQuestionInput(value).toLocaleLowerCase()
      === normalizePersonalForecastQuestionInput(unansweredQuestionText).toLocaleLowerCase()
    );
    if (!userId || !value || !retryMatches || loading || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await askNatalQuestion(userId, value, chartId);
      setSnapshot(next);
      setQuestionText('');
      setUnansweredQuestionText(null);
      void recordUserAppEvent({
        eventType: 'question_sent',
        section: 'natal',
        source: 'natal_questions',
        eventPayload: {
          section_key: contextCategory,
          scope: 'self',
          source: 'natal_meaning_map',
          is_follow_up: pairs.length > 0,
        },
      });
    } catch (submitError) {
      const code = (submitError as HumanReadingError)?.code;
      if (
        code === 'NATAL_QUESTION_GENERATION_FAILED'
        || code === 'NATAL_QUESTION_VALIDATION_FAILED'
        || code === 'CONTENT_GENERATION_TIMEOUT'
      ) {
        setUnansweredQuestionText(value);
      }
      setError(formatQuestionError(submitError, language));
    } finally {
      setSubmitting(false);
    }
  };

  const remainingQuestions = isPremium
    ? snapshot?.usage.remaining ?? null
    : snapshot?.access.freeQuestionRemaining ?? null;
  const normalizedQuestionText = normalizePersonalForecastQuestionInput(questionText).toLocaleLowerCase();
  const normalizedUnansweredQuestion = normalizePersonalForecastQuestionInput(
    unansweredQuestionText,
  ).toLocaleLowerCase();
  const canRetryUnanswered = Boolean(
    unansweredQuestionText
    && normalizedQuestionText
    && normalizedQuestionText === normalizedUnansweredQuestion,
  );
  const questionLimitReached = remainingQuestions === 0 && !unansweredQuestionText;
  const inputDisabled = loading || submitting || questionLimitReached || !userId;
  const statusText = submitting
    ? (language === 'ru' ? 'Готовим ответ…' : 'Preparing your answer…')
    : unansweredQuestionText
      ? (canRetryUnanswered
          ? (language === 'ru'
              ? 'Предыдущий вопрос остался без ответа. Отправь его ещё раз — лимит не спишется.'
              : 'The previous question has no answer. Submit it again without using another question.')
          : (language === 'ru'
              ? 'Сейчас можно повторить только вопрос, который остался без ответа.'
              : 'For now, you can only retry the unanswered question.'))
      : questionLimitReached
        ? (isPremium
            ? (language === 'ru' ? 'На сегодня вопросы закончились.' : 'You have used today\'s questions.')
            : (language === 'ru' ? 'Первый вопрос уже использован.' : 'Your first question has been used.'))
        : remainingQuestions != null
          ? (isPremium
              ? (language === 'ru' ? `Осталось сегодня: ${remainingQuestions}` : `Remaining today: ${remainingQuestions}`)
              : (language === 'ru' ? 'Можно задать первый вопрос.' : 'You can ask your first question.'))
          : (language === 'ru' ? 'Ответ сохранится здесь.' : 'The answer will stay here.');

  return (
    <article className="natal-v3-question-experience" aria-labelledby="natal-v3-question-title">
      <header className="natal-v3-page-heading natal-v3-question-heading">
        <p>{language === 'ru' ? 'Спросить' : 'Ask'}</p>
        <h1 id="natal-v3-question-title">
          {language === 'ru'
            ? `Что хочешь понять ${contextCategory === 'main' ? 'о себе' : `про ${contextTitle(contextCategory, language)}`}?`
            : `What do you want to understand about ${contextTitle(contextCategory, language)}?`}
        </h1>
        <span>
          {language === 'ru'
            ? 'Пиши обычными словами. Ответ строится по сохранённой карте и показывает, почему получился именно такой вывод.'
            : 'Write in ordinary words. The answer uses the saved chart and shows why that conclusion was made.'}
        </span>
      </header>

      <section className="natal-v3-question-context" aria-label={language === 'ru' ? 'Тема вопроса' : 'Question topic'}>
        <button
          type="button"
          aria-expanded={contextOpen}
          onClick={() => setContextOpen((value) => !value)}
        >
          <span>
            <small>{language === 'ru' ? 'Сейчас спрашиваем' : 'Current topic'}</small>
            <strong>{contextCategory === 'main'
              ? (language === 'ru' ? 'Обо всём' : 'Anything about you')
              : getNatalReportCategory(contextCategory)?.title[language]}</strong>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        {contextOpen ? (
          <ul>
            {QUESTION_CONTEXTS.map((categoryKey) => (
              <li key={categoryKey}>
                <button
                  type="button"
                  aria-pressed={contextCategory === categoryKey}
                  onClick={() => {
                    onContextChange(categoryKey);
                    setContextOpen(false);
                  }}
                >
                  <span>{categoryKey === 'main'
                    ? (language === 'ru' ? 'Обо всём' : 'Anything about you')
                    : getNatalReportCategory(categoryKey)?.title[language]}</span>
                  {contextCategory === categoryKey ? <span aria-hidden="true">✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {!isPremium && snapshot?.access.freeQuestionRemaining === 0 && !unansweredQuestionText ? (
        <section className="natal-v3-question-paywall" aria-labelledby="natal-v3-question-paywall-title">
          <p>{language === 'ru' ? 'Первый вопрос уже использован' : 'First question used'}</p>
          <h2 id="natal-v3-question-paywall-title">
            {language === 'ru' ? 'Продолжай спрашивать по своей карте' : 'Keep asking about your chart'}
          </h2>
          <span>
            {language === 'ru'
              ? 'Можно задавать до 5 новых вопросов в день. История ответов останется здесь.'
              : 'You can ask up to 5 new questions a day. Your answer history stays here.'}
          </span>
          <button
            id="natal-question-premium-button"
            type="button"
            className="natal-v3-primary-action"
            onClick={() => void requestPremium('natal_questions', {
              placement: 'natal_questions',
              featureKey: 'natal_questions',
              triggerType: 'locked_feature',
              returnView: 'chart',
              returnScrollAnchor: 'natal-question-premium-button',
              returnAction: 'open_natal_questions',
            })}
          >
            {language === 'ru' ? 'Открыть вопросы' : 'Open questions'}
          </button>
        </section>
      ) : (
        <section className="natal-v3-question-composer" aria-labelledby="natal-v3-question-composer-title">
          <div className="natal-v3-section-heading">
            <h2 id="natal-v3-question-composer-title">
              {language === 'ru' ? 'Можно начать так' : 'You can start here'}
            </h2>
          </div>
          <ul className="natal-v3-question-starters">
            {starters.map((starter) => (
              <li key={starter}>
                <button
                  type="button"
                  disabled={inputDisabled || Boolean(unansweredQuestionText)}
                  onClick={() => {
                    setQuestionText(starter);
                    setError(null);
                    requestAnimationFrame(() => composerRef.current?.focus());
                  }}
                >
                  <span>{starter}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={submitQuestion} aria-busy={submitting || undefined}>
            <div className="natal-v3-composer-field">
              <textarea
                ref={composerRef}
                id="natal-question-input"
                name="natal-question"
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                maxLength={300}
                rows={3}
                placeholder={language === 'ru'
                  ? 'Напиши свой вопрос…'
                  : 'Write your question…'}
                disabled={inputDisabled}
                aria-describedby="natal-v3-question-status natal-v3-question-warning"
              />
              <button
                type="submit"
                aria-label={language === 'ru' ? 'Отправить вопрос' : 'Send question'}
                disabled={inputDisabled
                  || !questionText.trim()
                  || Boolean(unansweredQuestionText && !canRetryUnanswered)}
              >
                <Send aria-hidden="true" />
              </button>
            </div>
            <div className="natal-v3-composer-meta">
              <p id="natal-v3-question-status" aria-live="polite">{statusText}</p>
              <span>{questionText.length}/300</span>
            </div>
            <p id="natal-v3-question-warning" className="natal-v3-question-warning">
              {language === 'ru'
                ? 'Не указывай документы, контакты, пароли, платёжные или медицинские данные.'
                : 'Do not include documents, contact details, passwords, payment, or medical data.'}
            </p>
            {error && snapshot ? <p className="natal-v3-question-error" role="alert">{error}</p> : null}
          </form>
        </section>
      )}

      <section className="natal-v3-question-history" aria-labelledby="natal-v3-question-history-title">
        <div className="natal-v3-section-heading">
          <h2 id="natal-v3-question-history-title">
            {language === 'ru' ? 'Твои вопросы и ответы' : 'Your questions and answers'}
          </h2>
        </div>
        {loading && !snapshot ? (
          <p className="natal-v3-question-state" role="status">
            {language === 'ru' ? 'Загружаем прошлые ответы…' : 'Loading previous answers…'}
          </p>
        ) : error && !snapshot ? (
          <div className="natal-v3-question-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
              {language === 'ru' ? 'Попробовать ещё раз' : 'Try again'}
            </button>
          </div>
        ) : pairs.length ? (
          <ol className="natal-v3-question-pairs">
            {pairs.map(({ question, answer }) => (
              <li key={question.id}>
                <article>
                  <div className="natal-v3-user-question">
                    <p>{language === 'ru' ? 'Ты спросил' : 'You asked'}</p>
                    <h3>{question.text}</h3>
                  </div>
                  {answer ? (
                    <div className="natal-v3-assistant-answer">
                      <p>{language === 'ru' ? 'Ответ по карте' : 'Answer from the chart'}</p>
                      <FormattedAiText
                        text={answer.text}
                        className="natal-v3-assistant-answer-copy"
                        paragraphClassName="natal-v3-assistant-answer-paragraph"
                      />
                      <button
                        type="button"
                        className="natal-v3-inline-action"
                        onClick={() => setExplanation({
                          mode: 'why',
                          title: question.text,
                          text: answer.text,
                          evidenceIds: questionMessageEvidenceIds(answer),
                        })}
                      >
                        {language === 'ru' ? 'Почему так?' : 'Why?'}
                      </button>
                    </div>
                  ) : (
                    <p className="natal-v3-question-state">
                      {language === 'ru'
                        ? 'Ответ не завершён. Повтори этот же вопрос выше.'
                        : 'The answer did not finish. Retry the same question above.'}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p className="natal-v3-question-state">
            {language === 'ru'
              ? 'Здесь появятся вопросы, которые ты уже задавал по карте.'
              : 'Questions you have already asked about the chart will appear here.'}
          </p>
        )}
        <div ref={historyEndRef} />
      </section>

      <NatalEvidenceSheet
        target={explanation}
        profile={profile}
        chartData={chartData}
        onClose={() => setExplanation(null)}
        onShowWhy={setExplanation}
      />
    </article>
  );
};
