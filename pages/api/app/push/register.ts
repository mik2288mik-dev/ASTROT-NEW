import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { isAppPushToken, registerAppPushDevice } from '../../../../lib/appPush';
import { getUpcomingSkyEvents } from '../../../../lib/skyEvents';

/** Привязывает токен Android-устройства к аккаунту для рассылок из админки. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  let userId: string;
  try {
    userId = (await requireAppUser(req)).userId;
  } catch {
    return res.status(401).json({ error: 'APP_AUTH_REQUIRED' });
  }
  const token = req.body?.token;
  if (!isAppPushToken(token)) return res.status(400).json({ error: 'BAD_TOKEN' });
  try {
    const result = await registerAppPushDevice({ userId, token, language: req.body?.language, sign: req.body?.sign });
    // Полнолуния/новолуния/Меркурий на ближайшие две недели — телефон вставит их в своё расписание.
    const events = await getUpcomingSkyEvents().catch(() => []);
    return res.status(200).json({ ...result, events });
  } catch {
    return res.status(500).json({ error: 'PUSH_REGISTER_FAILED' });
  }
}
