import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import { hasFullPremium } from '../../lib/accessMatrix';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import type { PaywallContext } from '../../lib/paywallContext';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../../lib/natalReading/natalQuestionStore';
import { normalizePersonalForecastQuestionInput } from '../../lib/personalForecastQuestionModeration';
import {
  askNatalQuestion,
  loadNatalQuestionSnapshot,
  type NatalQuestionServiceError,
} from '../../services/natalQuestionService';
import { recordUserAppEvent } from '../../services/sessionService';
import { captureAppTrace, traceGeneration } from '../../services/appTelemetryClient';
import { FormattedAiText } from '../ui/FormattedAiText';
import {
  NatalEvidenceSheet,
  type NatalExplanationTarget,
} from './NatalEvidenceSheet';
import { DictationButton } from '../lumia-ui/DictationButton';
import { appendDictatedText } from '../../services/dictation';

type Props = {
  compact?: boolean;
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
};

type QuestionPair = {
  question: NatalQuestionStoredMessage;
  answer: NatalQuestionStoredMessage | null;
};

const QUESTION_EXAMPLES = {
  ru: ['Расскажи мне о любви', 'Что меня ждёт?', 'Какая работа мне подходит?', 'Что у меня с деньгами?', 'Кто мне подходит?', 'В чём я сильнее всего?'],
  en: ['Tell me about love', 'What lies ahead for me?', 'What work suits me?', 'What about my money?', 'Who is right for me?', 'What am I best at?'],
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
  const value = error as NatalQuestionServiceError;
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
      ? 'Не удалось закончить ответ. Отправь этот же вопрос ещё раз, лимит не спишется.'
      : 'The answer did not finish. Submit the same question again without using another question.';
  }
  return language === 'ru'
    ? 'Не удалось загрузить ответы. Проверь соединение и попробуй ещё раз.'
    : 'Unable to load the answers. Check your connection and try again.';
}

export const NatalQuestionExperience: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  requestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  compact = false,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = profile.id ? String(profile.id) : '';
  const isPremium = hasFullPremium(profile);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${buildNatalChartFingerprint(chartData)}`;
  const [snapshot, setSnapshot] = useState<NatalQuestionSnapshot | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionExampleIndex, setQuestionExampleIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unansweredQuestionText, setUnansweredQuestionText] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(questionText);
  draftRef.current = questionText;
  useEffect(() => {
    const generation=traceGeneration();
    const save=()=> {if(draftRef.current && generation===traceGeneration()) captureAppTrace('question_draft',{text:draftRef.current,length:draftRef.current.length},'chart');};
    window.addEventListener('pagehide',save);
    return ()=> {save();window.removeEventListener('pagehide',save);};
  },[]);
  useEffect(() => {
    if (!questionText) return;
    const timer = window.setTimeout(() => captureAppTrace('question_draft', { text: questionText, length: questionText.length }, 'chart'), 1500);
    return () => clearTimeout(timer);
  }, [questionText]);
  const pairs = useMemo(() => buildQuestionPairs(snapshot?.messages || []), [snapshot?.messages]);

  useEffect(() => {
    if (!isPremium || compact) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setQuestionExampleIndex(current => (current + 1) % QUESTION_EXAMPLES[language].length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isPremium, compact, language]);

  useEffect(() => {
    setSnapshot(null);
    setQuestionText('');
    setError(null);
    setUnansweredQuestionText(null);
  }, [reportIdentity]);

  useEffect(() => {
    if (!isPremium) { setSnapshot(null); setLoading(false); setError(null); return; }
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
  }, [chartId, language, reportIdentity, retryToken, userId, isPremium]);

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

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPremium) return;
    const value = questionText.trim();
    const retryMatches = !unansweredQuestionText || (
      normalizePersonalForecastQuestionInput(value).toLocaleLowerCase()
      === normalizePersonalForecastQuestionInput(unansweredQuestionText).toLocaleLowerCase()
    );
    if (!userId || !value || !retryMatches || loading || submitting) return;
    setSubmitting(true);
    setError(null);
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const generation = traceGeneration();
    captureAppTrace('question_submit', { request_id:requestId, text: value, length: value.length }, 'chart');
    try {
      const next = await askNatalQuestion(userId, value, chartId);
      const question = next.messages.filter(message => message.role === 'user').at(-1);
      const answer = next.messages.find(message => message.role === 'assistant' && Number(message.payload?.questionMessageId) === question?.id);
      if(generation === traceGeneration()) captureAppTrace('question_result', { request_id:requestId, duration_ms: Date.now() - started, outcome: 'success',
        ...(question ? { question_id: question.id } : {}), ...(answer ? { answer_id: answer.id } : {}) }, 'chart');
      setSnapshot(next);
      setQuestionText('');
      setUnansweredQuestionText(null);
      void recordUserAppEvent({
        eventType: 'question_sent',
        section: 'natal',
        source: 'natal_questions',
        eventPayload: {
          section_key: 'main',
          scope: 'self',
          source: 'natal_meaning_map',
          is_follow_up: pairs.length > 0,
        },
      });
    } catch (submitError) {
      const code = (submitError as NatalQuestionServiceError)?.code;
      if(generation === traceGeneration()) captureAppTrace('question_result', { request_id:requestId, duration_ms: Date.now() - started, outcome: 'failed',
        error_kind: typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code) ? code : 'unknown' }, 'chart');
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
    : 0;
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
  const inputDisabled = !isPremium || loading || submitting || questionLimitReached || !userId;
  const statusText = submitting
    ? (language === 'ru' ? 'Готовим ответ…' : 'Preparing your answer…')
    : unansweredQuestionText
      ? (canRetryUnanswered
          ? (language === 'ru'
              ? 'Предыдущий вопрос остался без ответа. Отправь его ещё раз, лимит не спишется.'
              : 'The previous question has no answer. Submit it again without using another question.')
          : (language === 'ru'
              ? 'Сейчас можно повторить только вопрос, который остался без ответа.'
              : 'For now, you can only retry the unanswered question.'))
      : questionLimitReached
        ? (isPremium
            ? (language === 'ru' ? 'На сегодня вопросы закончились.' : 'You have used today\'s questions.')
            : (language === 'ru' ? 'Вопросы о себе доступны с Premium.' : 'Questions about yourself require Premium.'))
        : remainingQuestions != null
          ? (isPremium
              ? (language === 'ru' ? `Осталось сегодня: ${remainingQuestions}` : `Remaining today: ${remainingQuestions}`)
              : (language === 'ru' ? 'Можно задать первый вопрос.' : 'You can ask your first question.'))
          : (language === 'ru' ? 'Ответ сохранится здесь.' : 'The answer will stay here.');

  return (
    <article className="natal-v3-question-experience" aria-labelledby="natal-v3-question-title">
      <header className="natal-v3-page-heading natal-v3-question-heading" hidden={compact}>
        <p>{language === 'ru' ? 'Спросить' : 'Ask'}</p>
        <h1 id="natal-v3-question-title">
          {language === 'ru' ? 'Задай любой вопрос о себе' : 'Ask anything about yourself'}
        </h1>
        <span>
          {language === 'ru'
            ? 'Напиши вопрос своими словами. Ответ будет только по твоей сохранённой карте.'
            : 'Write the question in your own words. The answer uses only your saved birth chart.'}
        </span>
      </header>

      {!isPremium ? (
        <section className="natal-v3-question-paywall" aria-labelledby="natal-v3-question-paywall-title">
          <p>Premium</p>
          <h2 id="natal-v3-question-paywall-title">
            {language === 'ru' ? 'Спрашивай о себе по своей карте' : 'Ask about yourself using your chart'}
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
          <div className="natal-v3-section-heading natal-v3-question-composer-heading">
            <h2 id="natal-v3-question-composer-title">
              {language === 'ru' ? 'Твой вопрос' : 'Your question'}
            </h2>
            {!compact ? <span id="natal-question-example" className="natal-v3-question-example">
              {language === 'ru' ? 'Например: ' : 'For example: '}{QUESTION_EXAMPLES[language][questionExampleIndex]}
            </span> : null}
          </div>

          <form onSubmit={submitQuestion} aria-busy={submitting || undefined}>
            <div className="natal-v3-composer-field">
              <textarea
                ref={composerRef}
                id="natal-question-input"
                name="natal-question"
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                onBlur={() => {if(questionText) captureAppTrace('question_draft',{text:questionText,length:questionText.length},'chart');}}
                maxLength={300}
                rows={compact ? 1 : 3}
                placeholder={language === 'ru'
                  ? 'Напиши свой вопрос…'
                  : 'Write your question…'}
                disabled={inputDisabled}
                aria-describedby={`${compact ? '' : 'natal-question-example '}natal-v3-question-status natal-v3-question-warning`}
              />
              <DictationButton
                language={language}
                disabled={inputDisabled}
                onText={(text) => setQuestionText((current) => appendDictatedText(current, text, 300))}
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

      <section data-telemetry-private hidden={compact && !loading && !error && !pairs.length} className="natal-v3-question-history" aria-labelledby="natal-v3-question-history-title">
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
                    <div data-telemetry-content={`Ответ на вопрос #${answer.id}`} className="natal-v3-assistant-answer">
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
                        {language === 'ru' ? 'На чём основано' : 'What this is based on'}
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
