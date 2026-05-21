import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';
import { validateNotificationHumanText } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.query.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid template id' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      const template = await notificationEngineAdminDb.getTemplate(id);
      if (!template) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      return res.status(200).json({ template });
    }

    if (req.method === 'PATCH') {
      const onlyActive = typeof req.body?.isActive === 'boolean';
      if (!onlyActive) {
        return res.status(400).json({ error: 'INVALID_PATCH', message: 'Only isActive toggle supported' });
      }
      const existing = await notificationEngineAdminDb.getTemplate(id);
      if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      const template = await notificationEngineAdminDb.saveTemplate({ ...existing, id, isActive: req.body.isActive });
      return res.status(200).json({ template });
    }

    if (req.method === 'PUT') {
      const humanText = validateNotificationHumanText([req.body?.title, req.body?.body, req.body?.text, req.body?.buttonText].join('\n'));
      if (!humanText.ok) return res.status(400).json({ error: humanText.error, message: humanText.message });
      const existingBefore = await notificationEngineAdminDb.getTemplate(id);
      if (!existingBefore) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });
      }
      const template = await notificationEngineAdminDb.saveTemplate({ ...req.body, id });
      return res.status(200).json({ template });
    }

    if (req.method === 'DELETE') {
      const ok = await notificationEngineAdminDb.deleteTemplate(id);
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
