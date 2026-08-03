import type { NextApiRequest, NextApiResponse } from 'next';
import { APP_VOICE_VERSION } from '../../../../lib/appVoice';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { getCachedPersonalForecast } from '../../../../lib/personalForecastCache';
import {
  buildPersonalForecastChartFingerprint,
  getPersonalForecastPeriodKey,
  isCurrentPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  type PersonalForecastPeriod,
} from '../../../../lib/personalForecastContract';
import {
  APPROVED_PERSONAL_FORECAST_QUESTIONS,
  findApprovedPersonalForecastQuestionById,
  getApprovedPersonalForecastQuestions,
  normalizePersonalForecastQuestionSearch,
  questionSupportsPeriod,
  type PersonalForecastQuestionPeriod,
} from '../../../../lib/personalForecastQuestionCatalog';
import {
  PERSONAL_FORECAST_QUESTION_PROMPT_VERSION,
  appendPersonalForecastQuestionAnswerHistory,
  generatePersonalForecastQuestionAnswer,
  preparePersonalForecastQuestionHistory,
} from '../../../../lib/personalForecastQuestionGeneration';
import {
  moderatePersonalForecastCustomQuestion,
  normalizePersonalForecastQuestionInput,
} from '../../../../lib/personalForecastQuestionModeration';
import {
  PersonalForecastQuestionLimitError,
  claimPersonalForecastQuestionGeneration,
  completePersonalForecastQuestionAnswer,
  failPersonalForecastQuestionGeneration,
  getPersonalForecastQuestionById,
  getPersonalForecastQuestionUsage,
  listExistingCustomQuestionTexts,
  listPersonalForecastQuestions,
  listUnreadPersonalForecastQuestionNotifications,
  markPersonalForecastQuestionRead,
  reservePersonalForecastQuestion,
  isPersonalForecastQuestionGenerationStale,
  type PersonalForecastQuestionSnapshotIdentity,
  type StoredPersonalForecastQuestion,
} from '../../../../lib/personalForecastQuestionStore';
import {
  ensureValidContext,
  resolveReadingContext,
  type ReadingContext,
} from '../../../../lib/natalReading/apiHelper';

export const config = { maxDuration: 180 };

type QuestionAction =
  | 'answer_catalog'
  | 'submit_custom'
  | 'retry'
  | 'mark_read';

export function parsePersonalForecastQuestionPeriod(
  value: unknown,
): PersonalForecastQuestionPeriod | null {
  const period = String(value || '').trim();
  return (['day', 'week', 'month'] as const).includes(
    period as PersonalForecastQuestionPeriod,
  )
    ? period as PersonalForecastQuestionPeriod
    : null;
}

export function parsePersonalForecastQuestionAction(
  value: unknown,
): QuestionAction | null {
  const action = String(value || '').trim();
  return (
    ['answer_catalog', 'submit_custom', 'retry', 'mark_read'] as const
  ).includes(action as QuestionAction)
    ? action as QuestionAction
    : null;
}

function publicStatus(
  question: StoredPersonalForecastQuestion,
): 'pending' | 'approved' | 'answered' | 'rejected' {
  if (question.status === 'generating') return 'approved';
  return question.status;
}

export function serializePersonalForecastQuestion(
  question: StoredPersonalForecastQuestion,
) {
  return {
    id: question.id,
    period: question.period,
    periodKey: question.periodKey,
    language: question.language,
    source: question.source,
    catalogQuestionId: question.catalogQuestionId,
    question: question.questionText,
    status: publicStatus(question),
    isGenerating: question.status === 'generating',
    moderationReason: question.moderationReason,
    suggestions: question.moderationSuggestions,
    answer: question.answerText,
    answerMeta: question.answerMeta,
    answeredAt: question.answeredAt,
    canRetry: (
      (question.status === 'approved' && !!question.lastError)
      || isPersonalForecastQuestionGenerationStale(question)
    ),
    notificationUnread: question.notificationUnread,
    notification: question.notificationPayload,
    createdAt: question.createdAt,
  };
}

function readPeriodKey(
  req: NextApiRequest,
  period: PersonalForecastQuestionPeriod,
  timezone: string,
): string {
  const raw = String(
    req.method === 'GET'
      ? req.query.periodKey || ''
      : req.body?.periodKey || '',
  ).trim();
  if (raw && raw.length <= 100) return raw;
  return getPersonalForecastPeriodKey(
    period as PersonalForecastPeriod,
    new Date(),
    timezone,
  );
}

function readQuestionRecordId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function sendSnapshot(input: {
  res: NextApiResponse;
  userId: string;
  ctx: ReadingContext;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  usageDate: string;
  language: 'ru' | 'en';
  question?: StoredPersonalForecastQuestion | null;
  moderation?: unknown;
  statusCode?: number;
}) {
  if (!input.ctx.chartData) {
    throw new Error('PERSONAL_FORECAST_CHART_REQUIRED');
  }
  const chartFingerprint = buildPersonalForecastChartFingerprint(
    input.ctx.chartData,
  );
  const notificationIdentity = {
    chartFingerprint,
    language: input.language,
    promptVersion: PERSONAL_FORECAST_QUESTION_PROMPT_VERSION,
    voiceVersion: APP_VOICE_VERSION,
  } as const;
  const currentForecast = await getCachedPersonalForecast({
    ctx: input.ctx,
    period: input.period as PersonalForecastPeriod,
    periodKey: input.periodKey,
  }, { allowExpired: true });
  const snapshotIdentity: PersonalForecastQuestionSnapshotIdentity | null =
    currentForecast
      ? {
          ...notificationIdentity,
          forecastInputHash: currentForecast.inputHash,
        }
      : null;
  const [questions, usage, unreadCandidates] = await Promise.all([
    snapshotIdentity
      ? listPersonalForecastQuestions({
          userId: input.userId,
          period: input.period,
          periodKey: input.periodKey,
          identity: snapshotIdentity,
        })
      : Promise.resolve([]),
    getPersonalForecastQuestionUsage(input.userId, input.usageDate),
    listUnreadPersonalForecastQuestionNotifications({
      userId: input.userId,
      identity: notificationIdentity,
    }),
  ]);
  type CachedForecast = Awaited<ReturnType<typeof getCachedPersonalForecast>>;
  const forecastByPeriod = new Map<string, Promise<CachedForecast>>();
  forecastByPeriod.set(
    `${input.period}:${input.periodKey}`,
    Promise.resolve(currentForecast),
  );
  const cachedForQuestion = (
    question: StoredPersonalForecastQuestion,
  ): Promise<CachedForecast> => {
    const key = `${question.period}:${question.periodKey}`;
    const existing = forecastByPeriod.get(key);
    if (existing) return existing;
    const request = getCachedPersonalForecast({
      ctx: input.ctx,
      period: question.period as PersonalForecastPeriod,
      periodKey: question.periodKey,
    }, { allowExpired: true }).catch(() => null);
    forecastByPeriod.set(key, request);
    return request;
  };
  const unread = (
    await Promise.all(unreadCandidates.map(async (question) => {
      const cached = await cachedForQuestion(question);
      return cached?.inputHash === question.forecastInputHash
        ? question
        : null;
    }))
  ).filter((question): question is StoredPersonalForecastQuestion => !!question);
  const responseQuestion = input.question
    && snapshotIdentity
    && input.question.chartFingerprint === snapshotIdentity.chartFingerprint
    && input.question.forecastInputHash === snapshotIdentity.forecastInputHash
    && input.question.language === snapshotIdentity.language
    && input.question.promptVersion === snapshotIdentity.promptVersion
    && input.question.voiceVersion === snapshotIdentity.voiceVersion
      ? input.question
      : null;
  return input.res.status(input.statusCode || 200).json({
    catalog: getApprovedPersonalForecastQuestions({
      language: input.language,
      period: input.period,
    }),
    questions: questions.map(serializePersonalForecastQuestion),
    usage,
    unreadNotifications: unread.map((question) => ({
      questionId: question.id,
      period: question.period,
      periodKey: question.periodKey,
      question: question.questionText,
      payload: question.notificationPayload,
      answeredAt: question.answeredAt,
    })),
    question: responseQuestion
      ? serializePersonalForecastQuestion(responseQuestion)
      : undefined,
    moderation: input.moderation,
  });
}

async function generateAndSave(input: {
  question: StoredPersonalForecastQuestion;
  ctx: ReadingContext;
  notificationUnread: boolean;
}): Promise<StoredPersonalForecastQuestion> {
  try {
    if (!input.ctx.chartData) throw new Error('PERSONAL_FORECAST_CHART_REQUIRED');
    if (input.ctx.chartId == null) throw new Error('PERSONAL_FORECAST_CHART_REQUIRED');
    const contextLanguage = input.ctx.profile.language === 'en' ? 'en' : 'ru';
    const contextFingerprint = buildPersonalForecastChartFingerprint(
      input.ctx.chartData,
    );
    if (
      (input.question.chartId != null
        && input.question.chartId !== input.ctx.chartId)
      || input.question.chartFingerprint !== contextFingerprint
      || input.question.language !== contextLanguage
    ) {
      throw new Error('PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED');
    }
    if (
      input.question.promptVersion
        !== PERSONAL_FORECAST_QUESTION_PROMPT_VERSION
      || input.question.voiceVersion !== APP_VOICE_VERSION
    ) {
      throw new Error('PERSONAL_FORECAST_QUESTION_VERSION_CHANGED');
    }
    const cached = await getCachedPersonalForecast({
      ctx: input.ctx,
      period: input.question.period as PersonalForecastPeriod,
      periodKey: input.question.periodKey,
    }, { allowExpired: true });
    if (!cached) throw new Error('PERSONAL_FORECAST_REQUIRED');
    if (cached.inputHash !== input.question.forecastInputHash) {
      throw new Error('PERSONAL_FORECAST_VERSION_CHANGED');
    }
    const historySession = await preparePersonalForecastQuestionHistory({
      userId: input.question.userId,
      chartId: input.ctx.chartId,
      questionRecordId: input.question.id,
      question: input.question.questionText,
      period: input.question.period as PersonalForecastPeriod,
      periodKey: input.question.periodKey,
      source: input.question.source,
    });
    const generated = await generatePersonalForecastQuestionAnswer({
      question: input.question.questionText,
      language: input.question.language,
      period: input.question.period as PersonalForecastPeriod,
      periodKey: input.question.periodKey,
      forecast: cached.forecast,
      historyContext: historySession.historyContext,
    });
    const history = await appendPersonalForecastQuestionAnswerHistory({
      userId: input.question.userId,
      chartId: input.ctx.chartId,
      questionRecordId: input.question.id,
      source: input.question.source,
      period: input.question.period as PersonalForecastPeriod,
      periodKey: input.question.periodKey,
      forecastInputHash: cached.inputHash,
      language: input.question.language,
      session: historySession,
      generated,
    });
    const saved = await completePersonalForecastQuestionAnswer({
      id: input.question.id,
      answerText: generated.answer,
      answerMeta: {
        evidenceIds: generated.evidenceIds,
        semanticFactIds: generated.semanticFactIds,
        atomIds: generated.atomIds,
        domainKeys: generated.domainKeys,
        personalizationFactKeys: generated.personalizationFactKeys,
        userMessageIds: generated.userMessageIds,
        semanticFingerprints: generated.semanticFingerprints,
        generationAttempts: generated.generationAttempts,
        astrologyThreadId: history.threadId,
        generatedArtifactId: history.generatedArtifactId,
        generatedAt: generated.generatedAt,
        promptVersion: generated.promptVersion,
        voiceVersion: generated.voiceVersion,
      },
      modelId: generated.model,
      notificationUnread: input.notificationUnread,
      notificationPayload: input.notificationUnread
        ? {
            type: 'personal_forecast_question_answer',
            questionId: input.question.id,
            period: input.question.period,
            periodKey: input.question.periodKey,
          }
        : null,
    });
    if (!saved) throw new Error('PERSONAL_FORECAST_QUESTION_SAVE_CONFLICT');
    return saved;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = ![
      'PERSONAL_FORECAST_CHART_REQUIRED',
      'PERSONAL_FORECAST_REQUIRED',
      'PERSONAL_FORECAST_VERSION_CHANGED',
      'PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED',
      'PERSONAL_FORECAST_QUESTION_VERSION_CHANGED',
    ].includes(message);
    await failPersonalForecastQuestionGeneration({
      id: input.question.id,
      error: message,
      retryable,
    }).catch(() => undefined);
    throw error;
  }
}

async function ensureExistingOrGenerate(input: {
  question: StoredPersonalForecastQuestion;
  created: boolean;
  userId: string;
  ctx: ReadingContext;
}): Promise<
  | { kind: 'ready'; question: StoredPersonalForecastQuestion }
  | { kind: 'pending'; question: StoredPersonalForecastQuestion }
> {
  if (input.question.status === 'answered') {
    return { kind: 'ready', question: input.question };
  }
  if (input.question.status === 'pending') {
    return { kind: 'pending', question: input.question };
  }
  if (input.question.status === 'rejected') {
    return { kind: 'ready', question: input.question };
  }

  let claimed = input.created && input.question.status === 'generating'
    ? input.question
    : null;
  if (
    !claimed
    && (
      input.question.status === 'approved'
      || input.question.status === 'generating'
    )
  ) {
    claimed = await claimPersonalForecastQuestionGeneration({
      id: input.question.id,
      userId: input.userId,
    });
  }
  if (!claimed) return { kind: 'pending', question: input.question };
  return {
    kind: 'ready',
    question: await generateAndSave({
      question: claimed,
      ctx: input.ctx,
      notificationUnread: false,
    }),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
    });
  }
  if (!ctx.chartData) {
    return res.status(409).json({
      error: 'Natal chart required',
      code: 'PERSONAL_FORECAST_CHART_REQUIRED',
    });
  }

  const rawPeriod = req.method === 'GET' ? req.query.period : req.body?.period;
  const period = parsePersonalForecastQuestionPeriod(rawPeriod);
  if (!period) {
    return res.status(400).json({
      error: 'Invalid period',
      code: 'PERSONAL_FORECAST_QUESTION_PERIOD_INVALID',
    });
  }
  const language: 'ru' | 'en' = ctx.profile.language === 'en' ? 'en' : 'ru';
  const timezone = normalizeForecastTimezone(
    ctx.chartData.timezone || ctx.profile.birthTimezone,
  );
  const periodKey = readPeriodKey(req, period, timezone);
  const primaryContext = await resolveReadingContext(userId, null);
  const quotaTimezone = normalizeForecastTimezone(
    primaryContext?.profile.birthTimezone
      || primaryContext?.chartData?.timezone
      || 'Europe/Moscow',
  );
  const usageDate = getPersonalForecastPeriodKey(
    'day',
    new Date(),
    quotaTimezone,
  );

  if (req.method === 'GET') {
    return sendSnapshot({
      res,
      userId,
      ctx,
      period,
      periodKey,
      usageDate,
      language,
    });
  }

  const action = parsePersonalForecastQuestionAction(req.body?.action);
  if (!action) {
    return res.status(400).json({
      error: 'Invalid action',
      code: 'PERSONAL_FORECAST_QUESTION_ACTION_INVALID',
    });
  }

  try {
    if (action === 'mark_read') {
      const id = readQuestionRecordId(req.body?.questionRecordId);
      if (!id) {
        return res.status(400).json({
          error: 'Invalid questionRecordId',
          code: 'PERSONAL_FORECAST_QUESTION_ID_INVALID',
        });
      }
      const question = await markPersonalForecastQuestionRead({ id, userId });
      if (!question) {
        return res.status(404).json({
          error: 'Question not found',
          code: 'PERSONAL_FORECAST_QUESTION_NOT_FOUND',
        });
      }
      return sendSnapshot({
        res,
        userId,
        ctx,
        period: question.period,
        periodKey: question.periodKey,
        usageDate,
        language,
        question,
      });
    }

    if (action === 'retry') {
      const id = readQuestionRecordId(req.body?.questionRecordId);
      if (!id) {
        return res.status(400).json({
          error: 'Invalid questionRecordId',
          code: 'PERSONAL_FORECAST_QUESTION_ID_INVALID',
        });
      }
      const existing = await getPersonalForecastQuestionById({ id, userId });
      if (!existing) {
        return res.status(404).json({
          error: 'Question not found',
          code: 'PERSONAL_FORECAST_QUESTION_NOT_FOUND',
        });
      }
      if (existing.status === 'answered') {
        return sendSnapshot({
          res,
          userId,
          ctx,
          period: existing.period,
          periodKey: existing.periodKey,
          usageDate,
          language,
          question: existing,
        });
      }
      const contextFingerprint = buildPersonalForecastChartFingerprint(
        ctx.chartData,
      );
      if (
        (existing.chartId != null && existing.chartId !== ctx.chartId)
        || existing.chartFingerprint !== contextFingerprint
        || existing.language !== language
      ) {
        return res.status(409).json({
          error: 'The saved question belongs to a different chart context',
          code: 'PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED',
        });
      }
      const claimed = await claimPersonalForecastQuestionGeneration({
        id,
        userId,
      });
      if (!claimed) {
        return sendSnapshot({
          res,
          userId,
          ctx,
          period: existing.period,
          periodKey: existing.periodKey,
          usageDate,
          language,
          question: existing,
          statusCode: 202,
        });
      }
      const question = await generateAndSave({
        question: claimed,
        ctx,
        notificationUnread: false,
      });
      return sendSnapshot({
        res,
        userId,
        ctx,
        period: question.period,
        periodKey: question.periodKey,
        usageDate,
        language,
        question,
      });
    }

    if (!isCurrentPersonalForecastPeriodKey(
      period as PersonalForecastPeriod,
      periodKey,
      timezone,
    )) {
      return res.status(400).json({
        error: 'New questions require the current forecast period',
        code: 'PERSONAL_FORECAST_QUESTION_PERIOD_KEY_INVALID',
      });
    }
    const cachedForecast = await getCachedPersonalForecast({
      ctx,
      period: period as PersonalForecastPeriod,
      periodKey,
    });
    if (!cachedForecast) {
      return res.status(409).json({
        error: 'Personal forecast required',
        code: 'PERSONAL_FORECAST_REQUIRED',
      });
    }
    const chartFingerprint = buildPersonalForecastChartFingerprint(ctx.chartData);
    if (action === 'answer_catalog') {
      const catalogQuestionId = String(req.body?.questionId || '').trim();
      const catalogQuestion = findApprovedPersonalForecastQuestionById(
        catalogQuestionId,
      );
      if (
        !catalogQuestion
        || !questionSupportsPeriod(catalogQuestion, period)
      ) {
        return res.status(400).json({
          error: 'Approved question is not available for this period',
          code: 'PERSONAL_FORECAST_CATALOG_QUESTION_INVALID',
        });
      }
      const reserved = await reservePersonalForecastQuestion({
        userId,
        chartId: ctx.chartId,
        chartFingerprint,
        forecastInputHash: cachedForecast.inputHash,
        period,
        periodKey,
        usageDate,
        language,
        source: 'catalog',
        catalogQuestionId: catalogQuestion.id,
        questionText: catalogQuestion.text[language],
        normalizedQuestion: normalizePersonalForecastQuestionSearch(
          catalogQuestion.text[language],
        ),
        status: 'generating',
        moderationReason: 'catalog_approved',
        promptVersion: PERSONAL_FORECAST_QUESTION_PROMPT_VERSION,
        voiceVersion: APP_VOICE_VERSION,
      });
      const outcome = await ensureExistingOrGenerate({
        question: reserved.question,
        created: reserved.created,
        userId,
        ctx,
      });
      return sendSnapshot({
        res,
        userId,
        ctx,
        period,
        periodKey,
        usageDate,
        language,
        question: outcome.question,
        statusCode: outcome.kind === 'pending' ? 202 : 200,
      });
    }

    const questionText = normalizePersonalForecastQuestionInput(
      req.body?.question,
    );
    const existingCustomQuestions = await listExistingCustomQuestionTexts({
      userId,
      usageDate,
    });
    const moderation = moderatePersonalForecastCustomQuestion({
      question: questionText,
      language,
      period,
      existingCustomQuestions,
    });
    const initialStatus = moderation.status === 'approved'
      ? 'generating'
      : moderation.status;
    const reserved = await reservePersonalForecastQuestion({
      userId,
      chartId: ctx.chartId,
      chartFingerprint,
      forecastInputHash: cachedForecast.inputHash,
      period,
      periodKey,
      usageDate,
      language,
      source: 'custom',
      catalogQuestionId: null,
      questionText,
      normalizedQuestion: moderation.normalizedQuestion,
      status: initialStatus,
      moderationReason: moderation.reason,
      moderationSuggestions: moderation.suggestions,
      promptVersion: PERSONAL_FORECAST_QUESTION_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
    });
    if (reserved.question.status === 'pending') {
      return sendSnapshot({
        res,
        userId,
        ctx,
        period,
        periodKey,
        usageDate,
        language,
        question: reserved.question,
        moderation,
        statusCode: 202,
      });
    }
    if (reserved.question.status === 'rejected') {
      return sendSnapshot({
        res,
        userId,
        ctx,
        period,
        periodKey,
        usageDate,
        language,
        question: reserved.question,
        moderation,
      });
    }
    const outcome = await ensureExistingOrGenerate({
      question: reserved.question,
      created: reserved.created,
      userId,
      ctx,
    });
    return sendSnapshot({
      res,
      userId,
      ctx,
      period,
      periodKey,
      usageDate,
      language,
      question: outcome.question,
      moderation,
      statusCode: outcome.kind === 'pending' ? 202 : 200,
    });
  } catch (error) {
    if (error instanceof PersonalForecastQuestionLimitError) {
      return res.status(429).json({
        error: 'Daily question limit reached',
        code: error.code,
        usage: error.usage,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('[personal-forecast-questions] request failed:', message);
    const isForecastConflict = (
      message === 'PERSONAL_FORECAST_REQUIRED'
      || message === 'PERSONAL_FORECAST_VERSION_CHANGED'
      || message === 'PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED'
      || message === 'PERSONAL_FORECAST_QUESTION_VERSION_CHANGED'
    );
    return res.status(isForecastConflict ? 409 : 503).json({
      error: 'Question answer unavailable',
      code: isForecastConflict
        ? message
        : 'PERSONAL_FORECAST_QUESTION_GENERATION_FAILED',
    });
  }
}

export const PERSONAL_FORECAST_APPROVED_QUESTION_COUNT =
  APPROVED_PERSONAL_FORECAST_QUESTIONS.length;
