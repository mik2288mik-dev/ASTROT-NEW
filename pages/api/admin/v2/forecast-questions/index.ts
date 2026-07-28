import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import {
  listAdminPersonalForecastQuestions,
  type PersonalForecastQuestionSource,
  type PersonalForecastQuestionStatus,
} from '../../../../../lib/personalForecastQuestionStore';
import type {
  PersonalForecastQuestionPeriod,
} from '../../../../../lib/personalForecastQuestionCatalog';

const STATUSES = new Set<PersonalForecastQuestionStatus>([
  'pending',
  'approved',
  'generating',
  'answered',
  'rejected',
]);
const PERIODS = new Set<PersonalForecastQuestionPeriod>([
  'day',
  'week',
  'month',
  'year',
]);
const SOURCES = new Set<PersonalForecastQuestionSource>(['catalog', 'custom']);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    await requireAdminPermission(req, 'content.publish');
    await requireAdminPermission(req, 'user.pii.view');
    const rawStatus = String(req.query.status || '').trim();
    const rawPeriod = String(req.query.period || '').trim();
    const rawSource = String(req.query.source || '').trim();
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 200));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await listAdminPersonalForecastQuestions({
      status: STATUSES.has(rawStatus as PersonalForecastQuestionStatus)
        ? rawStatus as PersonalForecastQuestionStatus
        : null,
      period: PERIODS.has(rawPeriod as PersonalForecastQuestionPeriod)
        ? rawPeriod as PersonalForecastQuestionPeriod
        : null,
      source: SOURCES.has(rawSource as PersonalForecastQuestionSource)
        ? rawSource as PersonalForecastQuestionSource
        : null,
      query: String(req.query.q || '').trim() || null,
      limit,
      offset,
    });
    return res.status(200).json({
      questions: result.questions,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
