import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureNotificationScheduler,
  getSchedulerStatus,
  isSchedulerAllowedByEnv,
} from '../../lib/notificationScheduler';

/**
 * Railway/container liveness.
 *
 * This route deliberately performs no database, ephemeris, provider, email, or
 * payment calls. A temporary dependency outage must not make the platform
 * restart a healthy HTTP process. Dependency checks live at /api/readiness.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    ensureNotificationScheduler('health');
  } catch {
    // Scheduler bootstrap is best-effort and must not change HTTP liveness.
  }

  const scheduler = getSchedulerStatus();
  return res.status(200).json({
    status: 'ok',
    liveness: { ok: true },
    timestamp: new Date().toISOString(),
    scheduler: {
      started: scheduler.started,
      allowedByEnv: isSchedulerAllowedByEnv(),
      disabled: process.env.DISABLE_INPROCESS_CRON === '1',
    },
  });
}
