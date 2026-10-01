import type { NextApiRequest, NextApiResponse } from 'next';
import { getAndroidUpdatePolicy } from '../../../lib/androidUpdatePolicy';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  return res.status(200).json(getAndroidUpdatePolicy());
}
