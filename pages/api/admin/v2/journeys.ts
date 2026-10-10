import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError, AdminAuthError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { parseActivityRange } from '../../../../lib/admin/activityAnalytics';
import { assembleAttempts, buildJourneyReport, journeyEventLabel, loadJourneyEvents } from '../../../../lib/admin/journeyAnalytics';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const context = await requireAdminPermission(req, 'analytics.view');
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    if (userId && !context.permissions.includes('users.view')) throw new AdminAuthError(403, 'FORBIDDEN', 'Нет права просмотра пользователей');
    if (userId && !/^[a-zA-Z0-9_-]{1,100}$/.test(userId)) throw new AdminAuthError(400, 'INVALID_USER_ID', 'Неверный пользователь');
    const version = typeof req.query.version === 'string' ? req.query.version : undefined;
    if (version && version !== 'unknown' && !/^[0-9][0-9.]{0,30}$/.test(version)) throw new AdminAuthError(400, 'INVALID_VERSION', 'Неверная версия');
    const range = parseActivityRange(req.query);
    const { events, truncated } = await loadJourneyEvents(range, userId, version);
    const safeEvents = events.map(e => ({ ...e, name: context.permissions.includes('users.view') ? e.name : null }));
    if (userId) return res.status(200).json({ range, truncated, attempts: assembleAttempts(safeEvents, Date.now()).map(a => ({
      ...a, events: a.events.map(e => ({ ...e, label: journeyEventLabel(e) })),
    })), screens: safeEvents.filter(e => ['screen_view','screen_exit','ui_action'].includes(e.type)).map(e => ({ ...e, label: journeyEventLabel(e) })) });
    const report = buildJourneyReport(safeEvents, range, Date.now(), truncated);
    if (!context.permissions.includes('users.view')) report.attempts = [];
    report.attempts = report.attempts.slice(0, 200);
    return res.status(200).json(report);
  } catch (error) { return handleAdminError(res, error); }
}
