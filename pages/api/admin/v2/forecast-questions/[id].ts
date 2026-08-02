import type { NextApiRequest, NextApiResponse } from 'next';
import { APP_VOICE_VERSION } from '../../../../../lib/appVoice';
import {
  AdminAuthError,
  handleAdminError,
} from '../../../../../lib/adminAuth';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getCachedPersonalForecast } from '../../../../../lib/personalForecastCache';
import {
  PERSONAL_FORECAST_QUESTION_PROMPT_VERSION,
  appendPersonalForecastQuestionAnswerHistory,
  generatePersonalForecastQuestionAnswer,
  preparePersonalForecastQuestionHistory,
} from '../../../../../lib/personalForecastQuestionGeneration';
import {
  claimPersonalForecastQuestionGeneration,
  completePersonalForecastQuestionAnswer,
  failPersonalForecastQuestionGeneration,
  getPersonalForecastQuestionById,
  moderatePendingPersonalForecastQuestion,
  type StoredPersonalForecastQuestion,
} from '../../../../../lib/personalForecastQuestionStore';
import {
  resolveReadingContext,
} from '../../../../../lib/natalReading/apiHelper';
import {
  buildPersonalForecastChartFingerprint,
  type PersonalForecastPeriod,
} from '../../../../../lib/personalForecastContract';

export const config = { maxDuration: 180 };

async function generateApprovedAnswer(
  question: StoredPersonalForecastQuestion,
): Promise<StoredPersonalForecastQuestion> {
  try {
    const ctx = await resolveReadingContext(
      question.userId,
      question.chartId,
    );
    if (!ctx?.chartData) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_CHART_REQUIRED',
        'The saved natal chart is unavailable.',
      );
    }
    const contextLanguage = ctx.profile.language === 'en' ? 'en' : 'ru';
    if (
      (question.chartId != null && question.chartId !== ctx.chartId)
      || question.chartFingerprint
        !== buildPersonalForecastChartFingerprint(ctx.chartData)
      || question.language !== contextLanguage
    ) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED',
        'The saved question no longer matches its natal chart context.',
      );
    }
    if (
      question.promptVersion !== PERSONAL_FORECAST_QUESTION_PROMPT_VERSION
      || question.voiceVersion !== APP_VOICE_VERSION
    ) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_QUESTION_VERSION_CHANGED',
        'The saved question belongs to an obsolete answer prompt or voice.',
      );
    }
    const cached = await getCachedPersonalForecast({
      ctx,
      period: question.period as PersonalForecastPeriod,
      periodKey: question.periodKey,
    }, { allowExpired: true });
    if (!cached) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_REQUIRED',
        'The matching saved period forecast is unavailable.',
      );
    }
    if (cached.inputHash !== question.forecastInputHash) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_VERSION_CHANGED',
        'The saved question belongs to a different forecast version.',
      );
    }
    if (ctx.chartId == null) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_CHART_REQUIRED',
        'The saved natal chart is unavailable.',
      );
    }
    const historySession = await preparePersonalForecastQuestionHistory({
      userId: question.userId,
      chartId: ctx.chartId,
      questionRecordId: question.id,
      question: question.questionText,
      period: question.period as PersonalForecastPeriod,
      periodKey: question.periodKey,
      source: question.source,
    });
    const generated = await generatePersonalForecastQuestionAnswer({
      question: question.questionText,
      language: question.language,
      period: question.period as PersonalForecastPeriod,
      periodKey: question.periodKey,
      forecast: cached.forecast,
      historyContext: historySession.historyContext,
    });
    const history = await appendPersonalForecastQuestionAnswerHistory({
      userId: question.userId,
      chartId: ctx.chartId,
      questionRecordId: question.id,
      source: question.source,
      period: question.period as PersonalForecastPeriod,
      periodKey: question.periodKey,
      forecastInputHash: cached.inputHash,
      language: question.language,
      session: historySession,
      generated,
    });
    const saved = await completePersonalForecastQuestionAnswer({
      id: question.id,
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
      notificationUnread: true,
      notificationPayload: {
        type: 'personal_forecast_question_answer',
        questionId: question.id,
        period: question.period,
        periodKey: question.periodKey,
      },
    });
    if (!saved) {
      throw new AdminAuthError(
        409,
        'PERSONAL_FORECAST_QUESTION_SAVE_CONFLICT',
        'The question changed while the answer was being generated.',
      );
    }
    return saved;
  } catch (error) {
    const code = error instanceof AdminAuthError ? error.code : '';
    const retryable = ![
      'PERSONAL_FORECAST_CHART_REQUIRED',
      'PERSONAL_FORECAST_REQUIRED',
      'PERSONAL_FORECAST_VERSION_CHANGED',
      'PERSONAL_FORECAST_QUESTION_CONTEXT_CHANGED',
      'PERSONAL_FORECAST_QUESTION_VERSION_CHANGED',
    ].includes(code);
    await failPersonalForecastQuestionGeneration({
      id: question.id,
      error: error instanceof Error ? error.message : String(error),
      retryable,
    }).catch(() => undefined);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const id = Number(req.query.id);
  try {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AdminAuthError(400, 'BAD_ID', 'Valid question id required');
    }

    if (req.method === 'GET') {
      await requireAdminPermission(req, 'content.publish');
      await requireAdminPermission(req, 'user.pii.view');
      const question = await getPersonalForecastQuestionById({ id });
      if (!question) {
        throw new AdminAuthError(
          404,
          'NOT_FOUND',
          'Forecast question not found',
        );
      }
      return res.status(200).json({ question });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const ctx = await requireAdminPermission(req, 'content.publish');
    await requireAdminPermission(req, 'user.pii.view');
    const action = String(req.body?.action || '').trim();
    if (!['approve', 'reject', 'retry'].includes(action)) {
      throw new AdminAuthError(
        400,
        'BAD_ACTION',
        'action must be approve, reject, or retry',
      );
    }

    const before = await getPersonalForecastQuestionById({ id });
    if (!before) {
      throw new AdminAuthError(
        404,
        'NOT_FOUND',
        'Forecast question not found',
      );
    }
    if (before.source !== 'custom') {
      throw new AdminAuthError(
        409,
        'CATALOG_QUESTION_NOT_MODERATABLE',
        'Only custom questions use manual moderation.',
      );
    }

    if (action === 'reject') {
      const result = await moderatePendingPersonalForecastQuestion({
        id,
        moderatorId: ctx.userId,
        decision: 'reject',
        reason: String(req.body?.reason || '').trim() || 'manual_rejected',
      });
      if (!result.question || result.question.status !== 'rejected') {
        throw new AdminAuthError(
          409,
          'QUESTION_NOT_PENDING',
          'Only a pending question can be rejected.',
        );
      }
      await recordAdminAction({
        req,
        actor: ctx,
        action: 'content_reverted',
        entityType: 'personal_forecast_question',
        entityId: id,
        before: { status: before.status },
        after: { status: result.question.status },
      });
      return res.status(200).json({ ok: true, question: result.question });
    }

    let claimed: StoredPersonalForecastQuestion | null = null;
    if (action === 'approve') {
      const result = await moderatePendingPersonalForecastQuestion({
        id,
        moderatorId: ctx.userId,
        decision: 'approve',
        reason: String(req.body?.reason || '').trim() || 'manual_approved',
      });
      if (result.claimedForGeneration) claimed = result.question;
      else if (result.question?.status === 'answered') {
        return res.status(200).json({ ok: true, question: result.question });
      } else if (result.question?.status === 'approved') {
        claimed = await claimPersonalForecastQuestionGeneration({ id });
      } else if (result.question?.status === 'generating') {
        return res.status(202).json({
          ok: true,
          code: 'GENERATION_IN_PROGRESS',
          question: result.question,
        });
      }
    } else {
      if (before.status === 'answered') {
        return res.status(200).json({ ok: true, question: before });
      }
      claimed = await claimPersonalForecastQuestionGeneration({ id });
    }
    if (!claimed) {
      throw new AdminAuthError(
        409,
        'QUESTION_NOT_READY_FOR_GENERATION',
        'The question cannot be generated in its current state.',
      );
    }

    const answered = await generateApprovedAnswer(claimed);
    await recordAdminAction({
      req,
      actor: ctx,
      action: 'content_published',
      entityType: 'personal_forecast_question',
      entityId: id,
      before: { status: before.status },
      after: {
        status: answered.status,
        notificationUnread: answered.notificationUnread,
      },
    });
    return res.status(200).json({ ok: true, question: answered });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
