import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChatMessage, UserProfile } from '../types';
import { chatWithAstra, getOracleHistory } from '../services/astrologyService';
import { getText } from '../constants';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const HISTORY_LIMIT = 12;

interface OracleChatProps {
  profile: UserProfile;
  onPremiumRequired?: () => void;
}

type SubmitOptions = {
  appendUserMessage: boolean;
  failedMessageId?: string | null;
};

const getOracleUiText = (lang: 'ru' | 'en') => ({
  emptyQuestion: lang === 'ru' ? 'Введите вопрос для Lumia.' : 'Enter a question for Lumia.',
  shortQuestion: lang === 'ru'
    ? 'Вопрос слишком короткий. Добавьте немного контекста.'
    : 'Your question is too short. Add a little more detail.',
  longQuestion: lang === 'ru'
    ? 'Вопрос слишком длинный. Сократите его и попробуйте снова.'
    : 'Your question is too long. Shorten it and try again.',
  historyError: lang === 'ru'
    ? 'Не удалось загрузить последние вопросы. Можно спросить снова.'
    : 'Could not load your recent questions. You can still ask a new one.',
  sendError: lang === 'ru'
    ? 'Lumia сейчас не смогла ответить. Попробуйте ещё раз.'
    : 'Lumia could not answer right now. Please try again.',
  retry: lang === 'ru' ? 'Повторить' : 'Retry',
  openPremium: lang === 'ru' ? 'Открыть Premium' : 'Open Premium',
  loadingHistory: lang === 'ru' ? 'Загружаю ваши вопросы...' : 'Loading your recent questions...',
  premiumRequired: lang === 'ru'
    ? 'Оракул доступен только в Lumia Premium.'
    : 'Oracle is available only in Lumia Premium.',
});

export const OracleChat: React.FC<OracleChatProps> = ({ profile, onPremiumRequired }) => {
  const lang = profile.language === 'en' ? 'en' : 'ru';
  const uiText = useMemo(() => getOracleUiText(lang), [lang]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [failedMessageId, setFailedMessageId] = useState<string | null>(null);

  const buildIntroMessage = useCallback((): ChatMessage => ({
    id: 'init',
    role: 'model',
    text: getText(profile.language, 'oracle.intro'),
    timestamp: Date.now(),
  }), [profile.language]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

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
        setError(historyError?.message || uiText.historyError);
        setErrorCode(historyError?.code || null);
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [buildIntroMessage, profile, uiText.historyError]);

  const validateQuestion = useCallback((question: string) => {
    const normalized = question.trim();
    if (!normalized) return uiText.emptyQuestion;
    if (normalized.length < MIN_QUESTION_LENGTH) return uiText.shortQuestion;
    if (normalized.length > MAX_QUESTION_LENGTH) return uiText.longQuestion;
    return null;
  }, [uiText.emptyQuestion, uiText.longQuestion, uiText.shortQuestion]);

  const buildHistoryForRequest = useCallback((messageIdToSkip?: string | null) => (
    messages
      .filter((message) => message.id !== 'init' && message.id !== messageIdToSkip)
      .map((message) => ({ role: message.role, text: message.text }))
  ), [messages]);

  const submitQuestion = useCallback(async (
    rawQuestion: string,
    options: SubmitOptions
  ) => {
    const normalizedQuestion = rawQuestion.trim();
    const validationError = validateQuestion(normalizedQuestion);

    if (validationError) {
      setError(validationError);
      setErrorCode('VALIDATION_ERROR');
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
        profile
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
    } catch (submitError: any) {
      setError(submitError?.message || uiText.sendError);
      setErrorCode(submitError?.code || null);
      setFailedQuestion(normalizedQuestion);
      setFailedMessageId(userMessageId);
      setInput(normalizedQuestion);
    } finally {
      setLoading(false);
    }
  }, [buildHistoryForRequest, profile, uiText.sendError, validateQuestion]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    void submitQuestion(input, { appendUserMessage: true });
  }, [input, loading, submitQuestion]);

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
    setLoadingHistory(true);
    setMessages((current) => (current.length ? current : [buildIntroMessage()]));
    void getOracleHistory(profile, HISTORY_LIMIT)
      .then((historyItems) => {
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
      })
      .catch((historyError: any) => {
        setError(historyError?.message || uiText.historyError);
        setErrorCode(historyError?.code || null);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [buildIntroMessage, failedMessageId, failedQuestion, loading, profile, submitQuestion, uiText.historyError]);

  const inputDisabled = loading || errorCode === 'PREMIUM_REQUIRED';

  return (
    <div className="flex h-full w-full flex-col bg-astro-bg">
      <div className="shrink-0 border-b border-astro-border bg-astro-bg/95 p-4 text-center backdrop-blur">
        <h2 className="font-serif text-sm font-bold uppercase tracking-widest text-astro-text">Lumia Oracle</h2>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto p-4">
        {loadingHistory && messages.length === 0 ? (
          <div className="pt-8 text-center text-sm text-astro-subtext">{uiText.loadingHistory}</div>
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
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-astro-text font-medium text-astro-bg'
                      : 'rounded-bl-sm border border-astro-border bg-astro-card font-light text-astro-text'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex space-x-2 rounded-2xl rounded-bl-sm border border-astro-border bg-astro-card px-4 py-3">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-astro-subtext" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-astro-border bg-astro-card p-4"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <p>{error}</p>
            <div className="mt-3 flex gap-2">
              {errorCode === 'PREMIUM_REQUIRED' && onPremiumRequired ? (
                <button
                  onClick={onPremiumRequired}
                  className="rounded-lg border border-astro-highlight/40 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-astro-highlight"
                >
                  {uiText.openPremium}
                </button>
              ) : (
                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="rounded-lg border border-astro-highlight/40 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-astro-highlight disabled:opacity-50"
                >
                  {uiText.retry}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-astro-border bg-astro-bg px-4 py-3 shadow-sm transition-colors focus-within:border-astro-highlight">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={getText(profile.language, 'oracle.placeholder')}
            className="flex-1 bg-transparent text-sm text-astro-text outline-none placeholder-astro-subtext"
            disabled={inputDisabled}
          />
          <button
            onClick={handleSend}
            disabled={inputDisabled || !input.trim()}
            className="rounded-full bg-astro-highlight p-2 text-white transition-transform hover:scale-105 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
