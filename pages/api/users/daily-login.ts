import type { NextApiRequest, NextApiResponse } from 'next';
import { respondLumiDeprecated } from '../../../lib/lumiDeprecatedResponse';

/** @deprecated Daily login Lumi rewards — product currency removed. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return respondLumiDeprecated(res, req);
}
