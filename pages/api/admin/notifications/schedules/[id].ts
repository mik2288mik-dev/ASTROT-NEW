import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeNotificationSchedule } from '../../../../../lib/adminSerializers';
import { parseSchedulePayload } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid schedule id' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'PUT') {
      const all = await db.notification_schedules.listAll();
      const existing = all.find((s: any) => Number(s.id) === id);
      if (!existing) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Schedule not found' });
      }
      const parsed = parseSchedulePayload(
        { ...req.body, templateId: Number(existing.template_id) },
        true
      );
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error, message: parsed.message });
      }
      const sch = await db.notification_schedules.upsert({
        id,
        templateId: Number(existing.template_id),
        sendTime: parsed.data.sendTime,
        timezone: parsed.data.timezone,
        repeatMode: parsed.data.repeatMode,
        isActive: parsed.data.isActive,
      });
      if (!sch) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Schedule not found' });
      }
      return res.status(200).json({ schedule: serializeNotificationSchedule(sch) });
    }

    if (req.method === 'DELETE') {
      const ok = await db.notification_schedules.delete(id);
      if (!ok) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Schedule not found' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
