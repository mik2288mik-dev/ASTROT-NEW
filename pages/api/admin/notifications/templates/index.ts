import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { notificationEngineAdminDb } from '../../../../../lib/adminNotificationEngineDb';
import { validateNotificationHumanText } from '../../../../../lib/notificationAdminValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'GET') {
      const scenarioId = req.query.scenarioId != null ? Number(req.query.scenarioId) : null;
      const templates = await notificationEngineAdminDb.listTemplates(Number.isFinite(scenarioId as number) ? scenarioId : null);
      return res.status(200).json({ templates });
    }

    const humanText = validateNotificationHumanText([req.body?.title, req.body?.body, req.body?.text, req.body?.buttonText].join('\n'));
    if (!humanText.ok) {
      return res.status(400).json({ error: humanText.error, message: humanText.message });
    }

    const template = await notificationEngineAdminDb.saveTemplate(req.body || {});
    return res.status(201).json({ template });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
