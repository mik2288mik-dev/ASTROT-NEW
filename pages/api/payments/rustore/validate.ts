import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { userHasRecoveryIdentity } from '../../../../lib/auth/accountIdentity';
import { RuStorePaymentError, validateRuStorePurchase } from '../../../../lib/rustorePayments';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req);
    if (!(await userHasRecoveryIdentity(auth.userId))) {
      return res.status(403).json({
        error: 'RECOVERY_IDENTITY_REQUIRED',
        message: 'Link VK ID, Yandex ID, Google, or email before purchasing',
      });
    }
    const result = await validateRuStorePurchase({
      userId: auth.userId,
      productId: typeof req.body?.productId === 'string' ? req.body.productId : '',
      purchaseId: typeof req.body?.purchaseId === 'string' ? req.body.purchaseId : '',
      sandbox: process.env.RUSTORE_PAY_MODE === 'sandbox',
    });
    return res.status(200).json({
      entitlement: result.entitlement,
      status: result.status,
      purchaseActive: result.purchaseActive,
    });
  } catch (error: any) {
    const known = error instanceof RuStorePaymentError;
    return res.status(known ? 422 : (error?.status || 500)).json({
      error: known ? error.code : 'RUSTORE_VALIDATION_FAILED',
      message: known ? error.message : 'RuStore purchase validation failed',
    });
  }
}
