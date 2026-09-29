import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Container liveness only.
 *
 * Keep this endpoint deliberately dependency-free: no database, scheduler,
 * ephemeris, provider, email, payment, or other application bootstrap work.
 * A platform healthcheck must answer as soon as the Next.js HTTP process can
 * serve requests. Dependency checks live at /api/readiness.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  return res.status(200).json({
    status: 'ok',
    liveness: { ok: true },
    timestamp: new Date().toISOString(),
  });
}
