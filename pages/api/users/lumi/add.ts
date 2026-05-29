import type { NextApiRequest, NextApiResponse } from 'next';
import { respondLumiDeprecated } from '../../../../lib/lumiDeprecatedResponse';

/** @deprecated Public Lumi accrual API — admin-only legacy remains under /api/admin. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return respondLumiDeprecated(res, req);
}
