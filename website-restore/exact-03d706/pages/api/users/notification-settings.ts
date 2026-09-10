import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPool } from '../../../lib/db';

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function readTimezone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const auth = await requireAppUser(req, { allowGuest: false });
    const pool = getPool();

    if (req.method === 'GET') {
      const existing = await pool.query(
        `SELECT enabled, morning_enabled, day_enabled, evening_enabled, reactivation_enabled,
                to_char(quiet_hours_start, 'HH24:MI') AS quiet_hours_start,
                to_char(quiet_hours_end, 'HH24:MI') AS quiet_hours_end, timezone
         FROM user_notification_settings WHERE user_id = $1`,
        [auth.userId]
      );
      return res.status(200).json({ success: true, settings: existing.rows[0] || null });
    }

    const enabled = readBoolean(req.body?.enabled);
    const morningEnabled = readBoolean(req.body?.morningEnabled);
    const dayEnabled = readBoolean(req.body?.dayEnabled);
    const eveningEnabled = readBoolean(req.body?.eveningEnabled);
    const reactivationEnabled = readBoolean(req.body?.reactivationEnabled);
    const quietHoursStart = readTime(req.body?.quietHoursStart);
    const quietHoursEnd = readTime(req.body?.quietHoursEnd);
    const timezone = readTimezone(req.body?.timezone);

    const result = await pool.query(
      `INSERT INTO user_notification_settings (
         user_id, enabled, morning_enabled, day_enabled, evening_enabled, reactivation_enabled,
         quiet_hours_start, quiet_hours_end, timezone
       )
       VALUES (
         $1,
         COALESCE($2::boolean, TRUE),
         COALESCE($3::boolean, TRUE),
         COALESCE($4::boolean, TRUE),
         COALESCE($5::boolean, TRUE),
         COALESCE($6::boolean, TRUE),
         $7::time, $8::time, $9
       )
       ON CONFLICT (user_id) DO UPDATE SET
         enabled = COALESCE($2::boolean, user_notification_settings.enabled),
         morning_enabled = COALESCE($3::boolean, user_notification_settings.morning_enabled),
         day_enabled = COALESCE($4::boolean, user_notification_settings.day_enabled),
         evening_enabled = COALESCE($5::boolean, user_notification_settings.evening_enabled),
         reactivation_enabled = COALESCE($6::boolean, user_notification_settings.reactivation_enabled),
         quiet_hours_start = COALESCE($7::time, user_notification_settings.quiet_hours_start),
         quiet_hours_end = COALESCE($8::time, user_notification_settings.quiet_hours_end),
         timezone = COALESCE($9::text, user_notification_settings.timezone),
         updated_at = CURRENT_TIMESTAMP
       RETURNING enabled, morning_enabled, day_enabled, evening_enabled, reactivation_enabled,
                 to_char(quiet_hours_start, 'HH24:MI') AS quiet_hours_start,
                 to_char(quiet_hours_end, 'HH24:MI') AS quiet_hours_end, timezone`,
      [
        auth.userId,
        enabled,
        morningEnabled,
        dayEnabled,
        eveningEnabled,
        reactivationEnabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
      ]
    );

    return res.status(200).json({ success: true, settings: result.rows[0] || null });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      error: error?.code || 'NOTIFICATION_SETTINGS_FAILED',
      message: error?.message || 'Failed to update notification settings',
    });
  }
}
