import type { NextApiRequest, NextApiResponse } from 'next';
import { runNotificationEngineCron } from '../../../services/notificationService';

/**
 * Trigger daily notification sends. Protect with CRON_SECRET.
 * Example: curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/notifications-daily
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const results = await runNotificationEngineCron('cron');
    return res.status(200).json({ ok: true, results });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
}
