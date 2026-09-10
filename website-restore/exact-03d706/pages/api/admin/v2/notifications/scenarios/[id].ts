import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../../lib/admin/audit';
import { notificationEngineAdminDb } from '../../../../../../lib/adminNotificationEngineDb';

function timeOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : undefined;
}

function objectOrUndefined(value: unknown): Record<string, any> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'BAD_ID' });

  try {
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const ctx = await requireAdminPermission(req, 'push.manage');
    const before = await notificationEngineAdminDb.getScenario(id);
    if (!before) throw new AdminAuthError(404, 'SCENARIO_NOT_FOUND', 'Notification scenario not found');

    const patch: Record<string, any> = {};
    if (typeof req.body?.name === 'string') patch.name = req.body.name;
    if (typeof req.body?.description === 'string') patch.description = req.body.description;
    if (typeof req.body?.enabled === 'boolean') patch.enabled = req.body.enabled;
    if (typeof req.body?.dayPart === 'string') patch.dayPart = req.body.dayPart;
    if (timeOrUndefined(req.body?.timeWindowStart)) patch.timeWindowStart = timeOrUndefined(req.body.timeWindowStart);
    if (timeOrUndefined(req.body?.timeWindowEnd)) patch.timeWindowEnd = timeOrUndefined(req.body.timeWindowEnd);
    if (Number.isFinite(Number(req.body?.priority))) patch.priority = Number(req.body.priority);
    if (Number.isFinite(Number(req.body?.maxPerDay))) patch.maxPerDay = Number(req.body.maxPerDay);
    if (Number.isFinite(Number(req.body?.cooldownHours))) patch.cooldownHours = Number(req.body.cooldownHours);
    if (typeof req.body?.deepLink === 'string') patch.deepLink = req.body.deepLink;
    if (objectOrUndefined(req.body?.audienceRuleJson)) patch.audienceRuleJson = req.body.audienceRuleJson;
    if (objectOrUndefined(req.body?.triggerRuleJson)) patch.triggerRuleJson = req.body.triggerRuleJson;

    const scenario = await notificationEngineAdminDb.updateScenario(id, patch);
    await recordAdminAction({
      req,
      actor: ctx,
      action: 'settings_changed',
      entityType: 'notification_scenario',
      entityId: id,
      before,
      after: scenario,
    });

    return res.status(200).json({ ok: true, scenario });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
