import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { userHasRecoveryIdentity } from '../../../lib/auth/accountIdentity';
import { listPeople } from '../../../lib/people/service';
import { inviteOrigin, sendPeopleError } from '../../../lib/people/http';

/** My linked people and my open invites. A guest gets an empty list and a hint to sign in. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const canLink = !auth.isGuest && await userHasRecoveryIdentity(auth.userId);
    res.setHeader('Cache-Control', 'no-store');
    if (!canLink) return res.status(200).json({ canLink: false, people: [], invites: [], inviteOrigin: inviteOrigin(req) });
    const { people, invites } = await listPeople(auth.userId);
    return res.status(200).json({ canLink: true, people, invites, inviteOrigin: inviteOrigin(req) });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}
