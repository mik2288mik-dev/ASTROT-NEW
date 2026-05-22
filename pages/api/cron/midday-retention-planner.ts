import type { NextApiRequest, NextApiResponse } from 'next';
import { planRetentionNotifications } from '../../../services/notificationRetentionService';

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
    const dryRun = req.query.dryRun === '1' || req.body?.dryRun === true;
    const result = await planRetentionNotifications('midday-retention-planner', new Date(), { limit, dryRun });
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'error' });
  }
}
