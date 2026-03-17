import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { sendAdminNotification } from '../../../../lib/adminNotifications';
import { serializeNotificationHistoryItem } from '../../../../lib/adminSerializers';
import type { AdminNotificationTargetSegment } from '../../../../types';

function isValidSegment(value: unknown): value is AdminNotificationTargetSegment {
  return value === 'all'
    || value === 'premium'
    || value === 'free'
    || value === 'active_7d'
    || value === 'inactive_30d';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);

    const mode = req.body?.mode;
    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
    const targetSegment = req.body?.targetSegment;
    const parsedTemplateId = req.body?.templateId != null ? Number(req.body.templateId) : null;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const bodyRu = typeof req.body?.bodyRu === 'string' ? req.body.bodyRu.trim() : '';
    const bodyEn = typeof req.body?.bodyEn === 'string' ? req.body.bodyEn.trim() : '';

    if (mode !== 'personal' && mode !== 'broadcast') {
      return res.status(400).json({ error: 'INVALID_MODE', message: 'Notification mode is invalid' });
    }
    if (!title) {
      return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Notification title is required' });
    }
    if (!bodyRu && !bodyEn) {
      return res.status(400).json({ error: 'BODY_REQUIRED', message: 'At least one localized body is required' });
    }
    if (mode === 'personal' && !targetUserId) {
      return res.status(400).json({ error: 'TARGET_USER_REQUIRED', message: 'Target user is required' });
    }
    if (mode === 'broadcast' && !isValidSegment(targetSegment)) {
      return res.status(400).json({ error: 'TARGET_SEGMENT_REQUIRED', message: 'Target segment is required' });
    }

    const result = await sendAdminNotification({
      createdBy: access.requesterId,
      mode,
      targetUserId: mode === 'personal' ? targetUserId : null,
      targetSegment: mode === 'broadcast' ? targetSegment : null,
        templateId: Number.isInteger(parsedTemplateId) && parsedTemplateId !== null && parsedTemplateId > 0 ? parsedTemplateId : null,
      title,
      bodyRu,
      bodyEn,
    });

    return res.status(200).json({
      campaign: serializeNotificationHistoryItem(result.campaign),
    });
  } catch (error: any) {
    if (error?.message === 'TARGET_USER_REQUIRED') {
      return res.status(400).json({ error: 'TARGET_USER_REQUIRED', message: 'Target user is required' });
    }
    if (error?.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Target user not found' });
    }
    if (error?.message === 'TITLE_REQUIRED') {
      return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Notification title is required' });
    }
    if (error?.message === 'MESSAGE_BODY_REQUIRED') {
      return res.status(400).json({ error: 'BODY_REQUIRED', message: 'At least one localized body is required' });
    }
    return handleAdminError(res, error);
  }
}
