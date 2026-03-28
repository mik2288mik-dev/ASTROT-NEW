import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeNotificationTemplate } from '../../../../lib/adminSerializers';

function isValidKind(value: unknown): value is 'personal' | 'broadcast' | 'both' {
  return value === 'personal' || value === 'broadcast' || value === 'both';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const { id } = req.query;
  const templateId = Array.isArray(id) ? id[0] : id;
  const parsedTemplateId = Number(templateId);
  if (!Number.isInteger(parsedTemplateId) || parsedTemplateId <= 0) {
    return res.status(400).json({ error: 'TEMPLATE_ID_REQUIRED', message: 'Valid template id is required' });
  }

  try {
    await requireAdminAccess(req);

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const bodyRu = typeof req.body?.bodyRu === 'string' ? req.body.bodyRu.trim() : '';
    const bodyEn = typeof req.body?.bodyEn === 'string' ? req.body.bodyEn.trim() : '';
    const kind = req.body?.kind;
    const isActive = req.body?.isActive !== false;

    if (!title) {
      return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Template title is required' });
    }
    if (!bodyRu && !bodyEn) {
      return res.status(400).json({ error: 'BODY_REQUIRED', message: 'At least one localized body is required' });
    }
    if (!isValidKind(kind)) {
      return res.status(400).json({ error: 'INVALID_KIND', message: 'Template kind is invalid' });
    }

    const template = await db.legacy_notification_templates.update(parsedTemplateId, {
      title,
      bodyRu,
      bodyEn,
      kind,
      isActive,
    });

    if (!template) {
      return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND', message: 'Template not found' });
    }

    return res.status(200).json({
      template: serializeNotificationTemplate(template),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
