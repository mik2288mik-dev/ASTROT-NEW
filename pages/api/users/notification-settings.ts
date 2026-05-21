import type { NextApiRequest, NextApiResponse } from 'next';
import { getVerifiedTelegramUser } from '../../../lib/adminAuth';
import { getPool } from '../../../lib/db';

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const telegramUser = getVerifiedTelegramUser(req);
    const enabled = readBoolean(req.body?.enabled);
    const morningEnabled = readBoolean(req.body?.morningEnabled);
    const dayEnabled = readBoolean(req.body?.dayEnabled);
    const eveningEnabled = readBoolean(req.body?.eveningEnabled);
    const reactivationEnabled = readBoolean(req.body?.reactivationEnabled);
    const timezone = readTimezone(req.body?.timezone);

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO user_notification_settings (
         user_id, enabled, morning_enabled, day_enabled, evening_enabled, reactivation_enabled, timezone
       )
       VALUES (
         $1,
         COALESCE($2::boolean, TRUE),
         COALESCE($3::boolean, TRUE),
         COALESCE($4::boolean, TRUE),
         COALESCE($5::boolean, TRUE),
         COALESCE($6::boolean, TRUE),
         $7
       )
       ON CONFLICT (user_id) DO UPDATE SET
         enabled = COALESCE($2::boolean, user_notification_settings.enabled),
         morning_enabled = COALESCE($3::boolean, user_notification_settings.morning_enabled),
         day_enabled = COALESCE($4::boolean, user_notification_settings.day_enabled),
         evening_enabled = COALESCE($5::boolean, user_notification_settings.evening_enabled),
         reactivation_enabled = COALESCE($6::boolean, user_notification_settings.reactivation_enabled),
         timezone = COALESCE($7::text, user_notification_settings.timezone),
         updated_at = CURRENT_TIMESTAMP
       RETURNING enabled, morning_enabled, day_enabled, evening_enabled, reactivation_enabled, timezone`,
      [
        telegramUser.id,
        enabled,
        morningEnabled,
        dayEnabled,
        eveningEnabled,
        reactivationEnabled,
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
