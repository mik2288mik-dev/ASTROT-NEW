import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError, AdminAuthError } from '../../../../lib/adminAuth';
import { sendTelegramTextMessage } from '../../../../lib/telegramBot';

/**
 * Простой self-test доставки для админа: шлёт обычное сообщение себе в Telegram.
 * Проверяет связку BOT_TOKEN + доставка end-to-end без шаблонов/сценариев.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }
  try {
    const access = await requireAdminAccess(req);
    const text =
      'Lumia — тест уведомлений.\n\nЕсли ты видишь это сообщение, доставка работает: BOT_TOKEN и Telegram настроены верно.';
    const result = await sendTelegramTextMessage(String(access.requesterId), text);
    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error || 'Telegram send failed' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'error' });
  }
}
