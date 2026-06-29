import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../../lib/admin/audit';
import { notificationEngineAdminDb } from '../../../../../../lib/adminNotificationEngineDb';
import { validateNotificationHumanText } from '../../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'BAD_ID' });

  try {
    const ctx = await requireAdminPermission(req, 'push.manage');
    const before = await notificationEngineAdminDb.getTemplate(id);
    if (!before) throw new AdminAuthError(404, 'TEMPLATE_NOT_FOUND', 'Notification template not found');

    if (req.method === 'DELETE') {
      await notificationEngineAdminDb.deleteTemplate(id);
      await recordAdminAction({
        req,
        actor: ctx,
        action: 'settings_changed',
        entityType: 'notification_template',
        entityId: id,
        before,
        after: { deleted: true },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const body = { ...before, ...(req.body || {}), id };
      const textForValidation = [body.name, body.title, body.body, body.text, body.buttonText].filter(Boolean).join('\n');
      const validation = validateNotificationHumanText(textForValidation);
      if (!validation.ok) throw new AdminAuthError(400, validation.error, validation.message);

      const template = await notificationEngineAdminDb.saveTemplate(body);
      await recordAdminAction({
        req,
        actor: ctx,
        action: 'settings_changed',
        entityType: 'notification_template',
        entityId: id,
        before,
        after: template,
      });
      return res.status(200).json({ ok: true, template });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
