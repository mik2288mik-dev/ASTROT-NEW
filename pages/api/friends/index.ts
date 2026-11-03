import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { addFriendByCode, FriendsError, getOrCreateFriendCode, listFriends, removeFriend } from '../../../lib/friends';

/**
 * GET — my friend code and my friends.
 * POST { code } — add a friend by their code.
 * DELETE { friendId } — remove a friend.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (req.method === 'POST') await addFriendByCode(userId, typeof req.body?.code === 'string' ? req.body.code : '');
    if (req.method === 'DELETE') await removeFriend(userId, String(req.body?.friendId || ''));
    const [code, friends] = await Promise.all([getOrCreateFriendCode(userId), listFriends(userId)]);
    return res.status(200).json({ code, friends });
  } catch (error: any) {
    if (error instanceof FriendsError) return res.status(409).json({ error: error.code });
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ error: status >= 500 ? 'FRIENDS_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
