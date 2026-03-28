import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { parseTemplatePayload } from '../../../../lib/notificationAdminValidation';
import { resolveNotificationVisual } from '../../../../services/notificationVisualResolver';

/**
 * POST: returns PNG (exact server render). Body: same fields as template + optional previewSunSign, scheduleTimezone.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const access = await requireAdminAccess(req);

    const parsed = parseTemplatePayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, message: parsed.message });
    }
    if (parsed.data.visualMode !== 'generated') {
      return res.status(400).json({ error: 'NOT_GENERATED', message: 'visualMode must be generated' });
    }

    const previewSunSign =
      typeof req.body?.previewSunSign === 'string' ? req.body.previewSunSign.trim() : '';

    const row: Record<string, any> = {
      id: Number(req.body?.templateId) || 0,
      ...parsed.data,
      message_type: parsed.data.messageType,
      deep_link: parsed.data.deepLink,
      button_text: parsed.data.buttonText,
      generated_preset: parsed.data.generatedPreset,
      generated_title: parsed.data.generatedTitle,
      generated_subtitle: parsed.data.generatedSubtitle,
      generated_accent: parsed.data.generatedAccent,
      generated_show_date: parsed.data.generatedShowDate,
      generated_show_slot_label: parsed.data.generatedShowSlotLabel,
      generated_zodiac_mode: parsed.data.generatedZodiacMode,
      generated_custom_zodiac: parsed.data.generatedCustomZodiac,
      visual_mode: parsed.data.visualMode,
    };

    const visual = await resolveNotificationVisual({
      template: row,
      recipientUserId: access.requesterId,
      recipientLanguage: 'ru',
      scheduleTimezone: typeof req.body?.scheduleTimezone === 'string' ? req.body.scheduleTimezone : 'Europe/Moscow',
      previewSunSign: previewSunSign || null,
    });

    if (visual.kind !== 'generated') {
      return res.status(500).json({ error: 'RENDER_FAILED' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).send(visual.pngBuffer);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
