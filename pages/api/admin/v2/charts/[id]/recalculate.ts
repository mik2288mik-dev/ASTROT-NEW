import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../../lib/admin/audit';
import { db } from '../../../../../../lib/db';
import { repairCanonicalChartRecord } from '../../../../../../lib/natalChartPersistence';

/** Пересчитать натальный профиль через Swiss Ephemeris. Право charts.recalc. Логируется. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const chartId = Number(req.query.id);
  try {
    const ctx = await requireAdminPermission(req, 'charts.recalc');
    if (!Number.isFinite(chartId)) throw new AdminAuthError(400, 'CHART_ID_REQUIRED', 'Valid chart id required');

    const chart = await db.natal_charts.getById(chartId);
    if (!chart) throw new AdminAuthError(404, 'CHART_NOT_FOUND', 'Chart not found');

    const before = { version: chart.calculation_version, sun: chart.sun_sign, moon: chart.moon_sign, asc: chart.ascendant_sign };
    const result = await repairCanonicalChartRecord(String(chart.user_id), chartId);
    const updated = result?.chart;

    await recordAdminAction({
      req, actor: ctx, action: 'chart_recalculated', entityType: 'chart', entityId: chartId,
      before,
      after: { source: result?.source ?? null, sun: updated?.sun_sign, moon: updated?.moon_sign, asc: updated?.ascendant_sign },
    });

    return res.status(200).json({
      ok: true,
      source: result?.source ?? null,
      result: updated
        ? { sunSign: updated.sun_sign, moonSign: updated.moon_sign, ascendantSign: updated.ascendant_sign, version: updated.calculation_version }
        : null,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
