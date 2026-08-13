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
} from '../../../../lib/natalReading/natalQuestion';
import {
  appendNatalQuestionMessage,
  ensureNatalQuestionThread,
  findNatalQuestionAnswer,
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
}) {
  const [messages, usage] = await Promise.all([
    listNatalQuestionMessages({ userId: input.userId, chartId: input.chartId, pairLimit: 8 }),
    getNatalQuestionUsage({
      userId: input.userId,
      usageDate: input.usageDate,
      timezone: input.timezone,
    }),
  ]);
  return {
    chartId: input.chartId,
    messages,
    usage,
    promptVersion: NATAL_QUESTION_IDENTITY.promptVersion,
    voiceVersion: NATAL_QUESTION_IDENTITY.voiceVersion,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  const ready = await ensureValidContext(req, res, {
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
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
  if (ctx.chartId == null) {
    return res.status(409).json({
      error: 'Saved natal chart required',
      code: 'NATAL_QUESTION_CHART_REQUIRED',
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
    return res.status(200).json(await snapshot({ userId, chartId, usageDate, timezone: quotaTimezone }));
  }

  const question = normalizePersonalForecastQuestionInput(req.body?.question);
  const normalizedQuestion = normalizePersonalForecastQuestionSearch(question);
  const history = await listNatalQuestionMessages({ userId, chartId, pairLimit: 8 });
  const last = history.at(-1);
  const retryingUnanswered = last?.role === 'user'
    && normalizePersonalForecastQuestionInput(last.text).toLocaleLowerCase()
      === question.toLocaleLowerCase();

  if (!retryingUnanswered) {
    const moderation = moderateNatalQuestion({
      question,
      language: ctx.profile.language === 'en' ? 'en' : 'ru',
      existingQuestions: history
        .filter((message) => message.role === 'user')
        .map((message) => message.text),
    });
    if (moderation.status !== 'approved') {
      return res.status(400).json({
        error: 'Question rejected',
        code: 'NATAL_QUESTION_REJECTED',
        moderation,
      });
    }
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
    });
    const questionHash = createHash('sha256')
      .update(`${userId}:${chartId}:${normalizedQuestion}`)
      .digest('hex')
      .slice(0, 24);
    const answerResult = await withContentGenerationLock({
      lockKey: `natal-question:${userId}:${chartId}:${questionHash}`,
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
          },
        });
      },
    });
    if (answerResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(answerResult.retryAfterMs));
    }
    return res.status(200).json(await snapshot({
      userId,
      chartId,
      usageDate,
      timezone: quotaTimezone,
    }));
  } catch (error) {
    if (error instanceof NatalQuestionLimitError) {
      return res.status(429).json({
        error: 'Daily question limit reached',
        code: error.code,
        usage: error.usage,
      });
    }
    console.error(
      '[natal/questions] request failed:',
      error instanceof Error ? error.message : error,
    );
    return res.status(503).json({
      error: 'Question answer unavailable',
      code: 'NATAL_QUESTION_GENERATION_FAILED',
    });
  }
}
