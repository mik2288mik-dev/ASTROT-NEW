import type { NextApiRequest, NextApiResponse } from 'next';
import { getVerifiedTelegramUser } from '../../../lib/adminAuth';
import { db } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    const telegramUser = getVerifiedTelegramUser(req);
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const telegramPlatform = typeof req.body?.telegramPlatform === 'string' ? req.body.telegramPlatform.trim() : '';
    const userAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0] || ''
      : (req.headers['user-agent'] || '');

    if (!sessionId) {
      return res.status(400).json({
        error: 'SESSION_ID_REQUIRED',
        message: 'sessionId is required',
      });
    }

    const session = await db.user_sessions.upsert(telegramUser.id, sessionId, {
      telegramPlatform,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      session: {
        sessionId: session?.session_id,
        deviceLabel: session?.device_label ?? null,
        lastSeenAt: session?.last_seen_at ?? null,
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      error: error?.code || 'INTERNAL_SERVER_ERROR',
      message: error?.message || 'Failed to record user session',
    });
  }
}
