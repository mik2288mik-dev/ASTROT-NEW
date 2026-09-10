import type { NextApiRequest, NextApiResponse } from 'next';
import { getManagedPremiumPlans } from '../../../lib/premiumPlanSettings';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const plans = await getManagedPremiumPlans();
  return res.status(200).json({
    plans: plans.filter((plan) => plan.isActive),
  });
}
