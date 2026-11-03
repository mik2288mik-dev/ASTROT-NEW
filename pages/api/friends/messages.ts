import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { db } from '../../../lib/db';
import { FriendsError, readMessages, sendMessage, setFriendPrefs } from '../../../lib/friends';

/**
 * GET ?friendId=&after= — the chat with a friend (marks their messages read).
 * POST { friendId, body, kind?, payload? } — send a message.
 * PATCH { friendId, notifyMessages } — mute or unmute pushes about this friend's messages.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method || '')) return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (req.method === 'GET') {
      const friendId = String(req.query.friendId || '');
      const after = Number(req.query.after || 0);
      return res.status(200).json({ messages: await readMessages(userId, friendId, Number.isSafeInteger(after) ? after : 0) });
    }
    const friendId = String(req.body?.friendId || '');
    if (req.method === 'PATCH') {
      await setFriendPrefs(userId, friendId, req.body?.notifyMessages !== false);
      return res.status(200).json({ ok: true });
    }
    const me = await db.users.get(userId, { hydratePrimaryChart: false }).catch(() => null) as { name?: string } | null;
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload as Record<string, unknown> : null;
    const message = await sendMessage({
      userId,
      senderName: String(me?.name || '').trim().split(/\s+/)[0] || 'Друг',
      friendId,
      body: typeof req.body?.body === 'string' ? req.body.body : '',
      kind: req.body?.kind === 'card' ? 'card' : 'text',
      payload: payload ? { title: String(payload.title || '').slice(0, 120), kicker: String(payload.kicker || '').slice(0, 60) } : null,
    });
    return res.status(200).json({ message });
  } catch (error: any) {
    if (error instanceof FriendsError) return res.status(error.code === 'TOO_MANY_MESSAGES' ? 429 : 409).json({ error: error.code });
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ error: status >= 500 ? 'FRIENDS_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
