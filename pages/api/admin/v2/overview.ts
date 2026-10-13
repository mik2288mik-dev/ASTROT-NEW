import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { withAdminSource } from '../../../../lib/admin/dataSource';
import { resolveRange } from '../../../../lib/admin/ranges';
import { collectWaits } from '../../../../lib/admin/productInsights';
import { buildHints } from '../../../../lib/admin/hints';
import { getMyTrackerConfig } from '../../../../lib/myTracker';
import {
  collectAudience,
  collectDailySeries,
  collectMetrics,
  collectRetention,
  collectVersions,
  METRIC_GLOSSARY,
} from '../../../../lib/productMetrics';

/** «Обзор»: the main numbers for a period, the trend and what to fix first. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'analytics.view');
    const now = new Date();
    const range = resolveRange(req.query.range, now);
    const retentionDays = String(req.query.retention || '1,3,7,30').split(',').map(Number).filter((d) => [1, 3, 7, 14, 30].includes(d));
    const seriesDays = range.days >= 30 ? Math.min(90, range.days) : 14;
    const [metrics, previous, audience, retention, series, versions, waits] = await Promise.all([
      collectMetrics(range),
      collectMetrics(range.previous),
      collectAudience(now),
      collectRetention(retentionDays.length ? retentionDays : [1, 7, 30], now),
      collectDailySeries(seriesDays, now),
      collectVersions(now),
      collectWaits(range),
    ]);
    return res.status(200).json({
      range: { key: range.key, label: range.label, start: range.start.toISOString(), end: range.end.toISOString() },
      metrics, previous, audience, retention, series, versions,
      hints: buildHints({ metrics, previous, retention, versions, waits: waits.server, myTrackerEnabled: !!getMyTrackerConfig() }),
      glossary: METRIC_GLOSSARY,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}

export default withAdminSource(handler);
