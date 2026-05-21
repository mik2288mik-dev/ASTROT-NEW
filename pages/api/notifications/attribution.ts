import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser, handleAdminError } from '../../../lib/adminAuth';
import { recordNotificationAttribution } from '../../../services/notificationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const telegramUser = getVerifiedTelegramUser(req);
    const eventType = req.body?.eventType === 'click' ? 'click' : 'open';
    const nl = req.body?.nl != null ? Number(req.body.nl) : null;
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
