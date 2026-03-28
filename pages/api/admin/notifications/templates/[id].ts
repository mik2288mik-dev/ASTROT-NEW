import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import {
  serializeScheduledNotificationTemplate,
  serializeNotificationSchedule,
} from '../../../../../lib/adminSerializers';
import { parseTemplatePayload, existingRowToTemplatePayload } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid template id' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      const row = await db.scheduled_notification_templates.getById(id);
      if (!row) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      const base = serializeScheduledNotificationTemplate(row);
      const schedRows = await db.notification_schedules.listByTemplate(id);
      return res.status(200).json({
        template: {
          ...base,
          schedules: schedRows.map(serializeNotificationSchedule),
        },
      });
    }

    if (req.method === 'PATCH') {
      const onlyActive = typeof req.body?.isActive === 'boolean';
      if (!onlyActive) {
        return res.status(400).json({ error: 'INVALID_PATCH', message: 'Only isActive toggle supported' });
      }
      const existing = await db.scheduled_notification_templates.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      const payload = existingRowToTemplatePayload(existing, { isActive: req.body.isActive });
      const updated = await db.scheduled_notification_templates.update(id, payload);
      const full = await db.scheduled_notification_templates.getById(id);
      const row = full || updated;
      const base = serializeScheduledNotificationTemplate(row);
      const schedRows = await db.notification_schedules.listByTemplate(id);
      return res.status(200).json({
        template: { ...base, schedules: schedRows.map(serializeNotificationSchedule) },
      });
    }

    if (req.method === 'PUT') {
      const parsed = parseTemplatePayload(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error, message: parsed.message });
      }
      const existingBefore = await db.scheduled_notification_templates.getById(id);
      if (!existingBefore) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      const sortOrder = Number(existingBefore.sort_order ?? 0);
      const updated = await db.scheduled_notification_templates.update(id, {
        ...parsed.data,
        sortOrder,
        rotationGroup: null,
      });
      if (!updated) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      const full = await db.scheduled_notification_templates.getById(id);
      const base = serializeScheduledNotificationTemplate(full);
      const schedRows = await db.notification_schedules.listByTemplate(id);
      return res.status(200).json({
        template: { ...base, schedules: schedRows.map(serializeNotificationSchedule) },
      });
    }

    if (req.method === 'DELETE') {
      const ok = await db.scheduled_notification_templates.delete(id);
      if (!ok) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
