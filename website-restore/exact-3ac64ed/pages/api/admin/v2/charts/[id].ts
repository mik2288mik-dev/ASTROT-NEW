import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission, roleHasPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { db } from '../../../../../lib/db';

const MASK = '•••';
const sign = (p: any) => (p && typeof p === 'object' ? p.sign ?? null : null);
const deg = (p: any) => (p && typeof p.degree === 'number' ? Number(p.degree.toFixed(2)) : null);

/** Детали натального профиля. Право charts.view. Данные рождения маскируются (PII). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const chartId = Number(req.query.id);
  try {
    const ctx = await requireAdminPermission(req, 'charts.view');
    if (!Number.isFinite(chartId)) throw new AdminAuthError(400, 'CHART_ID_REQUIRED', 'Valid chart id required');

    const chart = await db.natal_charts.getById(chartId);
    if (!chart) throw new AdminAuthError(404, 'CHART_NOT_FOUND', 'Chart not found');

    const wantsPii = req.query.pii === '1' || req.query.pii === 'true';
    const showPii = wantsPii && roleHasPermission(ctx.role, 'user.pii.view');
    if (showPii) {
      await recordAdminAction({ req, actor: ctx, action: 'pii_viewed', entityType: 'chart', entityId: chartId });
    }

    const cd = chart.chart_data || {};
    const houses = Array.isArray(cd.houses) ? cd.houses : [];
    const aspects = Array.isArray(cd.aspects) ? cd.aspects : [];

    return res.status(200).json({
      chart: {
        id: chart.id,
        userId: String(chart.user_id),
        name: chart.name,
        isPrimary: chart.is_primary,
        version: chart.calculation_version,
        // вход расчёта
        input: {
          birthDate: showPii ? chart.birth_date : (chart.birth_date ? MASK : null),
          birthTime: showPii ? chart.birth_time : (chart.birth_time ? MASK : null),
          birthPlace: showPii ? chart.birth_place : (chart.birth_place ? MASK : null),
          latitude: chart.latitude,
          longitude: chart.longitude,
          timezone: chart.timezone,
        },
        // результат расчёта (не PII)
        result: {
          sun: { sign: sign(chart.sun), degree: deg(chart.sun) },
          moon: { sign: sign(chart.moon), degree: deg(chart.moon) },
          ascendant: { sign: sign(chart.ascendant), degree: deg(chart.ascendant) },
          housesCount: houses.length,
          aspectsCount: aspects.length,
          element: cd.element ?? null,
          rulingPlanet: cd.rulingPlanet ?? null,
        },
        status: sign(chart.sun) && sign(chart.moon) && sign(chart.ascendant) ? 'ok' : 'error',
        createdAt: chart.created_at ? new Date(chart.created_at).toISOString() : null,
        updatedAt: chart.updated_at ? new Date(chart.updated_at).toISOString() : null,
      },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
