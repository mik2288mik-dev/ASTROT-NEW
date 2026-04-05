import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { NOTIFICATION_SLOTS } from '../../../../lib/notificationSlotCatalog';
import { sendNotificationSlot } from '../../../../services/notificationService';

const SLOTS = new Set(NOTIFICATION_SLOTS);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);
    const slot = typeof req.body?.slot === 'string' ? req.body.slot.trim() : '';
    if (!SLOTS.has(slot)) {
      return res.status(400).json({ error: 'INVALID_SLOT', message: 'Invalid slot' });
    }
    const rotationGroup =
      req.body?.rotationGroup != null && String(req.body.rotationGroup).trim()
        ? String(req.body.rotationGroup).trim()
        : null;

    const { template, result } = await sendNotificationSlot(slot, rotationGroup, access.requesterId);

    return res.status(200).json({
      success: true,
      templateId: template ? Number(template.id) : null,
      successCount: result?.successCount ?? 0,
      failureCount: result?.failureCount ?? 0,
      totalRecipients: result?.totalRecipients ?? 0,
      errorSummary: result?.errorSummary ?? null,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
