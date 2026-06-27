import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { calculateNatalChart, resolveBirthCoordinates } from '../../../../../lib/swisseph-calculator';

/**
 * Тест-режим: ввести дату/время/место → проверить, что расчёт работает (реальный
 * Swiss Ephemeris). НИЧЕГО не сохраняет. Право charts.view (диагностика).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'charts.view');

    const name = String(req.body?.name || 'Test').trim() || 'Test';
    const birthDate = String(req.body?.birthDate || '').trim();
    const birthTime = String(req.body?.birthTime || '12:00').trim() || '12:00';
    const birthPlace = String(req.body?.birthPlace || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new AdminAuthError(400, 'BAD_DATE', 'birthDate must be YYYY-MM-DD');
    if (!birthPlace) throw new AdminAuthError(400, 'BAD_PLACE', 'birthPlace is required');

    const started = Date.now();
    const coords = await resolveBirthCoordinates(birthPlace, {
      lat: Number(req.body?.latitude),
      lon: Number(req.body?.longitude),
    });
    const chart = await calculateNatalChart(name, birthDate, birthTime, birthPlace, { coordinates: coords });

    return res.status(200).json({
      ok: true,
      durationMs: Date.now() - started,
      coordinates: { lat: coords.lat, lon: coords.lon, timezone: coords.timezone },
      result: {
        sun: { sign: chart.sun?.sign, degree: Number((chart.sun?.degree ?? 0).toFixed(2)) },
        moon: { sign: chart.moon?.sign, degree: Number((chart.moon?.degree ?? 0).toFixed(2)) },
        ascendant: { sign: chart.rising?.sign, degree: Number((chart.rising?.degree ?? 0).toFixed(2)) },
        element: chart.element,
        rulingPlanet: chart.rulingPlanet,
        houses: chart.houses?.length ?? 0,
        aspects: chart.aspects?.length ?? 0,
        birthTimeQuality: chart.birthTimeQuality,
      },
    });
  } catch (error: any) {
    // Тест-режим: показываем реальную причину, чтобы админ видел, что сломалось.
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    return res.status(200).json({ ok: false, error: String(error?.message || error).slice(0, 300), code: error?.code || null });
  }
}
