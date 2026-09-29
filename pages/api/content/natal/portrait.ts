import type { NextApiRequest, NextApiResponse } from 'next';
import { handleLegacyLongScrollEndpoint } from '../../../../lib/natalReading/legacyLongScrollApi';

export const config = { maxDuration: 90 };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleLegacyLongScrollEndpoint(req, res, 'portrait');
}
