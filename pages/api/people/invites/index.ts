import type { NextApiRequest, NextApiResponse } from 'next';
import { createInvite, normalizeLinkContext, PeopleError } from '../../../../lib/people/service';
import { inviteOrigin, requireLinkableUser, sendPeopleError } from '../../../../lib/people/http';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireLinkableUser(req);
    const context = normalizeLinkContext(req.body?.relationshipContext);
    if (!context) throw new PeopleError(400, 'CONTEXT_REQUIRED');
    const invite = await createInvite(auth.userId, context);
    return res.status(201).json({ invite, url: `${inviteOrigin(req)}/i/${invite.code}` });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.FREE);
