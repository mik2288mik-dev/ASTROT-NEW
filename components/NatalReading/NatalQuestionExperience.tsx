import React, { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import type { PaywallContext } from '../../lib/paywallContext';
import {
  askNatalQuestion,
  loadNatalQuestionSnapshot,
  type HumanReadingError,
} from '../../services/natalReadingService';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../../lib/natalReading/natalQuestionStore';
import type { NatalReportCategoryKey } from '../../lib/natalReading/reportCatalog';
import { hasActivePremium } from '../../lib/accessMatrix';
import { normalizePersonalForecastQuestionInput } from '../../lib/personalForecastQuestionModeration';
import { recordUserAppEvent } from '../../services/sessionService';
import { FormattedAiText } from '../ui/FormattedAiText';
import { NatalWhySheet } from './NatalWhySheet';
import styles from '../../styles/NatalMeaningExperience.module.css';
import questionStyles from '../../styles/NatalQuestionExperience.module.css';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  context?: NatalReportCategoryKey | null;
  requestAccess: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
};

type QuestionPair = {
  question: NatalQuestionStoredMessage;
  answer: NatalQuestionStoredMessage | null;
};

type WhyTarget = {
  text: string;
  evidenceIds: string[];
};

const STARTERS: Record<NatalReportCategoryKey, ReadonlyArray<{ ru: string; en: string }>> = {
  main: [
    { ru: 'Почему я долго проверяю решение?', en: 'Why do I keep checking a decision?' },
    { ru: 'Что во мне люди понимают не сразу?', en: 'What do people miss about me at first?' },
    { ru: 'В чём я особенно силён?', en: 'Where am I especially strong?' },
    { ru: 'Что меня чаще всего выбивает?', en: 'What throws me off most often?' },
  ],
  character: [
    { ru: 'Почему я могу резко поменять решение?', en: 'Why can I suddenly change my mind?' },
    { ru: 'Что меня быстро раздражает?', en: 'What irritates me quickly?' },
    { ru: 'Почему мне трудно остановиться в споре?', en: 'Why is it hard for me to stop during an argument?' },
    { ru: 'Что мне быстро надоедает?', en: 'What bores me quickly?' },
  ],
  love: [
    { ru: 'Кого я обычно выбираю?', en: 'Who do I usually choose?' },
    { ru: 'Почему я могу быстро потерять интерес?', en: 'Why can I lose interest quickly?' },
    { ru: 'Что меня сразу отталкивает?', en: 'What puts me off immediately?' },
    { ru: 'Как я веду себя, когда действительно влюблён?', en: 'How do I act when I am really in love?' },
  ],
  communication: [
    { ru: 'Почему меня иногда понимают не так?', en: 'Why do people sometimes misunderstand me?' },
    { ru: 'Как я веду себя в ссоре?', en: 'How do I act during an argument?' },
    { ru: 'Почему мне бывает трудно попросить о помощи?', en: 'Why can it be hard for me to ask for help?' },
    { ru: 'Что я чаще недоговариваю?', en: 'What do I tend to leave unsaid?' },
  ],
  work: [
    { ru: 'Какая работа мне быстро надоедает?', en: 'What kind of work bores me quickly?' },
    { ru: 'Мне легче одному или в команде?', en: 'Do I work better alone or with a team?' },
    { ru: 'Как я веду себя под жёстким контролем?', en: 'How do I react to tight control at work?' },
    { ru: 'Подходит ли мне своё дело?', en: 'Does running my own business suit me?' },
  ],
  money: [
    { ru: 'Почему я могу потратить больше, чем планировал?', en: 'Why can I spend more than planned?' },
    { ru: 'Как я принимаю крупные денежные решения?', en: 'How do I make big money decisions?' },
    { ru: 'Насколько я готов рисковать деньгами?', en: 'How willing am I to risk money?' },
    { ru: 'Почему мне бывает трудно назвать свою цену?', en: 'Why can it be hard to name my price?' },
  ],
};

const CONTEXT_COPY: Record<NatalReportCategoryKey, { titleRu: string; titleEn: string; bodyRu: string; bodyEn: string }> = {
  main: {
    titleRu: 'Что хочешь понять о себе?',
    titleEn: 'What do you want to understand about yourself?',
    bodyRu: 'Спроси конкретно. Чем точнее вопрос, тем меньше общих слов.',
    bodyEn: 'Ask one clear question. The more specific it is, the less generic the answer.',
  },
  character: {
    titleRu: 'Что хочешь понять про свой характер?',
    titleEn: 'What do you want to understand about your character?',
    bodyRu: 'Решения, реакции, раздражение, скука — спрашивай прямо.',
    bodyEn: 'Decisions, reactions, irritation, boredom — ask directly.',
  },
  love: {
    titleRu: 'Что хочешь понять про отношения?',
    titleEn: 'What do you want to understand about relationships?',
    bodyRu: 'Кого выбираешь, как сближаешься и почему можешь отойти.',
    bodyEn: 'Who you choose, how you get close, and why you may pull away.',
  },
  communication: {
    titleRu: 'Что хочешь понять про общение?',
    titleEn: 'What do you want to understand about communication?',
    bodyRu: 'Разговоры, переписка, спор, молчание — без намёков, пожалуйста.',
    bodyEn: 'Conversations, messages, arguments, silence — no hints needed.',
  },
  work: {
    titleRu: 'Что хочешь понять про работу?',
    titleEn: 'What do you want to understand about work?',
    bodyRu: 'Рутина, команда, начальники, своё дело — называй, что именно бесит.',
    bodyEn: 'Routine, teams, managers, your own business — name the exact issue.',
  },
  money: {
    titleRu: 'Что хочешь понять про деньги?',
    titleEn: 'What do you want to understand about money?',
    bodyRu: 'Траты, риск, цена своей работы и крупные решения.',
    bodyEn: 'Spending, risk, pricing your work, and big decisions.',
  },
};

function evidenceIdsFromMessage(message: NatalQuestionStoredMessage | null): string[] {
  if (!message?.payload) return [];
  const value = message.payload.evidenceIds || message.payload.evidence_ids;
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
}

function buildPairs(messages: readonly NatalQuestionStoredMessage[]): QuestionPair[] {
  const answers = new Map<string, NatalQuestionStoredMessage>();
  messages.forEach((message) => {
    if (message.role !== 'assistant') return;
    const questionId = String(message.payload?.questionMessageId || '').trim();
    if (questionId) answers.set(questionId, message);
  });
  return messages
    .filter((message) => message.role === 'user')
    .map((question) => ({
      question,
      answer: answers.get(String(question.id)) || null,
    }))
    .reverse();
}

function readableError(error: unknown, language: 'ru' | 'en'): string {
  const code = String((error as HumanReadingError)?.code || '');
  if (code === 'FREE_NATAL_QUESTION_USED' || code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Этот вопрос уже был. Открой вопросы, чтобы продолжить.'
      : 'That question is already used. Open questions to continue.';
  }
  if (code === 'NATAL_QUESTION_DAILY_LIMIT') {
    return language === 'ru'
      ? 'На сегодня хватит. Завтра снова можно.'
      : 'That is enough for today. You can ask again tomorrow.';
  }
  if (code === 'NATAL_QUESTION_CHART_REQUIRED') {
    return language === 'ru'
      ? 'Сначала сохрани карту, потом спрашивай.'
      : 'Save the chart first, then ask.';
  }
  if (code === 'NATAL_QUESTION_REJECTED') {
    return language === 'ru'
      ? 'Спроси конкретно о себе. Чужие мысли, диагнозы и гадание на дату сюда не пройдут.'
      : 'Ask a specific question about yourself. Other people’s thoughts, diagnoses, and date predictions will not pass.';
  }
  if (code === 'NATAL_QUESTION_SELF_CHART_REQUIRED') {
    return language === 'ru'
      ? 'Вопросы работают только с твоей основной картой.'
      : 'Questions work only with your own main chart.';
  }
  return language === 'ru'
    ? 'Ответ не получился. Повтори вопрос — без лишнего списания.'
    : 'The answer did not complete. Retry the question without using another turn.';
}

export const NatalQuestionExperience: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  context = 'main',
  requestAccess,
  premiumContinuation,
  onPremiumContinuationHandled,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = String(profile.id || '').trim();
  const isPremium = hasActivePremium(profile);
  const activeContext = context || 'main';
  const copy = CONTEXT_COPY[activeContext];
  const starters = STARTERS[activeContext];
  const [snapshot, setSnapshot] = useState<NatalQuestionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unansweredQuestion, setUnansweredQuestion] = useState<string | null>(null);
  const [whyTarget, setWhyTarget] = useState<WhyTarget | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(language === 'ru' ? 'Сначала войди в аккаунт.' : 'Sign in first.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadNatalQuestionSnapshot(userId, chartId)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((loadError) => {
        if (!cancelled) setError(readableError(loadError, language));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartId, language, retryToken, userId]);

  useEffect(() => {
    if (
      !premiumContinuation
      || premiumContinuation.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_questions'
      || premiumContinuation.returnAction !== 'open_natal_questions'
    ) return;
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [onPremiumContinuationHandled, premiumContinuation]);

  const pairs = useMemo(
    () => buildPairs(snapshot?.messages || []),
    [snapshot?.messages],
  );
  const remaining = isPremium
    ? snapshot?.usage.remaining ?? null
    : snapshot?.access.freeQuestionRemaining ?? null;
  const locked = !isPremium
    && snapshot?.access.freeQuestionRemaining === 0
    && !unansweredQuestion;
  const dailyLimitReached = isPremium && remaining === 0 && !unansweredQuestion;
  const normalizedQuestion = normalizePersonalForecastQuestionInput(question).toLocaleLowerCase();
  const normalizedUnanswered = normalizePersonalForecastQuestionInput(
    unansweredQuestion,
  ).toLocaleLowerCase();
  const canRetry = Boolean(
    unansweredQuestion
    && normalizedQuestion
    && normalizedQuestion === normalizedUnanswered,
  );
  const inputDisabled = loading
    || submitting
    || locked
    || dailyLimitReached
    || !userId
    || Boolean(unansweredQuestion && !canRetry);

  const status = submitting
    ? (language === 'ru' ? 'Собираем ответ…' : 'Preparing the answer…')
    : loading
      ? (language === 'ru' ? 'Открываем прошлые ответы…' : 'Loading earlier answers…')
      : unansweredQuestion
        ? (canRetry
            ? (language === 'ru'
                ? 'Предыдущий ответ оборвался. Отправь вопрос ещё раз.'
                : 'The previous answer stopped. Send the same question again.')
            : (language === 'ru'
                ? 'Сначала повтори вопрос, который остался без ответа.'
                : 'Retry the unanswered question first.'))
        : dailyLimitReached
          ? (language === 'ru' ? 'На сегодня хватит. Завтра снова можно.' : 'That is enough for today. Ask again tomorrow.')
          : remaining != null
            ? isPremium
              ? (language === 'ru' ? `Сегодня осталось: ${remaining}` : `Left today: ${remaining}`)
              : (language === 'ru' ? 'Сейчас можно задать один вопрос.' : 'You can ask one question now.')
            : (language === 'ru' ? 'Ответ появится ниже.' : 'The answer will appear below.');

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!userId || !value || inputDisabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await askNatalQuestion(userId, value, chartId);
      setSnapshot(next);
      setQuestion('');
      setUnansweredQuestion(null);
      void recordUserAppEvent({
        eventType: 'question_sent',
        section: 'natal',
        source: 'natal_questions',
        eventPayload: {
          section_key: activeContext,
          scope: 'self',
          source: 'natal_meaning_map',
          is_follow_up: pairs.length > 0,
        },
      });
    } catch (submitError) {
      const code = String((submitError as HumanReadingError)?.code || '');
      if (
        code === 'NATAL_QUESTION_GENERATION_FAILED'
        || code === 'NATAL_QUESTION_VALIDATION_FAILED'
        || code === 'CONTENT_GENERATION_TIMEOUT'
      ) {
        setUnansweredQuestion(value);
      }
      setError(readableError(submitError, language));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <main className={questionStyles.questionRoot}>
        <header className={questionStyles.questionIntro}>
          <p className={styles.eyebrow}>
            {language === 'ru' ? 'Спроси по своей карте' : 'Ask from your chart'}
          </p>
          <h1>{language === 'ru' ? copy.titleRu : copy.titleEn}</h1>
          <p>{language === 'ru' ? copy.bodyRu : copy.bodyEn}</p>
        </header>

        {locked ? (
          <section className={questionStyles.questionAccess}>
            <h2>{language === 'ru' ? 'Продолжим?' : 'Keep going?'}</h2>
            <p>
              {language === 'ru'
                ? 'Можно задавать до пяти новых вопросов в день и возвращаться к старым ответам.'
                : 'You can ask up to five new questions a day and return to earlier answers.'}
            </p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => void requestAccess('natal_questions', {
                placement: 'natal_questions',
                featureKey: 'natal_questions',
                triggerType: 'locked_feature',
                returnView: 'chart',
                returnScrollAnchor: 'natal-question-composer',
                returnAction: 'open_natal_questions',
              })}
            >
              {language === 'ru' ? 'Открыть вопросы' : 'Open questions'}
            </button>
          </section>
        ) : (
          <form
            id="natal-question-composer"
            className={questionStyles.questionComposer}
            onSubmit={submitQuestion}
            aria-busy={loading || submitting || undefined}
          >
            <div className={questionStyles.questionSuggestions}>
              <p>{language === 'ru' ? 'Можно начать так' : 'You can start here'}</p>
              <div>
                {starters.map((starter) => {
                  const value = starter[language];
                  return (
                    <button
                      key={starter.ru}
                      type="button"
                      disabled={inputDisabled || Boolean(unansweredQuestion)}
                      onClick={() => {
                        setQuestion(value);
                        setError(null);
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className={questionStyles.questionLabel} htmlFor="natal-question-input">
              {language === 'ru' ? 'Свой вопрос' : 'Your question'}
            </label>
            <textarea
              id="natal-question-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              maxLength={300}
              disabled={inputDisabled}
              placeholder={language === 'ru'
                ? 'Например: почему я быстро теряю интерес?'
                : 'For example: why do I lose interest quickly?'}
              className={questionStyles.questionInput}
            />
            <div className={questionStyles.questionComposerFooter}>
              <p role="status" aria-live="polite">{status}</p>
              <button
                type="submit"
                className={questionStyles.questionSubmit}
                disabled={inputDisabled || !question.trim()}
                aria-label={language === 'ru' ? 'Отправить вопрос' : 'Send question'}
              >
                <Send aria-hidden="true" />
                <span>{canRetry
                  ? (language === 'ru' ? 'Повторить' : 'Retry')
                  : (language === 'ru' ? 'Спросить' : 'Ask')}</span>
              </button>
            </div>
            {error ? <p className={questionStyles.questionError} role="alert">{error}</p> : null}
          </form>
        )}

        <section className={questionStyles.questionHistory} aria-labelledby="natal-question-history">
          <header>
            <h2 id="natal-question-history">
              {language === 'ru' ? 'Твои ответы' : 'Your answers'}
            </h2>
            {pairs.length ? <span>{pairs.length}</span> : null}
          </header>

          {loading && !snapshot ? (
            <div className={styles.loading} role="status" aria-busy="true">
              <span className={styles.loadingLine} />
              <span className={styles.loadingLine} />
              <span className={styles.loadingLine} />
            </div>
          ) : error && !snapshot ? (
            <section className={styles.error} role="alert">
              <p>{error}</p>
              <button
                type="button"
                className={styles.askAction}
                onClick={() => setRetryToken((value) => value + 1)}
              >
                {language === 'ru' ? 'Повторить' : 'Try again'}
              </button>
            </section>
          ) : pairs.length ? (
            <ol className={questionStyles.questionPairs}>
              {pairs.map(({ question: userQuestion, answer }) => (
                <li key={userQuestion.id} className={questionStyles.questionPair}>
                  <p className={questionStyles.userQuestion}>{userQuestion.text}</p>
                  {answer ? (
                    <article className={questionStyles.assistantAnswer}>
                      <FormattedAiText
                        text={answer.text}
                        className={questionStyles.answerFormatted}
                        paragraphClassName={questionStyles.answerParagraph}
                      />
                      <button
                        type="button"
                        className={`${styles.textAction} ${styles.textActionStrong}`}
                        onClick={() => setWhyTarget({
                          text: answer.text,
                          evidenceIds: evidenceIdsFromMessage(answer),
                        })}
                      >
                        {language === 'ru' ? 'Почему так?' : 'Why this?'}
                      </button>
                    </article>
                  ) : (
                    <p className={questionStyles.questionPending}>
                      {language === 'ru'
                        ? 'Ответ оборвался. Повтори этот вопрос выше.'
                        : 'The answer stopped. Retry this question above.'}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className={questionStyles.questionEmpty}>
              {language === 'ru'
                ? 'Здесь появятся ответы. Пока тихо — и это легко исправить.'
                : 'Your answers will appear here. It is quiet for now, which is easy to fix.'}
            </p>
          )}
        </section>
      </main>

      <NatalWhySheet
        open={Boolean(whyTarget)}
        statement={whyTarget?.text || ''}
        evidenceIds={whyTarget?.evidenceIds || []}
        profile={profile}
        chartData={chartData}
        onClose={() => setWhyTarget(null)}
      />
    </>
  );
};
