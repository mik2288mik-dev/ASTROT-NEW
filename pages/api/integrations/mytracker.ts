import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getMyTrackerConfig,
  isMyTrackerPostbackAuthorized,
  MyTrackerPayloadError,
  recordMyTrackerAttribution,
} from '../../../lib/myTracker';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const integration = getMyTrackerConfig();
  if (!integration) return res.status(503).json({ error: 'MYTRACKER_DISABLED' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const values: Record<string, unknown> = { ...req.query, ...body };
  const secret = req.headers['x-mytracker-secret'] ?? values.token;
  if (!isMyTrackerPostbackAuthorized(secret, integration)) {
    return res.status(401).json({ error: 'MYTRACKER_UNAUTHORIZED' });
  }
  try {
    const result = await recordMyTrackerAttribution(values);
    if (result === 'unknown_user') return res.status(404).json({ error: 'MYTRACKER_USER_UNKNOWN' });
    if (result === 'disabled') return res.status(503).json({ error: 'MYTRACKER_DISABLED' });
    return res.status(200).json({ ok: true, status: result });
  } catch (error) {
    if (error instanceof MyTrackerPayloadError) return res.status(400).json({ error: error.code });
    // The callback body and shared secret must never reach application logs or errors.
    return res.status(503).json({ error: 'MYTRACKER_TEMPORARILY_UNAVAILABLE' });
  }
}
