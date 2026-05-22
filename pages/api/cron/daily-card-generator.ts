import type { NextApiRequest, NextApiResponse } from 'next';
import { generateDailyCards } from '../../../services/notificationRetentionService';

function verifyCron(req: NextApiRequest) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return !!secret && token === secret;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!verifyCron(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const limit = Number(req.query.limit || req.body?.limit || 250);
    const userId = typeof req.query.userId === 'string' ? req.query.userId : req.body?.userId || null;
    const result = await generateDailyCards(new Date(), { limit: Number.isFinite(limit) ? limit : 250, userId });
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'error' });
  }
}
