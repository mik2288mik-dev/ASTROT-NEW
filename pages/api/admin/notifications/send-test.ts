import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { sendTestNotification } from '../../../../services/notificationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);
    const templateId = Number(req.body?.templateId);
    if (!Number.isFinite(templateId) || templateId < 1) {
      return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED', message: 'templateId is required' });
    }

    const result = await sendTestNotification(templateId, access.requesterId, access.requesterId);
    return res.status(200).json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalRecipients: result.totalRecipients,
      errorSummary: result.errorSummary,
    });
  } catch (error: any) {
    if (error?.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
    }
    if (error?.message === 'USER_NOT_FOUND') {
      return res.status(400).json({ error: 'USER_NOT_FOUND', message: 'Admin user not found in DB' });
    }
    return handleAdminError(res, error);
  }
}
