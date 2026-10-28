import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { userHasRecoveryIdentity } from '../../../../lib/auth/accountIdentity';
import { resolveRuStoreSandboxMode, RuStorePaymentError } from '../../../../lib/rustorePayments';
import { validateOneTimePurchase } from '../../../../lib/oneTimePurchases';

const TERMINAL = new Map<string, number>([
  ['RUSTORE_PRODUCT_NOT_ALLOWED', 422],
  ['RUSTORE_INVOICE_ID_REQUIRED', 422],
  ['RUSTORE_INVOICE_NOT_PAID', 409],
  ['RUSTORE_PURCHASE_PRODUCT_MISMATCH', 422],
  ['RUSTORE_PURCHASE_USER_MISMATCH', 409],
  ['RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER', 409],
]);

/** POST { productId, invoiceId } — checks a one-time RuStore purchase with RuStore and gives what it buys. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req);
    const userId = String(auth.userId);
    if (!(await userHasRecoveryIdentity(userId))) {
      return res.status(403).json({ error: 'RECOVERY_IDENTITY_REQUIRED' });
    }
    const result = await validateOneTimePurchase({
      userId,
      productId: typeof req.body?.productId === 'string' ? req.body.productId : '',
      invoiceId: req.body?.invoiceId == null ? '' : String(req.body.invoiceId),
      sandbox: resolveRuStoreSandboxMode(),
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof RuStorePaymentError) {
      return res.status(TERMINAL.get(error.code) || 503).json({ error: error.code });
    }
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error?.code || 'PRODUCT_VALIDATION_FAILED' });
  }
}
