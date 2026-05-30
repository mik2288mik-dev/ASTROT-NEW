import type { NextApiRequest, NextApiResponse } from 'next';
import type { AskLumiaTier } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { normalizeAskLumiaTier } from '../../../../lib/contentAccessTier';
import { getContentAccessConfig } from '../../../../lib/contentAccessMatrix';
import { unlockContentLayer } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import { extractPersonalizationPrivacyFlags, logger } from '../../../../lib/logger';
import { buildPersonalizationContext, describePersonalizationContext } from '../../../../lib/personalizationContext';
import {
  ASK_LUMIA_FREE_STARTER_CACHE_KEY,
  ASK_LUMIA_STARS_COST,
  generateAskLumiaAnswer,
  getAskLumiaState,
  getQuestionCacheKey,
  getQuestionVariantForTier,
  normalizeQuestion,
  sanitizeQuestionHistory,
} from '../../../../lib/questionContent';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { unlockContentAfterStarsPayment, unlockContentAfterStarsPaymentNonce, StarsPaymentError } from '../../../../lib/starsContentUnlock';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;
const DUPLICATE_WINDOW_SECONDS = 20;

function mapErrorMessage(code: string, lang: 'ru' | 'en', starsCost = ASK_LUMIA_STARS_COST) {
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
      ru: 'Стартовый бесплатный вопрос уже использован. Следующий вопрос можно открыть за Stars.',
      en: 'The starter free question has already been used. The next question can be opened with Stars.',
    },
    STARS_PAYMENT_REQUIRED: {
      ru: `Следующий вопрос можно открыть за ${starsCost} Stars.`,
      en: `The next question can be opened for ${starsCost} Stars.`,
    },
    STARS_PAYMENT_PENDING: {
      ru: 'Платёж ещё подтверждается. Подождите пару секунд.',
      en: 'Payment is still being confirmed. Please wait a moment.',
    },
    PREMIUM_REQUIRED: {
      ru: 'Глубокий уровень ответов доступен в Lumia Premium.',
      en: 'The full answer layer is available in Lumia Premium.',
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

function getRequestedTier(value: unknown, fallback: AskLumiaTier): AskLumiaTier {
  return normalizeAskLumiaTier(value) || fallback;
}

function buildStarsPayload(starsCost: number) {
  return {
    starsCost,
    starsPaymentRequired: true,
    invoiceType: 'ask_lumia_one_off' as const,
    canCreateInvoice: true,
  };
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

  const requestedTier = getRequestedTier(req.body?.requestedTier, state.nextTier);
  const variant = getQuestionVariantForTier(requestedTier);
  const accessConfig = getContentAccessConfig('question', variant);
  const starsCost = accessConfig?.starsCost ?? state.starsCost;
  const starsPaymentChargeId = String(
    req.body?.starsPaymentChargeId || req.body?.telegramPaymentChargeId || ''
  ).trim();
  const paymentNonce = String(req.body?.paymentNonce || '').trim();

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
      starsCost,
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
      hasPaymentNonce: !!paymentNonce,
      hasStarsPaymentChargeId: !!starsPaymentChargeId,
    },
  });

  if (requestedTier === 'premium' && !state.isPremium) {
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

  if (requestedTier === 'stars') {
    const hasPaymentCredential = !!paymentNonce || !!starsPaymentChargeId;
    if (!hasPaymentCredential) {
      logger.warn({
        scope: 'ask-lumia',
        event: 'ask_lumia_stars_payment_required',
        userId,
        surface: 'question',
        variant,
        accessTier: requestedTier,
        errorCode: 'STARS_PAYMENT_REQUIRED',
        metadata: { starsCost, hasPaymentNonce: false, paymentStatus: 'missing' },
      });
      return res.status(409).json({
        error: 'Stars payment required',
        code: 'STARS_PAYMENT_REQUIRED',
        message: mapErrorMessage('STARS_PAYMENT_REQUIRED', lang, starsCost),
        state,
        ...buildStarsPayload(starsCost),
      });
    }

    if (paymentNonce) {
      const confirmedPayment = await db.star_payments.findConfirmedUnconsumedForPayload({
        userId,
        paymentType: 'content_unlock',
        contentSurface: 'question',
        contentVariant: 'one_off',
        starsAmount: starsCost,
        nonce: paymentNonce,
      });

      logger.info({
        scope: 'ask-lumia',
        event: 'ask_lumia_stars_payment_lookup',
        userId,
        surface: 'question',
        metadata: {
          hasPaymentNonce: true,
          paymentStatus: confirmedPayment ? 'confirmed' : 'pending',
        },
      });

      if (!confirmedPayment) {
        return res.status(409).json({
          error: 'Stars payment pending',
          code: 'STARS_PAYMENT_PENDING',
          message: mapErrorMessage('STARS_PAYMENT_PENDING', lang, starsCost),
          retryAfterMs: 1200,
          state,
          ...buildStarsPayload(starsCost),
        });
      }
    }
  }

  const duplicate = await db.astro_questions.findRecentDuplicate(userId, normalizedQuestion, DUPLICATE_WINDOW_SECONDS);
  if (duplicate) {
    return res.status(200).json({
      answer: duplicate.answer,
      createdAt: new Date(duplicate.created_at).toISOString(),
      reusedRecent: true,
      tier: requestedTier,
      starsSpent: 0,
      starsPaymentRequired: false,
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
      accessTier: requestedTier,
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

  const questionCacheKey = getQuestionCacheKey(normalizedQuestion);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: requestedTier === 'premium' ? 'premium' : requestedTier === 'stars' ? 'stars' : 'free',
    contentSurface: 'question',
    contentVariant: variant,
  });
  let starsSpent = 0;

  try {
    if (requestedTier === 'free') {
      await unlockContentLayer({
        userId,
        accessTier: 'free',
        contentSurface: 'question',
        contentVariant: 'brief',
        cacheKey: ASK_LUMIA_FREE_STARTER_CACHE_KEY,
      });
    } else if (requestedTier === 'stars') {
      let unlockResult;
      try {
        if (paymentNonce) {
          unlockResult = await unlockContentAfterStarsPaymentNonce({
            userId,
            contentSurface: 'question',
            contentVariant: 'one_off',
            cacheKey: questionCacheKey,
            starsAmount: starsCost,
            paymentNonce,
            allowUnscopedCacheKey: true,
          });
        } else {
          unlockResult = await unlockContentAfterStarsPayment({
            userId,
            contentSurface: 'question',
            contentVariant: 'one_off',
            cacheKey: questionCacheKey,
            starsAmount: starsCost,
            starsPaymentChargeId,
            allowUnscopedCacheKey: true,
          });
        }
      } catch (unlockError: any) {
        const unlockCode = unlockError instanceof StarsPaymentError
          ? unlockError.code
          : unlockError?.code || 'STARS_PAYMENT_FAILED';
        const statusCode = unlockCode === 'STARS_PAYMENT_PENDING' ? 409 : 402;
        logger.warn({
          scope: 'ask-lumia',
          event: 'ask_lumia_stars_unlock_failed',
          userId,
          surface: 'question',
          errorCode: unlockCode,
          metadata: {
            hasPaymentNonce: !!paymentNonce,
            paymentStatus: unlockCode,
          },
        });
        return res.status(statusCode).json({
          error: 'Stars payment unlock failed',
          code: unlockCode,
          message: unlockCode === 'STARS_PAYMENT_PENDING'
            ? mapErrorMessage('STARS_PAYMENT_PENDING', lang, starsCost)
            : mapErrorMessage('STARS_PAYMENT_REQUIRED', lang, starsCost),
          retryAfterMs: unlockCode === 'STARS_PAYMENT_PENDING' ? 1200 : undefined,
          state: await getAskLumiaState(userId),
        });
      }
      starsSpent = unlockResult.unlock?.metadata?.starsAmount ?? starsCost;
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
      accessTier: requestedTier === 'stars' ? 'stars' : requestedTier,
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
    starsSpent,
    starsPaymentRequired: false,
    state: nextState,
  });
}

export default withRateLimit(handler, (req) => (
  req.method === 'GET' ? RATE_LIMIT_CONFIGS.FREE : RATE_LIMIT_CONFIGS.AI_FREE
));
