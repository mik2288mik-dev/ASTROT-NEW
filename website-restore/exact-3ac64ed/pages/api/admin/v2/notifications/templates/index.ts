import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../../lib/admin/audit';
import { notificationEngineAdminDb } from '../../../../../../lib/adminNotificationEngineDb';
import { validateNotificationHumanText } from '../../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const ctx = await requireAdminPermission(req, 'push.manage');
    const body = req.body || {};
    const textForValidation = [body.name, body.title, body.body, body.text, body.buttonText].filter(Boolean).join('\n');
    const validation = validateNotificationHumanText(textForValidation);
    if (!validation.ok) throw new AdminAuthError(400, validation.error, validation.message);

    const before = body.id ? await notificationEngineAdminDb.getTemplate(Number(body.id)) : null;
    const template = await notificationEngineAdminDb.saveTemplate({
      id: body.id != null ? Number(body.id) : null,
      scenarioId: body.scenarioId != null && body.scenarioId !== '' ? Number(body.scenarioId) : null,
      name: body.name,
      slot: body.slot,
      targetSegment: body.targetSegment || null,
      title: body.title,
      body: body.body ?? body.text,
      text: body.text ?? body.body,
      buttonText: body.buttonText,
      deepLink: body.deepLink,
      isActive: body.isActive !== false,
      tags: Array.isArray(body.tags) ? body.tags : [],
      weight: Number(body.weight ?? 100),
      visualMode: body.visualMode || 'none',
      notes: body.notes ?? null,
    });
    if (!template) throw new AdminAuthError(500, 'TEMPLATE_SAVE_FAILED', 'Notification template was not saved');

    await recordAdminAction({
      req,
      actor: ctx,
      action: 'settings_changed',
      entityType: 'notification_template',
      entityId: template.id,
      before,
      after: template,
    });

    return res.status(200).json({ ok: true, template });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
