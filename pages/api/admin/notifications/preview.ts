import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { parseTemplatePayload } from '../../../../lib/notificationAdminValidation';
import { resolveCaption, resolveReplyMarkup, resolveDefaultMiniAppUrl } from '../../../../services/notificationService';
import { previewNotificationScenario } from '../../../../services/notificationEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const access = await requireAdminAccess(req);
    const scenarioId = Number(req.body?.scenarioId);
    const templateId = Number(req.body?.templateId);
    if (Number.isFinite(scenarioId) && scenarioId > 0) {
      const at = req.body?.date && req.body?.time
        ? new Date(`${String(req.body.date)}T${String(req.body.time).slice(0, 5)}:00.000Z`)
        : undefined;
      const preview = await previewNotificationScenario({
        scenarioId,
        templateId: Number.isFinite(templateId) && templateId > 0 ? templateId : null,
        userId: String(req.body?.userId || access.requesterId),
        now: at,
      });
      return res.status(200).json({ preview });
    }

    const parsed = parseTemplatePayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, message: parsed.message });
    }

    const assetUrl =
      typeof req.body?.previewImageUrl === 'string' && req.body.previewImageUrl.trim()
        ? req.body.previewImageUrl.trim()
        : null;

    const row = {
      ...parsed.data,
      message_type: parsed.data.messageType,
      deep_link: parsed.data.deepLink,
      button_text: parsed.data.buttonText,
      visual_mode: parsed.data.visualMode,
      asset_public_url: assetUrl,
    };

    const caption = resolveCaption(row);
    const replyMarkup = resolveReplyMarkup(row);
    const defaultUrl = resolveDefaultMiniAppUrl();

    const vm = parsed.data.visualMode;
    let imageUrl: string | null = null;
    if (vm === 'uploaded') {
      imageUrl = assetUrl;
    }

    return res.status(200).json({
      preview: {
        visualMode: vm,
        messageType: parsed.data.messageType,
        text: caption,
        imageUrl,
        buttonText: parsed.data.buttonText || null,
        buttonUrl: parsed.data.deepLink?.trim() || defaultUrl || null,
        hasInlineButton: !!(replyMarkup?.inline_keyboard?.length),
        generatedCardPreviewPath: vm === 'generated' ? '/api/admin/notifications/card-preview' : null,
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
