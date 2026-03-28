import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import {
  serializeScheduledNotificationTemplate,
  serializeNotificationSchedule,
} from '../../../../../lib/adminSerializers';
import { parseTemplatePayload, parseSchedulePayload } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      const rows = await db.scheduled_notification_templates.listWithAsset();
      const templates = await Promise.all(
        rows.map(async (row: any) => {
          const base = serializeScheduledNotificationTemplate(row);
          const schedRows = await db.notification_schedules.listByTemplate(base.id);
          return {
            ...base,
            schedules: schedRows.map(serializeNotificationSchedule),
          };
        })
      );
      return res.status(200).json({ templates });
    }

    const parsed = parseTemplatePayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, message: parsed.message });
    }

    const sortOrder = await db.scheduled_notification_templates.nextSortOrderForSlot(parsed.data.slot);
    const created = await db.scheduled_notification_templates.create({
      ...parsed.data,
      sortOrder,
      rotationGroup: null,
    });
    const full = await db.scheduled_notification_templates.getById(Number(created.id));
    const base = serializeScheduledNotificationTemplate(full);

    const schedulesPayload = Array.isArray(req.body?.schedules) ? req.body.schedules : [];
    const createdSchedules: unknown[] = [];
    for (const s of schedulesPayload) {
      const sp = parseSchedulePayload({ ...s, templateId: base.id }, true);
      if (!sp.ok) continue;
      const sch = await db.notification_schedules.upsert({
        templateId: base.id,
        sendTime: sp.data.sendTime,
        timezone: sp.data.timezone,
        repeatMode: sp.data.repeatMode,
        isActive: sp.data.isActive,
      });
      createdSchedules.push(serializeNotificationSchedule(sch));
    }

    return res.status(201).json({
      template: { ...base, schedules: createdSchedules },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
