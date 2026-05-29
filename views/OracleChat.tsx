import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AskLumiaState, AskLumiaTier, ChatMessage, UserProfile } from '../types';
import { chatWithAstra, getAskLumiaState, getOracleHistory, askLumiaWithStarsPayment } from '../services/astrologyService';
import { requestStarsOneOffPayment } from '../services/telegramService';
import { getText } from '../constants';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const HISTORY_LIMIT = 12;

interface OracleChatProps {
  profile: UserProfile;
  onPremiumRequired?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
}

type SubmitOptions = {
  appendUserMessage: boolean;
  failedMessageId?: string | null;
};

function getSendLabel(lang: 'ru' | 'en', state: AskLumiaState | null) {
  if (!state) return getText(lang, 'oracle.send_free');
  if (state.nextTier === 'premium') return getText(lang, 'oracle.send_premium');
  if (state.nextTier === 'stars') {
    const cost = state.starsCost ?? 0;
    return getText(lang, 'oracle.send_lumi').replace('{cost}', String(cost)).replace(/Lumi/gi, 'Stars');
  }
  return getText(lang, 'oracle.send_free');
}

function getStateStrings(lang: 'ru' | 'en', state: AskLumiaState | null) {
  if (!state || state.nextTier === 'free') {
    return {
      label: getText(lang, 'oracle.state_free_label'),
      title: getText(lang, 'oracle.state_free_title'),
      body: getText(lang, 'oracle.state_free_body'),
    };
  }

  if (state.nextTier === 'stars') {
    const cost = state.starsCost ?? 0;
    return {
      label: getText(lang, 'oracle.state_lumi_label').replace(/Lumi/gi, 'Stars'),
      title: getText(lang, 'oracle.state_lumi_title').replace('{cost}', String(cost)).replace(/Lumi/gi, 'Stars'),
      body: getText(lang, 'oracle.state_lumi_body').replace(/Lumi/gi, 'Stars'),
    };
  }

  return {
    label: getText(lang, 'oracle.state_premium_label'),
    title: getText(lang, 'oracle.state_premium_title'),
    body: getText(lang, 'oracle.state_premium_body'),
  };
}

export const OracleChat: React.FC<OracleChatProps> = ({
  profile,
  onPremiumRequired,
  onUpdateProfile,
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stateLoading, setStateLoading] = useState(true);
  const [questionState, setQuestionState] = useState<AskLumiaState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [pendingStarsQuestion, setPendingStarsQuestion] = useState<string | null>(null);

  const buildIntroMessage = useCallback((): ChatMessage => ({
    id: 'init',
    role: 'model',
    text: getText(lang, 'oracle.intro'),
    timestamp: Date.now(),
  }), [lang]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      setStateLoading(true);
      try {
        const nextState = await getAskLumiaState(String(profile.id || ''));
        if (cancelled) return;
        setQuestionState(nextState);
      } catch (stateError: any) {
        if (cancelled) return;
        setError(stateError?.message || getText(lang, 'oracle.send_error'));
        setErrorCode(stateError?.code || null);
      } finally {
        if (!cancelled) {
          setStateLoading(false);
        }
      }
    };

    void loadState();
    return () => {
      cancelled = true;
    };
  }, [lang, profile.id]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoadingHistory(true);
      setError(null);
      setErrorCode(null);

      try {
        const historyItems = await getOracleHistory(profile, HISTORY_LIMIT);
        if (cancelled) return;

        if (!historyItems.length) {
          setMessages([buildIntroMessage()]);
          return;
        }

        const mappedMessages = historyItems
          .slice()
          .reverse()
          .flatMap((item, index) => {
            const timestamp = new Date(item.createdAt).getTime() || Date.now();
            return [
              {
                id: `history-question-${index}-${timestamp}`,
                role: 'user' as const,
                text: item.question,
                timestamp,
              },
              {
                id: `history-answer-${index}-${timestamp}`,
                role: 'model' as const,
                text: item.answer,
                timestamp: timestamp + 1,
              },
            ];
          });

        setMessages(mappedMessages);
      } catch (historyError: any) {
        if (cancelled) return;

        setMessages((current) => (current.length ? current : [buildIntroMessage()]));
        setError(historyError?.message || getText(lang, 'oracle.history_error'));
        setErrorCode(historyError?.code || null);
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [buildIntroMessage, lang, profile]);

  const validateQuestion = useCallback((question: string) => {
    const normalized = question.trim();
    if (!normalized) return getText(lang, 'oracle.empty_question');
    if (normalized.length < MIN_QUESTION_LENGTH) return getText(lang, 'oracle.short_question');
    if (normalized.length > MAX_QUESTION_LENGTH) return getText(lang, 'oracle.long_question');
    return null;
  }, [lang]);

  const buildHistoryForRequest = useCallback((messageIdToSkip?: string | null) => (
    messages
      .filter((message) => message.id !== 'init' && message.id !== messageIdToSkip)
      .map((message) => ({ role: message.role, text: message.text }))
  ), [messages]);

  const submitStarsQuestion = useCallback(async (rawQuestion: string, options: SubmitOptions) => {
    const normalizedQuestion = rawQuestion.trim();
    const validationError = validateQuestion(normalizedQuestion);

    if (validationError) {
      setError(validationError);
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    setLoading(true);
    setVerifyingPayment(false);
    setError(null);
    setErrorCode(null);
    setPendingStarsQuestion(normalizedQuestion);

    const shouldAppendUserMessage = options.appendUserMessage;
    const userMessageId = shouldAppendUserMessage ? `user-${Date.now()}` : options.failedMessageId || null;

    if (shouldAppendUserMessage) {
      const userMessage: ChatMessage = {
        id: userMessageId || `user-${Date.now()}`,
        role: 'user',
        text: normalizedQuestion,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setFailedQuestion(null);
      setFailedMessageId(null);
    }

    try {
      const payment = await requestStarsOneOffPayment({
        userId: String(profile.id || ''),
        type: 'ask_lumia_one_off',
      });

      if (payment.status === 'cancelled') {
        setError(
          lang === 'ru'
            ? 'Оплата отменена. Можно открыть ответ за Stars или оформить Premium.'
            : 'Payment cancelled. You can unlock with Stars or get Premium.'
        );
        setErrorCode('STARS_PAYMENT_CANCELLED');
        setFailedQuestion(normalizedQuestion);
        setFailedMessageId(userMessageId);
        setInput(normalizedQuestion);
        return;
      }

      if (payment.status !== 'paid' || !payment.paymentNonce) {
        setError(
          lang === 'ru'
            ? 'Не удалось открыть оплату Stars. Попробуйте ещё раз или оформите Premium.'
            : 'Could not open Stars payment. Try again or get Premium.'
        );
        setErrorCode('STARS_PAYMENT_FAILED');
        setFailedQuestion(normalizedQuestion);
        setFailedMessageId(userMessageId);
        setInput(normalizedQuestion);
        return;
      }

      setVerifyingPayment(true);
      const result = await askLumiaWithStarsPayment(
        buildHistoryForRequest(options.failedMessageId),
        normalizedQuestion,
        profile,
        payment.paymentNonce
      );

      const botMsg: ChatMessage = {
        id: `oracle-answer-${Date.now()}`,
        role: 'model',
        text: result.answer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setFailedQuestion(null);
      setFailedMessageId(null);
      setPendingStarsQuestion(null);
      setInput('');

      if (result.state) {
        setQuestionState(result.state);
      }
    } catch (submitError: any) {
      setError(submitError?.message || getText(lang, 'oracle.send_error'));
      setErrorCode(submitError?.code || null);
      setFailedQuestion(normalizedQuestion);
      setFailedMessageId(userMessageId);
      setInput(normalizedQuestion);

      try {
        const nextState = await getAskLumiaState(String(profile.id || ''));
        setQuestionState(nextState);
      } catch {
        // keep existing state
      }
    } finally {
      setVerifyingPayment(false);
      setLoading(false);
    }
  }, [buildHistoryForRequest, lang, profile, validateQuestion]);

  const submitQuestion = useCallback(async (rawQuestion: string, options: SubmitOptions) => {
    const normalizedQuestion = rawQuestion.trim();
    const validationError = validateQuestion(normalizedQuestion);

    if (validationError) {
      setError(validationError);
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    const requestedTier: AskLumiaTier = questionState?.nextTier || (profile.isPremium ? 'premium' : 'free');
    if (requestedTier === 'stars' && questionState?.starsPaymentRequired) {
      await submitStarsQuestion(normalizedQuestion, options);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    const shouldAppendUserMessage = options.appendUserMessage;
    const userMessageId = shouldAppendUserMessage ? `user-${Date.now()}` : options.failedMessageId || null;

    if (shouldAppendUserMessage) {
      const userMessage: ChatMessage = {
        id: userMessageId || `user-${Date.now()}`,
        role: 'user',
        text: normalizedQuestion,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setFailedQuestion(null);
      setFailedMessageId(null);
    }

    try {
      const result = await chatWithAstra(
        buildHistoryForRequest(options.failedMessageId),
        normalizedQuestion,
        profile,
        requestedTier
      );

      const botMsg: ChatMessage = {
        id: `oracle-answer-${Date.now()}`,
        role: 'model',
        text: result.answer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setFailedQuestion(null);
      setFailedMessageId(null);
      setInput('');

      if (result.state) {
        setQuestionState(result.state);
      }
    } catch (submitError: any) {
      setError(submitError?.message || getText(lang, 'oracle.send_error'));
      setErrorCode(submitError?.code || null);
      setFailedQuestion(normalizedQuestion);
      setFailedMessageId(userMessageId);
      setInput(normalizedQuestion);

      if (submitError?.code === 'STARS_PAYMENT_REQUIRED') {
        setPendingStarsQuestion(normalizedQuestion);
      }

      try {
        const nextState = await getAskLumiaState(String(profile.id || ''));
        setQuestionState(nextState);
      } catch {
        // keep existing state
      }
    } finally {
      setLoading(false);
    }
  }, [buildHistoryForRequest, lang, profile, questionState, submitStarsQuestion, validateQuestion]);

  const handleStarsUnlock = useCallback(() => {
    const question = (pendingStarsQuestion || failedQuestion || input).trim();
    if (!question || loading || stateLoading) return;
    void submitStarsQuestion(question, {
      appendUserMessage: !messages.some((message) => message.role === 'user' && message.text === question),
      failedMessageId,
    });
  }, [failedMessageId, failedQuestion, input, loading, messages, pendingStarsQuestion, stateLoading, submitStarsQuestion]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading || stateLoading) return;
    void submitQuestion(input, { appendUserMessage: true });
  }, [input, loading, stateLoading, submitQuestion]);

  const handleRetry = useCallback(() => {
    if (loading) return;

    if (failedQuestion) {
      void submitQuestion(failedQuestion, {
        appendUserMessage: false,
        failedMessageId,
      });
      return;
    }

    setError(null);
    setErrorCode(null);
  }, [failedMessageId, failedQuestion, loading, submitQuestion]);

  const inputDisabled = loading || stateLoading;
  const sendDisabled = inputDisabled || !input.trim();
  const sendLabel = getSendLabel(lang, questionState);
  const stateCopy = getStateStrings(lang, questionState);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-astro-bg">
      <div className="shrink-0 border-b border-astro-border/30 bg-astro-bg/90 backdrop-blur-xl">
        <div className="space-y-air-sm px-4 pt-4 pb-3 sm:px-5">
          <div className="lumia-glass rounded-air-panel px-4 py-4 sm:px-5 sm:py-5">
            <p className="lumia-label tracking-[0.2em]">{getText(lang, 'oracle.hero_label')}</p>
            <h1 className="mt-2 font-serif text-2xl text-astro-text sm:text-[1.95rem]">
              {getText(lang, 'oracle.hero_title')}
            </h1>
            <p className="lumia-muted mt-2 text-sm leading-relaxed sm:text-[15px]">
              {getText(lang, 'oracle.hero_body')}
            </p>
          </div>

          <div className="mt-3 rounded-2xl border border-astro-border/55 bg-astro-card/45 px-4 py-4 sm:px-5">
            <p className="lumia-label tracking-[0.18em]">{stateCopy.label}</p>
            <p className="mt-2 text-base font-semibold text-astro-text sm:text-lg">{stateCopy.title}</p>
            <p className="lumia-muted mt-2 text-sm leading-relaxed">{stateCopy.body}</p>

            {questionState?.nextTier === 'stars' && questionState.starsPaymentRequired && (
              <p className="mt-3 text-xs leading-relaxed text-amber-300">
                {lang === 'ru'
                  ? `Открыть глубокий ответ за ${questionState.starsCost ?? 0} Stars. Или получить всё в Premium.`
                  : `Unlock a deep answer for ${questionState.starsCost ?? 0} Stars. Or get everything in Premium.`}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {questionState?.nextTier === 'stars' && questionState.starsPaymentRequired && (
                <button
                  type="button"
                  onClick={handleStarsUnlock}
                  disabled={loading || stateLoading || (!input.trim() && !pendingStarsQuestion && !failedQuestion)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-astro-highlight transition-colors hover:border-astro-highlight/50 hover:bg-astro-highlight/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {lang === 'ru'
                    ? `Открыть за ${questionState.starsCost ?? 0} Stars`
                    : `Unlock for ${questionState.starsCost ?? 0} Stars`}
                </button>
              )}
              {questionState?.nextTier !== 'premium' && onPremiumRequired && (
                <button
                  type="button"
                  onClick={onPremiumRequired}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-astro-highlight transition-colors hover:border-astro-highlight/50 hover:bg-astro-highlight/15"
                >
                  {getText(lang, 'oracle.state_open_premium')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <p className="lumia-label mb-air-sm tracking-[0.18em]">{getText(lang, 'oracle.history_label')}</p>

        {loadingHistory && messages.length === 0 ? (
          <div className="pt-8 text-center text-sm text-astro-subtext">{getText(lang, 'oracle.loading_history')}</div>
        ) : (
          <div className="space-y-air">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[82%] sm:text-base ${
                    msg.role === 'user'
                      ? 'rounded-br-md bg-astro-text text-astro-bg'
                      : 'rounded-bl-md border border-astro-border/55 bg-astro-card/55 text-astro-text'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {!loadingHistory && messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-astro-border/45 bg-astro-card/25 px-4 py-5 text-sm leading-relaxed text-astro-subtext">
                {getText(lang, 'oracle.history_empty')}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex space-x-2 rounded-3xl rounded-bl-md border border-astro-border/55 bg-astro-card/55 px-4 py-3">
                  {verifyingPayment ? (
                    <span className="text-sm text-astro-subtext">
                      {lang === 'ru' ? 'Проверяем оплату…' : 'Verifying payment…'}
                    </span>
                  ) : (
                    <>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '300ms' }} />
                    </>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-astro-border/30 bg-astro-bg/94 backdrop-blur-xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        <div className="px-4 pt-4 pb-3 sm:px-5">
          {error && (
            <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/8 p-3 text-sm text-red-200">
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {errorCode === 'PREMIUM_REQUIRED' && onPremiumRequired ? (
                  <button
                    type="button"
                    onClick={onPremiumRequired}
                    className="rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-astro-highlight"
                  >
                    {getText(lang, 'oracle.open_premium')}
                  </button>
                ) : errorCode === 'STARS_PAYMENT_REQUIRED' || errorCode === 'STARS_PAYMENT_FAILED' ? (
                  <button
                    type="button"
                    onClick={handleStarsUnlock}
                    disabled={loading || (!input.trim() && !pendingStarsQuestion && !failedQuestion)}
                    className="rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-astro-highlight disabled:opacity-50"
                  >
                    {lang === 'ru'
                      ? `Открыть за ${questionState?.starsCost ?? 0} Stars`
                      : `Unlock for ${questionState?.starsCost ?? 0} Stars`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading}
                    className="rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-astro-highlight disabled:opacity-50"
                  >
                    {getText(lang, 'oracle.retry')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-air-panel border border-astro-border/55 bg-astro-card/45 px-4 py-4">
            <p className="lumia-label tracking-[0.18em]">{getText(lang, 'oracle.composer_label')}</p>
            <p className="lumia-muted mt-2 text-sm leading-relaxed">{getText(lang, 'oracle.composer_body')}</p>

            <div className="mt-4 rounded-2xl border border-astro-border/55 bg-astro-bg/16 px-4 py-3 transition-colors focus-within:border-astro-highlight/35">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={getText(lang, 'oracle.placeholder')}
                className="min-h-[76px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-astro-text outline-none placeholder:text-astro-subtext sm:text-base"
                disabled={inputDisabled}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-astro-subtext">
                {questionState?.nextTier === 'stars'
                  ? `${questionState.starsCost ?? 0} Stars`
                  : questionState?.nextTier === 'premium'
                    ? getText(lang, 'oracle.state_premium_label')
                    : getText(lang, 'oracle.state_free_label')}
              </p>
              <button
                type="button"
                onClick={handleSend}
                disabled={sendDisabled}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-astro-highlight px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? getText(lang, 'oracle.thinking') : sendLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
