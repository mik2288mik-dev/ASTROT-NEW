import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../lib/db';
import { getSwissEphemerisHealth } from '../../lib/swisseph-calculator';

/** Dependency readiness for deploy orchestration; /api/health remains liveness. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const swiss = getSwissEphemerisHealth();
  if (!swiss.ok) return res.status(503).json({ ready: false, checks: { database: false, swissEphemeris: false } });
  try {
    await getPool().query('SELECT 1');
    return res.status(200).json({ ready: true, checks: { database: true, swissEphemeris: true } });
  } catch {
    return res.status(503).json({ ready: false, checks: { database: false, swissEphemeris: true } });
  }
}
