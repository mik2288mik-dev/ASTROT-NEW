import type { NextApiRequest, NextApiResponse } from 'next';
import { acceptInvite, normalizeInviteCode, normalizeLinkContext, PeopleError } from '../../../../../lib/people/service';
import { requireLinkableUser, sendPeopleError } from '../../../../../lib/people/http';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../../lib/rateLimit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireLinkableUser(req);
    const code = normalizeInviteCode(req.query.code);
    if (!code) throw new PeopleError(404, 'INVITE_NOT_FOUND');
    const requested = req.body?.relationshipContext;
    const context = requested == null ? null : normalizeLinkContext(requested);
    if (requested != null && !context) throw new PeopleError(400, 'CONTEXT_INVALID');
    return res.status(200).json(await acceptInvite(auth.userId, code, context));
  } catch (error) {
    return sendPeopleError(res, error);
  }
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.FREE);
