import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getManagedPremiumPlans, saveManagedPremiumPlans } from '../../../../../lib/premiumPlanSettings';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'billing.view');
      const plans = await getManagedPremiumPlans();
      return res.status(200).json({ plans });
    }

    if (req.method === 'PUT') {
      const ctx = await requireAdminPermission(req, 'paywall.manage');
      const plansInput = req.body?.plans;
      if (!plansInput || (typeof plansInput !== 'object' && !Array.isArray(plansInput))) {
        throw new AdminAuthError(400, 'BAD_PLANS', 'plans must be an array or object');
      }

      const before = await getManagedPremiumPlans();
      const plans = await saveManagedPremiumPlans(plansInput);
      await recordAdminAction({
        req,
        actor: ctx,
        action: 'settings_changed',
        entityType: 'premium_plans',
        entityId: 'premium_plans_config',
        before,
        after: plans,
      });
      return res.status(200).json({ ok: true, plans });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
