import type { NextApiRequest, NextApiResponse } from 'next';
import { getPairReading } from '../../../../../lib/people/pairReading';
import { readLanguage, readLinkId, requireLinkableUser, sendPeopleError } from '../../../../../lib/people/http';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../../lib/rateLimit';

/**
 * The shared reading of a linked pair. { generate: false } only reads what is stored;
 * { generate: true } writes the text once when either person has Premium.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireLinkableUser(req);
    const result = await getPairReading({
      viewerId: auth.userId,
      linkId: readLinkId(req.query.id),
      language: readLanguage(req.body?.language),
      generate: req.body?.generate === true,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    return sendPeopleError(res, error);
  }
}

export default withRateLimit(handler, () => RATE_LIMIT_CONFIGS.AI_FREE);
