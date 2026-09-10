import type { NextApiRequest, NextApiResponse } from 'next';
import {
  AdminAuthError,
  handleAdminError,
} from '../../../../../lib/adminAuth';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import {
  getPersonalForecastQuestionById,
  moderatePendingPersonalForecastQuestion,
} from '../../../../../lib/personalForecastQuestionStore';

export const config = { maxDuration: 30 };

const RETIRED_CODE = 'PERSONAL_FORECAST_DIALOGUE_RETIRED';

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

    if (action !== 'reject') {
      throw new AdminAuthError(
        410,
        RETIRED_CODE,
        'The legacy forecast question generator is retired until the real dialogue product is implemented.',
      );
    }

    const result = await moderatePendingPersonalForecastQuestion({
      id,
      moderatorId: ctx.userId,
      decision: 'reject',
      reason: String(req.body?.reason || '').trim() || 'legacy_dialogue_retired',
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
  } catch (error) {
    return handleAdminError(res, error);
  }
}
