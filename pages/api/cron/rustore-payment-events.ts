import type { NextApiRequest, NextApiResponse } from 'next';
import { processPendingRuStoreEvents } from '../../../lib/rustorePayments';

function authorized(req: NextApiRequest): boolean {
  const configured = String(process.env.CRON_SECRET || '');
  const header = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0] || ''
    : req.headers.authorization || '';
  return !!configured && header === `Bearer ${configured}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const result = await processPendingRuStoreEvents(Number(req.body?.limit) || 20);
    return res.status(200).json({ ok: true, ...result });
  } catch {
    return res.status(503).json({ error: 'RUSTORE_EVENT_WORKER_FAILED' });
  }
}
