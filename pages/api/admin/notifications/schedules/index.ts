import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeNotificationSchedule } from '../../../../../lib/adminSerializers';
import { parseSchedulePayload } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      const rows = await db.notification_schedules.listAll();
      return res.status(200).json({ schedules: rows.map(serializeNotificationSchedule) });
    }

    const parsed = parseSchedulePayload(req.body, true);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, message: parsed.message });
    }

    const template = await db.scheduled_notification_templates.getById(parsed.data.templateId!);
    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND', message: 'Template not found' });
    }

    const sch = await db.notification_schedules.upsert({
      templateId: parsed.data.templateId!,
      sendTime: parsed.data.sendTime,
      timezone: parsed.data.timezone,
      repeatMode: parsed.data.repeatMode,
      isActive: parsed.data.isActive,
    });

    return res.status(201).json({ schedule: serializeNotificationSchedule(sch) });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
