import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { withAdminSource } from '../../../../lib/admin/dataSource';
import { resolveRange } from '../../../../lib/admin/ranges';
import {
  collectAbandonedOnboarding,
  collectOnboarding,
  collectProductFunnel,
  collectReading,
  collectWaits,
} from '../../../../lib/admin/productInsights';

/** «Путь и воронки»: where people go, where they leave, how long they wait and what they read. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    const range = resolveRange(req.query.range);
    const [funnel, onboarding, waits, reading, stuck] = await Promise.all([
      collectProductFunnel(range),
      collectOnboarding(range),
      collectWaits(range),
      collectReading(range),
      collectAbandonedOnboarding(Math.max(24, range.days * 24)),
    ]);
    return res.status(200).json({
      range: { key: range.key, label: range.label },
      funnel, onboarding, waits, reading, stuck,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}

export default withAdminSource(handler);
