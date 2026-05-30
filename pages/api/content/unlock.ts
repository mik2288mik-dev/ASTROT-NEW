import type { NextApiRequest, NextApiResponse } from 'next';

/** @deprecated Per-content unlock endpoint removed. Use Premium subscription. */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'Content unlock endpoint removed',
    code: 'CONTENT_UNLOCK_REMOVED',
    message: 'Content unlock purchases are no longer supported. Use Lumia Premium.',
    premiumRequired: true,
  });
}
