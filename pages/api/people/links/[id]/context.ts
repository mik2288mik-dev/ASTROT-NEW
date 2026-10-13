import type { NextApiRequest, NextApiResponse } from 'next';
import { getLinkedPerson, normalizeLinkContext, PeopleError, proposeContext, respondToContextProposal } from '../../../../../lib/people/service';
import { readLinkId, requireLinkableUser, sendPeopleError } from '../../../../../lib/people/http';

/** { propose: 'family' } suggests another type; { accept: true | false } answers the suggestion of the other person. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireLinkableUser(req);
    const id = readLinkId(req.query.id);
    const body = req.body || {};
    if (typeof body.accept === 'boolean') {
      await respondToContextProposal(auth.userId, id, body.accept);
    } else {
      const context = normalizeLinkContext(body.propose);
      if (!context) throw new PeopleError(400, 'CONTEXT_INVALID');
      await proposeContext(auth.userId, id, context);
    }
    return res.status(200).json({ person: await getLinkedPerson(auth.userId, id) });
  } catch (error) {
    return sendPeopleError(res, error);
  }
}
