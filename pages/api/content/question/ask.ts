import type { NextApiRequest, NextApiResponse } from 'next';
import type { AskLumiaTier } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { unlockContentLayer } from '../../../../lib/contentArchitecture';
import {
  ASK_LUMIA_FREE_STARTER_CACHE_KEY,
  ASK_LUMIA_LUMI_COST,
  generateAskLumiaAnswer,
  getAskLumiaState,
  getQuestionCacheKey,
  getQuestionVariantForTier,
  normalizeQuestion,
  sanitizeQuestionHistory,
} from '../../../../lib/questionContent';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { buildPersonalizationContext, describePersonalizationContext } from '../../../../lib/personalizationContext';
import { extractPersonalizationPrivacyFlags, logger } from '../../../../lib/logger';
import { getContentAccessConfig } from '../../../../lib/contentAccessMatrix';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const DUPLICATE_WINDOW_SECONDS = 20;

function mapErrorMessage(code: string, lang: 'ru' | 'en', lumiCost = ASK_LUMIA_LUMI_COST) {
  const messages = {
    QUESTION_REQUIRED: {
      ru: 'Введите вопрос для Lumia.',
      en: 'Enter a question for Lumia.',
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
      ru: 'Профиль не найден. Открой Lumia заново.',
      en: 'Profile not found. Reopen Lumia and try again.',
    },
    FREE_QUESTION_ALREADY_USED: {
      ru: 'Стартовый бесплатный вопрос уже использован. Следующий вопрос можно открыть за Lumi.',
      en: 'The starter free question has already been used. The next question can be opened with Lumi.',
    },
    LUMI_REQUIRED: {
      ru: `Следующий вопрос можно открыть за ${lumiCost} Lumi.`,
      en: `The next question can be opened for ${lumiCost} Lumi.`,
    },
    PREMIUM_REQUIRED: {
      ru: 'Глубокий уровень ответов доступен в Lumia Premium.',
      en: 'The deeper answer layer is available in Lumia Premium.',
    },
    INSUFFICIENT_LUMI: {
      ru: 'Недостаточно Lumi для этого вопроса.',
      en: 'Not enough Lumi for this question.',
    },
    ASK_UPSTREAM_ERROR: {
      ru: 'Lumia не смогла подготовить ответ. Попробуйте ещё раз.',
      en: 'Lumia could not prepare an answer. Please try again.',
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

function getRequestedTier(value: unknown): AskLumiaTier | null {
  if (value === 'free' || value === 'lumi' || value === 'premium') {
    return value;
  }
  return null;
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

  const requestedTier = getRequestedTier(req.body?.requestedTier) || state.nextTier;
  const variant = getQuestionVariantForTier(requestedTier);
  const accessConfig = getContentAccessConfig('question', variant);

  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_access_config',
    userId,
    surface: accessConfig?.surface || 'question',
    variant: accessConfig?.variant || variant,
    accessTier: requestedTier,
    metadata: {
      defaultAccessTier: accessConfig?.defaultAccessTier,
      unlockOptions: accessConfig?.unlockOptions,
      lumiCost: accessConfig?.lumiCost ?? null,
      matrixLumiCost: accessConfig?.lumiCost,
      runtimeLumiCost: state.lumiCost,
    },
  });

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
  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_requested_tier',
    userId,
    accessTier: requestedTier,
    surface: 'question',
  });

  if (requestedTier === 'premium' && !state.isPremium) {
    logger.warn({
      scope: 'ask-lumia',
      event: 'ask_lumia_access_denied',
      userId,
      surface: 'question',
      variant,
      accessTier: requestedTier,
      errorCode: 'PREMIUM_REQUIRED',
      metadata: { defaultAccessTier: accessConfig?.defaultAccessTier },
    });
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: mapErrorMessage('PREMIUM_REQUIRED', lang),
      state,
    });
  }

  if (requestedTier === 'free' && !state.freeStarterAvailable) {
    return res.status(409).json({
      error: 'Free question unavailable',
      code: 'FREE_QUESTION_ALREADY_USED',
      message: mapErrorMessage('FREE_QUESTION_ALREADY_USED', lang),
      state,
    });
  }

  if (requestedTier === 'lumi') {
    const expectedLumiCost = accessConfig?.lumiCost ?? ASK_LUMIA_LUMI_COST;
    if (!req.body?.allowLumiSpend) {
      logger.warn({
        scope: 'ask-lumia',
        event: 'ask_lumia_lumi_required',
        userId,
        surface: 'question',
        variant,
        accessTier: requestedTier,
        errorCode: 'LUMI_REQUIRED',
        metadata: { lumiCost: expectedLumiCost },
      });
      return res.status(409).json({
        error: 'Lumi required',
        code: 'LUMI_REQUIRED',
        message: mapErrorMessage('LUMI_REQUIRED', lang, state.lumiCost),
        state,
      });
    }

    if (!state.hasEnoughLumi) {
      return res.status(402).json({
        error: 'Insufficient Lumi',
        code: 'INSUFFICIENT_LUMI',
        message: mapErrorMessage('INSUFFICIENT_LUMI', lang),
        state,
      });
    }
  }

  const duplicate = await db.astro_questions.findRecentDuplicate(userId, normalizedQuestion, DUPLICATE_WINDOW_SECONDS);
  if (duplicate) {
    return res.status(200).json({
      answer: duplicate.answer,
      createdAt: new Date(duplicate.created_at).toISOString(),
      reusedRecent: true,
      tier: requestedTier,
      lumiSpent: 0,
      lumiBalance: state.lumiBalance,
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
  const resolvedTier = requestedTier;
  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_resolved_tier',
    userId,
    accessTier: resolvedTier,
    surface: accessConfig?.surface || 'question',
    variant: accessConfig?.variant || variant,
  });
  const chartContext = personalizationContext
    ? describePersonalizationContext(personalizationContext, lang)
    : buildChartContext(user, await db.natal_charts.getPrimary(userId));
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
      accessTier: resolvedTier,
      surface: 'question',
      variant,
      status: 'error',
      errorCode: 'ASK_UPSTREAM_ERROR',
      durationMs: Date.now() - requestStartedAt,
      metadata: { error: error?.message || 'generation_failed' },
    });
    return res.status(502).json({
      error: 'Ask Lumia failed',
      code: 'ASK_UPSTREAM_ERROR',
      message: mapErrorMessage('ASK_UPSTREAM_ERROR', lang),
      state,
    });
  }

  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_generated_success',
    userId,
    accessTier: resolvedTier,
    surface: 'question',
    variant,
    status: 'ok',
    durationMs: Date.now() - requestStartedAt,
    metadata: { questionLength: normalizedQuestion.length },
  });

  const questionCacheKey = getQuestionCacheKey(normalizedQuestion);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: requestedTier === 'premium' ? 'premium' : requestedTier,
    contentSurface: 'question',
    contentVariant: variant,
  });
  let currentBalance = state.lumiBalance;
  let lumiSpent = 0;
  let unlockCompleted = false;

  try {
    if (requestedTier === 'free') {
      await unlockContentLayer({
        userId,
        accessTier: 'free',
        contentSurface: 'question',
        contentVariant: 'brief',
        cacheKey: ASK_LUMIA_FREE_STARTER_CACHE_KEY,
      });
      unlockCompleted = true;
    } else if (requestedTier === 'lumi') {
      const unlockResult = await unlockContentLayer({
        userId,
        accessTier: 'lumi',
        contentSurface: 'question',
        contentVariant: 'one_off',
        cacheKey: questionCacheKey,
        lumiCost: accessConfig?.lumiCost ?? state.lumiCost,
      });
      unlockCompleted = true;
      lumiSpent = unlockResult.unlock?.lumiSpent || state.lumiCost;
      currentBalance = await db.lumi_transactions.getBalance(userId);
    } else {
      await unlockContentLayer({
        userId,
        accessTier: 'premium',
        contentSurface: 'question',
        contentVariant: 'full',
        cacheKey: questionCacheKey,
      });
      unlockCompleted = true;
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
      accessTier: resolvedTier,
      surface: 'question',
      variant,
      status: 'error',
      errorCode: 'PERSIST_FAILED',
      durationMs: Date.now() - requestStartedAt,
      metadata: { error: error?.message || 'persist_failed' },
    });
    if (requestedTier === 'lumi' && unlockCompleted && lumiSpent > 0) {
      await db.lumi_transactions.add(userId, lumiSpent, 'refund').catch(() => {});
      currentBalance = await db.lumi_transactions.getBalance(userId).catch(() => currentBalance);
    }

    return res.status(500).json({
      error: 'Persist failed',
      code: 'PERSIST_FAILED',
      message: mapErrorMessage('PERSIST_FAILED', lang),
      details: error?.message,
      state: {
        ...(await getAskLumiaState(userId)),
        lumiBalance: currentBalance,
      },
    });
  }

  logger.info({
    scope: 'ask-lumia',
    event: 'ask_lumia_persist_success',
    userId,
    accessTier: resolvedTier,
    surface: 'question',
    variant,
    status: 'ok',
    durationMs: Date.now() - requestStartedAt,
    metadata: {
      questionLength: normalizedQuestion.length,
      modelTier,
      lumiSpent,
    },
  });

  const nextState = await getAskLumiaState(userId);

  return res.status(200).json({
    answer,
    createdAt: new Date().toISOString(),
    reusedRecent: false,
    tier: requestedTier,
    lumiSpent,
    lumiBalance: nextState.lumiBalance,
    state: nextState,
  });
}

export default withRateLimit(handler, (req) => (
  req.method === 'GET' ? RATE_LIMIT_CONFIGS.FREE : RATE_LIMIT_CONFIGS.AI_FREE
));
