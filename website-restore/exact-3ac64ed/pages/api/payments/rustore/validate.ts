import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { userHasRecoveryIdentity } from '../../../../lib/auth/accountIdentity';
import {
  resolveRuStoreSandboxMode,
  RuStorePaymentError,
  validateRuStorePurchase,
} from '../../../../lib/rustorePayments';

const TERMINAL_RUSTORE_VALIDATION_STATUSES = new Map<string, number>([
  ['RUSTORE_PURCHASE_ID_REQUIRED', 422],
  ['RUSTORE_PURCHASE_PRODUCT_MISMATCH', 422],
  ['RUSTORE_PURCHASE_USER_MISMATCH', 409],
  ['RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER', 409],
]);

export function rustoreValidationErrorStatus(error: unknown): number {
  if (error instanceof RuStorePaymentError) {
    return TERMINAL_RUSTORE_VALIDATION_STATUSES.get(error.code) || 503;
  }
  const status = Number((error as { status?: unknown } | null)?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req);
    if (!(await userHasRecoveryIdentity(auth.userId))) {
      return res.status(403).json({
        error: 'RECOVERY_IDENTITY_REQUIRED',
        message: 'Link VK ID, Yandex ID, or email before purchasing',
      });
    }
    const result = await validateRuStorePurchase({
      userId: auth.userId,
      productId: typeof req.body?.productId === 'string' ? req.body.productId : '',
      purchaseId: typeof req.body?.purchaseId === 'string' ? req.body.purchaseId : '',
      sandbox: resolveRuStoreSandboxMode(),
    });
    return res.status(200).json({
      entitlement: result.entitlement,
      status: result.status,
      purchaseActive: result.purchaseActive,
    });
  } catch (error: any) {
    const known = error instanceof RuStorePaymentError;
    return res.status(rustoreValidationErrorStatus(error)).json({
      error: known ? error.code : 'RUSTORE_VALIDATION_FAILED',
      message: known ? error.message : 'RuStore purchase validation failed',
    });
  }
}
