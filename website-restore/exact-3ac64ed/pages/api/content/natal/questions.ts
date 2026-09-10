import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { getPersonalForecastPeriodKey, normalizeForecastTimezone } from '../../../../lib/personalForecastContract';
import {
  ensureValidContext,
  resolveReadingContext,
} from '../../../../lib/natalReading/apiHelper';
import {
  type NatalPermanentPremiumReport,
} from '../../../../lib/natalReading/permanentReport';
import {
  generatePermanentPremiumWithLock,
  getCachedPermanentPremiumReport,
  waitForPermanentPremiumReport,
} from '../../../../lib/natalReading/permanentApi';
import {
  generateNatalQuestionAnswer,
  moderateNatalQuestion,
  NATAL_QUESTION_IDENTITY,
  NatalQuestionValidationError,
} from '../../../../lib/natalReading/natalQuestion';
import {
  answeredNatalQuestionTexts,
  appendNatalQuestionMessage,
  ensureNatalQuestionThread,
  findNatalQuestionAnswer,
  FreeNatalQuestionUsedError,
  getFreeNatalQuestionUsage,
  getNatalQuestionUsage,
  listNatalQuestionMessages,
  NatalQuestionLimitError,
  reserveNatalQuestionMessage,
} from '../../../../lib/natalReading/natalQuestionStore';
import { normalizePersonalForecastQuestionInput } from '../../../../lib/personalForecastQuestionModeration';
import { normalizePersonalForecastQuestionSearch } from '../../../../lib/personalForecastQuestionCatalog';
import {
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { diagnosticErrorCode } from '../../../../lib/diagnosticTrace';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';

export const config = { maxDuration: 90 };

async function readPermanentReport(
  userId: string,
  ctx: NonNullable<Awaited<ReturnType<typeof ensureValidContext>>>['ctx'],
): Promise<NatalPermanentPremiumReport> {
  const cached = await getCachedPermanentPremiumReport(ctx);
  if (cached?.content) return cached.content;
  const generated = await generatePermanentPremiumWithLock({ userId, ctx });
  if (generated.status === 'ready') return generated.value.content;
  const waited = await waitForPermanentPremiumReport({ ctx, timeoutMs: 30_000 });
  if (!waited) throw new Error('NATAL_PREMIUM_GENERATION_IN_PROGRESS');
  return waited;
}

async function snapshot(input: {
  userId: string;
  chartId: number;
  usageDate: string;
  timezone: string;
  isPremium: boolean;
}) {
  const [messages, usage, freeQuestion] = await Promise.all([
    listNatalQuestionMessages({ userId: input.userId, chartId: input.chartId, pairLimit: 8 }),
    getNatalQuestionUsage({
      userId: input.userId,
      usageDate: input.usageDate,
      timezone: input.timezone,
    }),
    getFreeNatalQuestionUsage({ userId: input.userId }),
  ]);
  return {
    chartId: input.chartId,
    messages,
    usage,
    access: {
      isPremium: input.isPremium,
      freeQuestionUsed: freeQuestion.used,
      freeQuestionRemaining: freeQuestion.remaining,
    },
    promptVersion: NATAL_QUESTION_IDENTITY.promptVersion,
    voiceVersion: NATAL_QUESTION_IDENTITY.voiceVersion,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const diagnostic = startServerOperationalDiagnostic(req, res, 'natal_question');
  if (req.method !== 'GET' && req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
  const ready = await ensureValidContext(req, res, {
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) {
    diagnostic.log('context', 'error', {
      httpStatus: res.statusCode,
      errorCode: 'NATAL_QUESTION_CONTEXT_REJECTED',
    });
    return;
  }
  const { userId, ctx } = ready;
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  diagnostic.log('context', 'ok', { source: 'owned_selected_chart' });
  const entitlement = await getPremiumEntitlementState(userId);
  if (ctx.chartId == null) {
    diagnostic.log('context', 'error', {
      httpStatus: 409,
      errorCode: 'NATAL_QUESTION_CHART_REQUIRED',
    });
    return res.status(409).json({
      error: 'Saved natal chart required',
      code: 'NATAL_QUESTION_CHART_REQUIRED',
    });
  }
  if (ctx.chartSubjectType !== 'self') {
    diagnostic.log('context', 'error', {
      httpStatus: 409,
      errorCode: 'NATAL_QUESTION_SELF_CHART_REQUIRED',
    });
    return res.status(409).json({
      error: 'Own natal chart required',
      code: 'NATAL_QUESTION_SELF_CHART_REQUIRED',
      message: language === 'ru'
        ? '«Спросить о себе» работает только с твоей основной натальной картой.'
        : 'Ask about yourself works only with your own primary natal chart.',
    });
  }

  const chartId = ctx.chartId;
  const primaryContext = await resolveReadingContext(
    userId,
    null,
    undefined,
    undefined,
    { repairCanonical: false },
  );
  const quotaTimezone = normalizeForecastTimezone(
    primaryContext?.profile.birthTimezone
      || primaryContext?.chartData?.timezone
      || 'Europe/Moscow',
  );
  const usageDate = getPersonalForecastPeriodKey('day', new Date(), quotaTimezone);

  if (req.method === 'GET') {
    const current = await snapshot({
      userId,
      chartId,
      usageDate,
      timezone: quotaTimezone,
      isPremium: entitlement.isPremium,
    });
    diagnostic.log('snapshot', 'ok', { httpStatus: 200, source: 'selected_chart_thread' });
    return res.status(200).json(current);
  }

  const question = normalizePersonalForecastQuestionInput(req.body?.question);
  const normalizedQuestion = normalizePersonalForecastQuestionSearch(question);
  const history = await listNatalQuestionMessages({ userId, chartId, pairLimit: 8 });
  const moderation = moderateNatalQuestion({
    question,
    language,
    existingQuestions: answeredNatalQuestionTexts(history),
  });
  if (moderation.status !== 'approved') {
    diagnostic.log('moderation', 'error', {
      httpStatus: 400,
      errorCode: `NATAL_QUESTION_REJECTED.${moderation.reason}`,
    });
    return res.status(400).json({
      error: 'Question rejected',
      message: language === 'ru'
        ? 'Здесь можно задать только конкретный вопрос о себе, который можно разобрать по сохранённой натальной карте.'
        : 'Only a specific question about you that can be interpreted from your saved natal chart can be answered here.',
      code: 'NATAL_QUESTION_REJECTED',
      moderation,
    });
  }

  try {
    const threadId = await ensureNatalQuestionThread({ userId, chartId });
    const reserved = await reserveNatalQuestionMessage({
      userId,
      chartId,
      threadId,
      text: question,
      normalizedQuestion,
      usageDate,
      timezone: quotaTimezone,
      access: entitlement.isPremium ? 'premium' : 'free',
    });
    const questionHash = createHash('sha256')
      .update(`${userId}:${chartId}:${normalizedQuestion}`)
      .digest('hex')
      .slice(0, 24);
    const answerResult = await withContentGenerationLock({
      lockKey: `natal-question:${questionHash}`,
      operation: 'natal-question-generation',
      readCached: async () => {
        const existing = await findNatalQuestionAnswer({
          userId,
          chartId,
          questionMessageId: reserved.message.id,
        });
        return existing ? { value: existing, source: 'natal_question_thread' } : null;
      },
      generate: async () => {
        diagnostic.log('generation', 'start', { source: 'selected_chart_context' });
        const permanentReport = await readPermanentReport(userId, ctx);
        const currentHistory = await listNatalQuestionMessages({ userId, chartId, pairLimit: 8 });
        const answer = await generateNatalQuestionAnswer({
          chartId,
          profile: ctx.profile,
          chartData: ctx.chartData!,
          permanentReport,
          history: currentHistory,
          question,
        });
        return appendNatalQuestionMessage({
          userId,
          chartId,
          threadId,
          role: 'assistant',
          text: answer.text,
          payload: {
            questionMessageId: reserved.message.id,
            evidenceIds: answer.evidenceIds,
            contractVersion: NATAL_QUESTION_IDENTITY.contractVersion,
            promptVersion: NATAL_QUESTION_IDENTITY.promptVersion,
            voiceVersion: NATAL_QUESTION_IDENTITY.voiceVersion,
            generationAttempts: answer.generationAttempts || 1,
          },
        });
      },
      onLockAcquired: () => diagnostic.log('generation_lock', 'ok'),
      onLockBusy: () => diagnostic.log('generation_lock', 'in_progress'),
    });
    if (answerResult.status === 'in_progress') {
      diagnostic.log('generation', 'in_progress', { httpStatus: 202 });
      return res.status(202).json(generationInProgressPayload(answerResult.retryAfterMs));
    }
    diagnostic.log('generation', 'ok', {
      httpStatus: 200,
      source: answerResult.fromCache ? answerResult.source || 'thread_cache' : 'generated',
      attempt: Number(answerResult.value.payload?.generationAttempts) || undefined,
    });
    return res.status(200).json(await snapshot({
      userId,
      chartId,
      usageDate,
      timezone: quotaTimezone,
      isPremium: entitlement.isPremium,
    }));
  } catch (error) {
    if (error instanceof FreeNatalQuestionUsedError) {
      diagnostic.log('access', 'error', {
        httpStatus: 403,
        errorCode: error.code,
      });
      return res.status(403).json({
        error: 'Free natal question already used',
        code: error.code,
        premiumRequired: true,
        message: language === 'ru'
          ? 'Бесплатный вопрос уже использован. Открой Premium, чтобы задавать до 5 новых вопросов в день.'
          : 'Your free question has already been used. Open Premium to ask up to 5 new questions a day.',
      });
    }
    if (error instanceof NatalQuestionLimitError) {
      diagnostic.log('quota', 'error', {
        httpStatus: 429,
        errorCode: error.code,
      });
      return res.status(429).json({
        error: 'Daily question limit reached',
        code: error.code,
        usage: error.usage,
      });
    }
    const validationCode = error instanceof NatalQuestionValidationError
      ? error.validationCodes[0]
      : null;
    const generationCode = validationCode
      ? `NATAL_QUESTION_VALIDATION_FAILED.${validationCode}`
      : diagnosticErrorCode(error, 'NATAL_QUESTION_GENERATION_FAILED');
    diagnostic.error('generation', error, generationCode, {
      httpStatus: 503,
      errorCode: generationCode,
      attempt: error instanceof NatalQuestionValidationError ? error.attempts : undefined,
    });
    return res.status(503).json({
      error: 'Question answer unavailable',
      message: language === 'ru'
        ? 'Не удалось подготовить ответ по карте. Попробуй отправить вопрос ещё раз.'
        : 'Unable to prepare an answer from the chart. Please submit the question again.',
      code: 'NATAL_QUESTION_GENERATION_FAILED',
    });
  }
  } catch (error) {
    const requestCode = diagnosticErrorCode(error, 'NATAL_QUESTION_REQUEST_FAILED');
    diagnostic.error('request', error, requestCode, {
      httpStatus: 503,
      errorCode: requestCode,
    });
    return res.status(503).json({
      error: 'Question request unavailable',
      code: 'NATAL_QUESTION_REQUEST_FAILED',
    });
  }
}
