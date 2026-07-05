import type { NextApiRequest, NextApiResponse } from 'next';
import type { AskLumiaTier } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { normalizeAskLumiaTier } from '../../../../lib/contentAccessTier';
import { unlockContentLayer } from '../../../../lib/contentArchitecture';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { extractPersonalizationPrivacyFlags, logger } from '../../../../lib/logger';
import { buildPersonalizationContext, describePersonalizationContext } from '../../../../lib/personalizationContext';
import {
  ASK_LUMIA_FREE_STARTER_CACHE_KEY,
  generateAskLumiaAnswer,
  getAskLumiaState,
  getQuestionCacheKey,
  getQuestionVariantForTier,
  normalizeQuestion,
  sanitizeQuestionHistory,
} from '../../../../lib/questionContent';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const DUPLICATE_WINDOW_SECONDS = 20;

function mapErrorMessage(code: string, lang: 'ru' | 'en') {
  const messages = {
    QUESTION_REQUIRED: {
      ru: 'Введите вопрос для астролога.',
      en: 'Enter a question for the astrologer.',
    },
    QUESTION_TOO_SHORT: {
      ru: 'Вопрос слишком короткий. Добавьте немного контекста.',
      en: 'Your question is too short. Add a little more detail.',
    },
    QUESTION_TOO_LONG: {
      ru: 'Вопрос слишком длинный. Сократите его и попробуйте снова.',
      en: 'Your question is too long. Shorten it and try again.',
    },
    USER_NOT_FOUND: {
      ru: 'Профиль не найден. Открой приложение заново.',
      en: 'Profile not found. Reopen the app and try again.',
    },
    FREE_QUESTION_ALREADY_USED: {
      ru: 'Стартовый бесплатный вопрос уже использован. Продолжить можно в Premium.',
      en: 'The starter free question has already been used. Continue in Premium.',
    },
    PREMIUM_REQUIRED: {
      ru: 'Чат с астрологом доступен в Premium.',
      en: 'Astrologer chat is available in Premium.',
    },
    DAILY_LIMIT_REACHED: {
      ru: 'На сегодня лимит исчерпан — 3 вопроса в день. Возвращайся завтра.',
      en: "You've reached today's limit of 3 questions. Come back tomorrow.",
    },
    ASK_UPSTREAM_ERROR: {
      ru: 'Астролог не смог подготовить ответ. Попробуйте ещё раз.',
      en: 'The astrologer could not prepare an answer. Please try again.',
    },
    PERSIST_FAILED: {
      ru: 'Ответ был подготовлен, но не сохранился. Попробуйте ещё раз.',
      en: 'The answer was prepared but could not be saved. Please try again.',
    },
  } as const;

  return messages[code as keyof typeof messages]?.[lang] || messages.ASK_UPSTREAM_ERROR[lang];
}

function buildChartContext(user: any, primaryChart: any) {
  const chartData = primaryChart?.chart_data;
  const lines = [
    `Name: ${user?.name || 'Unknown'}`,
    user?.birth_date ? `Birth date: ${user.birth_date}` : '',
    user?.birth_time ? `Birth time: ${user.birth_time}` : '',
    user?.birth_place ? `Birth place: ${user.birth_place}` : '',
    chartData?.sun?.sign ? `Sun: ${chartData.sun.sign}` : '',
    chartData?.moon?.sign ? `Moon: ${chartData.moon.sign}` : '',
    chartData?.rising?.sign ? `Ascendant: ${chartData.rising.sign}` : '',
    chartData?.element ? `Element: ${chartData.element}` : '',
    chartData?.rulingPlanet ? `Ruling planet: ${chartData.rulingPlanet}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function getRequestedTier(value: unknown, fallback: AskLumiaTier): AskLumiaTier {
  const normalized = normalizeAskLumiaTier(value);
  if (normalized === 'free' || normalized === 'premium') return normalized;
  return fallback;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestStartedAt = Date.now();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.method === 'GET'
    ? String(req.query.userId || '').trim()
    : String(req.body?.userId || '').trim();

  if (!userId) {
    return res.status(400).json({
      error: 'Bad request',
      code: 'USER_NOT_FOUND',
      message: 'userId is required',
    });
  }
  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND',
      message: 'Profile not found',
    });
  }

  const lang: 'ru' | 'en' = user.language === 'en' ? 'en' : 'ru';
  const state = await getAskLumiaState(userId);

  if (req.method === 'GET') {
    return res.status(200).json({ state });
  }

  const normalizedQuestion = normalizeQuestion(String(req.body?.message || ''));
  if (!normalizedQuestion) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'QUESTION_REQUIRED',
      message: mapErrorMessage('QUESTION_REQUIRED', lang),
      state,
    });
  }

  if (normalizedQuestion.length < MIN_QUESTION_LENGTH) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'QUESTION_TOO_SHORT',
      message: mapErrorMessage('QUESTION_TOO_SHORT', lang),
      state,
    });
  }

  if (normalizedQuestion.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'QUESTION_TOO_LONG',
      message: mapErrorMessage('QUESTION_TOO_LONG', lang),
      state,
    });
  }

  const requestedTier = getRequestedTier(req.body?.requestedTier, state.nextTier);
  const variant = getQuestionVariantForTier(requestedTier);

  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_request_start',
    userId,
    surface: 'question',
    metadata: {
      questionLength: normalizedQuestion.length,
      requestedTier,
    },
  });

  if (requestedTier === 'premium' && !state.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: mapErrorMessage('PREMIUM_REQUIRED', lang),
      state,
    });
  }

  if (requestedTier === 'free' && !state.freeStarterAvailable) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: mapErrorMessage('PREMIUM_REQUIRED', lang),
      state,
    });
  }

  const duplicate = await db.astro_questions.findRecentDuplicate(userId, normalizedQuestion, DUPLICATE_WINDOW_SECONDS);
  if (duplicate) {
    return res.status(200).json({
      answer: duplicate.answer,
      createdAt: new Date(duplicate.created_at).toISOString(),
      reusedRecent: true,
      tier: requestedTier,
      state,
    });
  }

  // Дневной лимит для премиума — не больше 3 новых вопросов в день.
  if (state.isPremium && (state.dailyRemaining ?? 0) <= 0) {
    return res.status(429).json({
      error: 'Daily limit reached',
      code: 'DAILY_LIMIT_REACHED',
      message: mapErrorMessage('DAILY_LIMIT_REACHED', lang),
      state,
    });
  }

  const personalizationContext = await buildPersonalizationContext({
    userId,
    surface: 'ask_lumia',
    includeTodayPulse: true,
    includeRecentCheckIns: true,
    includeRecentQuestions: true,
    includeRelationshipContext: true,
  });
  const contextFlags = extractPersonalizationPrivacyFlags(personalizationContext);
  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_has_personalization_context',
    userId,
    chartId: personalizationContext?.chartId ?? null,
    surface: 'question',
    metadata: contextFlags,
  });

  const baseChartContext = personalizationContext
    ? describePersonalizationContext(personalizationContext, lang)
    : buildChartContext(user, await db.natal_charts.getPrimary(userId));
  const genderNote = user?.gender === 'male'
    ? '\n\nПол пользователя: мужской — обращайся в мужском роде («ты сделал»).'
    : user?.gender === 'female'
      ? '\n\nПол пользователя: женский — обращайся в женском роде («ты сделала»).'
      : '\n\nПол пользователя не указан — пиши нейтрально, не выдавай пол читателя.';
  const chartContext = baseChartContext + genderNote;
  const history = sanitizeQuestionHistory(req.body?.history);

  let answer: string;
  try {
    answer = await generateAskLumiaAnswer({
      language: lang,
      tier: requestedTier,
      question: normalizedQuestion,
      chartContext,
      history,
    });
  } catch (error: any) {
    logger.error({
      scope: 'ask-lumia',
      event: 'ask_lumia_error',
      userId,
      accessTier: requestedTier,
      surface: 'question',
      variant,
      status: 'error',
      errorCode: 'ASK_UPSTREAM_ERROR',
      durationMs: Date.now() - requestStartedAt,
      metadata: { error: error?.message || 'generation_failed' },
    });
    return res.status(502).json({
      error: 'Ask the astrologer failed',
      code: 'ASK_UPSTREAM_ERROR',
      message: mapErrorMessage('ASK_UPSTREAM_ERROR', lang),
      state,
    });
  }

  const questionCacheKey = getQuestionCacheKey(normalizedQuestion);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: requestedTier === 'premium' ? 'premium' : 'free',
    contentSurface: 'question',
    contentVariant: variant,
  });

  try {
    if (requestedTier === 'free') {
      await unlockContentLayer({
        userId,
        accessTier: 'free',
        contentSurface: 'question',
        contentVariant: 'brief',
        cacheKey: ASK_LUMIA_FREE_STARTER_CACHE_KEY,
      });
    } else {
      await unlockContentLayer({
        userId,
        accessTier: 'premium',
        contentSurface: 'question',
        contentVariant: 'full',
        cacheKey: questionCacheKey,
      });
    }

    await db.astro_questions.add(userId, normalizedQuestion, answer);
    await db.content_interpretations.upsertByUser(userId, {
      accessTier: requestedTier,
      contentSurface: 'question',
      contentVariant: variant,
      cacheKey: questionCacheKey,
      inputHash: questionCacheKey,
      content: {
        question: normalizedQuestion,
        answer,
        tier: requestedTier,
      },
      modelTier,
      isPersistent: true,
      canRegenerateForLumi: false,
      legacySource: `ask_lumia.${requestedTier}`,
    });
  } catch (error: any) {
    logger.error({
      scope: 'ask-lumia',
      event: 'ask_lumia_error',
      userId,
      accessTier: requestedTier,
      surface: 'question',
      variant,
      status: 'error',
      errorCode: 'PERSIST_FAILED',
      durationMs: Date.now() - requestStartedAt,
      metadata: { error: error?.message || 'persist_failed' },
    });

    return res.status(500).json({
      error: 'Persist failed',
      code: 'PERSIST_FAILED',
      message: mapErrorMessage('PERSIST_FAILED', lang),
      details: error?.message,
      state: await getAskLumiaState(userId),
    });
  }

  const nextState = await getAskLumiaState(userId);

  return res.status(200).json({
    answer,
    createdAt: new Date().toISOString(),
    reusedRecent: false,
    tier: requestedTier,
    state: nextState,
  });
}

export default withRateLimit(handler, (req) => (
  req.method === 'GET' ? RATE_LIMIT_CONFIGS.FREE : RATE_LIMIT_CONFIGS.AI_FREE
));
