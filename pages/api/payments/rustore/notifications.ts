import type { NextApiRequest, NextApiResponse } from 'next';
import { RuStorePaymentError, processRuStoreCallback } from '../../../../lib/rustorePayments';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const result = await processRuStoreCallback(req.body || {});
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    // A non-2xx response intentionally asks RuStore to retry a transient or invalid callback.
    const known = error instanceof RuStorePaymentError;
    return res.status(known ? 400 : 503).json({ error: known ? error.code : 'RUSTORE_CALLBACK_FAILED' });
  }
}
