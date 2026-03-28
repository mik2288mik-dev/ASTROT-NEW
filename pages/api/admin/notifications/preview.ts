import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { parseTemplatePayload } from '../../../../lib/notificationAdminValidation';
import { resolveCaption, resolveReplyMarkup, resolveDefaultMiniAppUrl } from '../../../../services/notificationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);
    const parsed = parseTemplatePayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, message: parsed.message });
    }

    const row = {
      ...parsed.data,
      message_type: parsed.data.messageType,
      deep_link: parsed.data.deepLink,
      button_text: parsed.data.buttonText,
      asset_public_url: typeof req.body?.previewImageUrl === 'string' ? req.body.previewImageUrl : null,
    };

    const caption = resolveCaption(row);
    const replyMarkup = resolveReplyMarkup(row);
    const defaultUrl = resolveDefaultMiniAppUrl();

    return res.status(200).json({
      preview: {
        messageType: parsed.data.messageType,
        text: caption,
        imageUrl: parsed.data.messageType === 'photo' ? row.asset_public_url : null,
        buttonText: parsed.data.buttonText || null,
        buttonUrl: parsed.data.deepLink?.trim() || defaultUrl || null,
        hasInlineButton: !!(replyMarkup?.inline_keyboard?.length),
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
