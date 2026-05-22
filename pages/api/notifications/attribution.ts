import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser, handleAdminError } from '../../../lib/adminAuth';
import { recordNotificationAttribution } from '../../../services/notificationService';
import { recordRetentionAttribution } from '../../../services/notificationRetentionService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const telegramUser = getVerifiedTelegramUser(req);
    const eventType = req.body?.eventType === 'click' ? 'click' : 'open';
    const nl = req.body?.nl != null ? Number(req.body.nl) : null;
    const notificationId = req.body?.notification_id != null ? Number(req.body.notification_id) : null;
    const campaignId = req.body?.campaign_id != null ? Number(req.body.campaign_id) : null;
    const normalizedEvent =
      req.body?.eventType === 'opened_target_screen'
        ? 'opened_target_screen'
        : eventType === 'click'
          ? 'clicked'
          : 'opened_app';
    await recordRetentionAttribution({
      userId: telegramUser.id,
      notificationId: Number.isFinite(notificationId as number) && Number(notificationId) > 0 ? Number(notificationId) : null,
      notificationLogId: Number.isFinite(nl as number) && Number(nl) > 0 ? Number(nl) : null,
      campaignId: Number.isFinite(campaignId as number) && Number(campaignId) > 0 ? Number(campaignId) : null,
      notificationType: typeof req.body?.notification_type === 'string' ? req.body.notification_type : null,
      scenarioKey: typeof req.body?.scenario === 'string' ? req.body.scenario : null,
      section: typeof req.body?.section === 'string' ? req.body.section : null,
      source: typeof req.body?.source === 'string' ? req.body.source : null,
      eventType: normalizedEvent,
      payload: req.body || {},
    });
    await recordNotificationAttribution({
      userId: telegramUser.id,
      notificationLogId: Number.isFinite(nl as number) && Number(nl) > 0 ? Number(nl) : null,
      scenarioKey: typeof req.body?.scenario === 'string' ? req.body.scenario : null,
      section: typeof req.body?.section === 'string' ? req.body.section : null,
      source: typeof req.body?.source === 'string' ? req.body.source : null,
      eventType,
      payload: req.body || {},
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    return res.status(500).json({
      error: 'ATTRIBUTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
