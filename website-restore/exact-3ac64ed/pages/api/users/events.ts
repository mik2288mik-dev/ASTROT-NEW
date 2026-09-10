import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPool } from '../../../lib/db';
import {
  isUserAppEventBodyTooLarge,
  sanitizeUserAppEvent,
} from '../../../lib/premiumAnalytics';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }
  if (isUserAppEventBodyTooLarge(req.body)) {
    return res.status(413).json({ error: 'EVENT_TOO_LARGE', message: 'Event payload is too large' });
  }

  try {
    const appUser = await requireAppUser(req, { allowGuest: true });
    if (!req.body?.eventType) {
      return res.status(400).json({
        error: 'EVENT_TYPE_REQUIRED',
        message: 'eventType is required',
      });
    }

    const event = sanitizeUserAppEvent(req.body);
    if (!event) {
      return res.status(400).json({
        error: 'EVENT_NOT_ALLOWED',
        message: 'Event is not allowed',
      });
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO user_app_events (user_id, event_id, event_type, section, source, payload_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING`,
      [
        appUser.userId,
        event.eventId || null,
        event.eventType,
        event.section,
        event.source,
        JSON.stringify(event.eventPayload),
      ]
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      error: error?.code || 'USER_EVENT_FAILED',
      message: status >= 500 ? 'Failed to record user event' : (error?.message || 'Request failed'),
    });
  }
}
