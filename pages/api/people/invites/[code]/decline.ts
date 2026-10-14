import type { NextApiRequest, NextApiResponse } from 'next';
import { declineInvite, normalizeInviteCode, PeopleError } from '../../../../../lib/people/service';
import { requireLinkableUser, sendPeopleError } from '../../../../../lib/people/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireLinkableUser(req);
    const code = normalizeInviteCode(req.query.code);
    if (!code) throw new PeopleError(404, 'INVITE_NOT_FOUND');
    await declineInvite(auth.userId, code);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}
