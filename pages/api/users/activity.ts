import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { readClientRuntimeMetadata } from '../../../lib/clientRuntimeMetadata';
import { sanitizeActivityPulse } from '../../../lib/productActivity';
import { recordActivityPulse } from '../../../lib/productActivityRepository';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const user = await requireAppUser(req, { allowGuest: true });
    const pulse = sanitizeActivityPulse(req.body);
    if (!pulse) return res.status(400).json({ error: 'INVALID_ACTIVITY' });
    const runtime = readClientRuntimeMetadata(req.headers, user.provider === 'native' ? 'native'
      : user.provider === 'telegram' ? 'telegram' : 'web');
    return res.status(200).json(await recordActivityPulse(user.userId, pulse, runtime));
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: status >= 500 ? 'ACTIVITY_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
