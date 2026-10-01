import type { NextApiRequest, NextApiResponse } from 'next';
import { isAppPushToken, readAppPushInbox } from '../../../../lib/appPush';

/**
 * Телефон в фоне забирает новые рассылки. Авторизация — секретный токен устройства,
 * выданный при регистрации из приложения (сессии в фоне нет).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const token = req.query.token;
  const after = Number(req.query.after ?? 0);
  if (!isAppPushToken(token) || !Number.isSafeInteger(after) || after < 0) return res.status(400).json({ error: 'BAD_REQUEST' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const messages = await readAppPushInbox(token, after);
    if (!messages) return res.status(404).json({ error: 'UNKNOWN_DEVICE' });
    return res.status(200).json({ messages });
  } catch {
    return res.status(500).json({ error: 'PUSH_INBOX_FAILED' });
  }
}
