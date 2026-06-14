import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AskLumiaState, AskLumiaTier, ChatMessage, UserProfile } from '../types';
import { chatWithAstra, getAskLumiaState, getOracleHistory } from '../services/astrologyService';
import { getText } from '../constants';
import { getAskPresetQuestions } from '../components/lumia-ui/v2/LzAskPresets';
import { hasActivePremium } from '../lib/accessMatrix';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const HISTORY_LIMIT = 12;

interface OracleChatProps {
  profile: UserProfile;
  onPremiumRequired?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  layout?: 'full' | 'dm';
}

type SubmitOptions = {
  appendUserMessage: boolean;
  failedMessageId?: string | null;
};

function getSendLabel(lang: 'ru' | 'en', state: AskLumiaState | null, isPremium: boolean) {
  if (!state || state.nextTier === 'free') return getText(lang, 'oracle.send_free');
  if (state.nextTier === 'premium' && isPremium) return getText(lang, 'oracle.send_premium');
  return getText(lang, 'oracle.open_premium');
}

function getStateStrings(lang: 'ru' | 'en', state: AskLumiaState | null, isPremium: boolean) {
  if (!state || state.nextTier === 'free') {
    return {
      label: getText(lang, 'oracle.state_free_label'),
      title: getText(lang, 'oracle.state_free_title'),
      body: getText(lang, 'oracle.state_free_body'),
    };
  }

  if (state.nextTier === 'premium' && isPremium) {
    return {
      label: getText(lang, 'oracle.state_premium_label'),
      title: getText(lang, 'oracle.state_premium_title'),
      body: getText(lang, 'oracle.state_premium_body'),
    };
  }

  return {
    label: getText(lang, 'oracle.state_need_premium_label'),
    title: getText(lang, 'oracle.state_need_premium_title'),
    body: getText(lang, 'oracle.state_need_premium_body'),
  };
}

export const OracleChat: React.FC<OracleChatProps> = ({
  profile,
  onPremiumRequired,
  layout = 'full',
}) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const activePremium = hasActivePremium(profile);
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

  const submitQuestion = useCallback(async (rawQuestion: string, options: SubmitOptions) => {
    const normalizedQuestion = rawQuestion.trim();
    const validationError = validateQuestion(normalizedQuestion);

    if (validationError) {
      setError(validationError);
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    const requestedTier: AskLumiaTier =
      questionState?.nextTier || (activePremium ? 'premium' : 'free');

    if (requestedTier !== 'free' && !activePremium) {
      onPremiumRequired?.();
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
      const code = submitError?.code || null;
      if (code === 'PREMIUM_REQUIRED') {
        setError(submitError?.message || getText(lang, 'oracle.state_need_premium_body'));
        setErrorCode('PREMIUM_REQUIRED');
      } else {
        setError(submitError?.message || getText(lang, 'oracle.send_error'));
        setErrorCode(code);
      }
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
      setLoading(false);
    }
  }, [activePremium, buildHistoryForRequest, lang, onPremiumRequired, profile, questionState, validateQuestion]);

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
  const sendLabel = getSendLabel(lang, questionState, activePremium);
  const stateCopy = getStateStrings(lang, questionState, activePremium);
  const showPremiumCta = !activePremium && questionState?.nextTier !== 'free';
  const quickQuestions = getAskPresetQuestions(lang);

  const handleQuickPick = (question: string) => {
    setInput(question);
    void submitQuestion(question, { appendUserMessage: true });
  };

  const compact = layout === 'dm';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-mono-bg">
      {!compact ? (
      <div className="shrink-0 border-b border-mono-line bg-mono-white/95 backdrop-blur-xl">
        <div className="space-y-3 px-4 pt-4 pb-3 sm:px-5">
          <div className="rounded-mono-card border border-mono-line bg-mono-white px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">{getText(lang, 'oracle.hero_label')}</p>
            <h1 className="mt-2 text-2xl font-bold text-mono-ink sm:text-[1.95rem]">
              {getText(lang, 'oracle.hero_title')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-mono-muted sm:text-[15px]">
              {getText(lang, 'oracle.hero_body')}
            </p>
          </div>

          <div className="rounded-mono-card border border-mono-line bg-mono-plate px-4 py-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mono-muted">{stateCopy.label}</p>
            <p className="mt-2 text-base font-semibold text-mono-ink sm:text-lg">{stateCopy.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-mono-muted">{stateCopy.body}</p>

            {showPremiumCta && onPremiumRequired && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPremiumRequired}
                  className="inline-flex min-h-[44px] items-center rounded-mono-pill border border-mono-line bg-mono-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-mono-ink"
                >
                  {getText(lang, 'oracle.state_open_premium')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="shrink-0 border-b border-mono-line bg-mono-white px-4 py-3">
          <h1 className="text-[22px] font-bold text-mono-ink">Lumia</h1>
          <p className="mt-1 text-[13px] text-mono-muted">{stateCopy.body}</p>
          {showPremiumCta && onPremiumRequired ? (
            <button
              type="button"
              onClick={onPremiumRequired}
              className="mt-2 text-[12px] font-semibold text-mono-ink underline underline-offset-2"
            >
              {getText(lang, 'oracle.state_open_premium')}
            </button>
          ) : null}
        </div>
      )}

      <div className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 ${compact ? 'pb-2' : ''}`}>
        {!compact ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-mono-muted">{getText(lang, 'oracle.history_label')}</p>
        ) : null}

        {loadingHistory && messages.length === 0 ? (
          <div className="pt-8 text-center text-sm text-mono-muted">{getText(lang, 'oracle.loading_history')}</div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[15px] leading-relaxed sm:max-w-[82%] sm:text-base ${
                    msg.role === 'user'
                      ? 'bg-mono-plate text-mono-ink'
                      : 'bg-mono-black text-white'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {!loadingHistory && messages.length === 0 && (
              <div className="rounded-mono-card border border-dashed border-mono-line bg-mono-plate px-4 py-5 text-sm leading-relaxed text-mono-muted">
                {getText(lang, 'oracle.history_empty')}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex space-x-2 rounded-[20px] bg-mono-plate px-4 py-3">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-mono-muted" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-mono-muted" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-mono-muted" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-mono-line bg-mono-white/95 backdrop-blur-xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        <div className="px-4 pt-4 pb-3 sm:px-5">
          {compact ? (
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={inputDisabled}
                  onClick={() => handleQuickPick(question)}
                  className="shrink-0 rounded-full border border-mono-line bg-mono-plate px-3 py-2 text-[12px] font-semibold text-mono-ink disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          {error && (
            <div className="mb-3 rounded-mono-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {errorCode === 'PREMIUM_REQUIRED' && onPremiumRequired ? (
                  <button
                    type="button"
                    onClick={onPremiumRequired}
                    className="rounded-mono-pill border border-mono-line bg-mono-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-mono-ink"
                  >
                    {getText(lang, 'oracle.open_premium')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading}
                    className="rounded-mono-pill border border-mono-line bg-mono-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-mono-ink disabled:opacity-50"
                  >
                    {getText(lang, 'oracle.retry')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={`rounded-mono-card border border-mono-line bg-mono-white px-4 py-4 ${compact ? 'py-3' : ''}`}>
            {!compact ? (
              <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mono-muted">{getText(lang, 'oracle.composer_label')}</p>
            <p className="mt-2 text-sm leading-relaxed text-mono-muted">{getText(lang, 'oracle.composer_body')}</p>
              </>
            ) : null}

            <div className={`rounded-mono-card border border-mono-line bg-mono-plate px-4 py-3 transition-colors focus-within:border-mono-ink ${compact ? 'mt-0' : 'mt-4'}`}>
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
                className="min-h-[76px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-mono-ink outline-none placeholder:text-mono-muted sm:text-base"
                disabled={inputDisabled}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-mono-muted">
                {questionState?.nextTier === 'premium' && activePremium
                  ? getText(lang, 'oracle.state_premium_label')
                  : questionState?.nextTier === 'free'
                    ? getText(lang, 'oracle.state_free_label')
                    : getText(lang, 'oracle.state_need_premium_label')}
              </p>
              <button
                type="button"
                onClick={handleSend}
                disabled={sendDisabled}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-mono-pill bg-mono-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
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
