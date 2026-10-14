import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { normalizeInviteCode, PeopleError, previewInvite, revokeInvite } from '../../../../lib/people/service';
import { requireLinkableUser, sendPeopleError } from '../../../../lib/people/http';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

/** GET works without an account (the invite page); DELETE lets the inviter take the link back. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const code = normalizeInviteCode(req.query.code);
    if (!code) throw new PeopleError(404, 'INVITE_NOT_FOUND');
    if (req.method === 'GET') {
      let viewerId: string | null = null;
      try {
        viewerId = (await requireAppUser(req, { allowGuest: true })).userId;
      } catch {
        viewerId = null;
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ invite: await previewInvite(code, viewerId) });
    }
    if (req.method === 'DELETE') {
      const auth = await requireLinkableUser(req);
      await revokeInvite(auth.userId, code);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.FREE);
