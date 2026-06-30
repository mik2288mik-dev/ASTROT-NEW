import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPool } from '../../../lib/db';

const MAX_EVENT_TYPE_LENGTH = 80;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    // Считаем ВСЕХ app-юзеров: Telegram И веб-гостей (раньше было только Telegram —
    // гости вообще не попадали в аналитику/DAU). allowGuest = да.
    const appUser = await requireAppUser(req, { allowGuest: true });
    const eventType = normalizeText(req.body?.eventType, MAX_EVENT_TYPE_LENGTH);
    if (!eventType) {
      return res.status(400).json({
        error: 'EVENT_TYPE_REQUIRED',
        message: 'eventType is required',
      });
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO user_app_events (user_id, event_type, section, source, payload_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        appUser.userId,
        eventType,
        normalizeText(req.body?.section, 80),
        normalizeText(req.body?.source, 80),
        JSON.stringify(req.body?.eventPayload && typeof req.body.eventPayload === 'object' ? req.body.eventPayload : {}),
      ]
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      error: error?.code || 'USER_EVENT_FAILED',
      message: error?.message || 'Failed to record user event',
    });
  }
}
