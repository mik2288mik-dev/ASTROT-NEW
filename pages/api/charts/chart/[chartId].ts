import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { createOrReuseCanonicalChart } from '../../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete } from '../../../../lib/natalChartCanonical';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  assertChartCanBeArchived,
  assertChartReadable,
  ChartAccessPolicyError,
  exposeChartAccess,
} from '../../../../lib/chartAccessPolicy';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts/chart] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts/chart] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number.parseInt(String(req.query.chartId), 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid chartId' });
  }

  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = auth.userId;
    const entitlement = await getPremiumEntitlementState(userId);

    if (req.method === 'GET') {
      let chart = await db.natal_charts.getById(id);
      if (!chart || String(chart.user_id) !== userId) {
        return res.status(404).json({ error: 'Chart not found' });
      }
      assertChartReadable(chart, entitlement.isPremium);

      if (!isCanonicalNatalChartDataComplete(chart.chart_data) && chart.birth_date && chart.birth_place) {
        const repaired = await createOrReuseCanonicalChart({
          userId,
          name: chart.name || 'Saved person',
          birthDate: chart.birth_date,
          birthTime: chart.birth_time || '',
          birthPlace: chart.birth_place,
        });
        chart = repaired.chart || chart;
      }

      return res.status(200).json(exposeChartAccess(chart!, entitlement.isPremium));
    }

    if (req.method === 'DELETE') {
      const chart = await db.natal_charts.getById(id);
      if (!chart || String(chart.user_id) !== userId) {
        return res.status(404).json({ error: 'Chart not found' });
      }
      assertChartCanBeArchived(chart);

      const archive = (db.natal_charts as any).archive;
      if (typeof archive !== 'function') {
        throw new Error('Chart archive persistence is not available');
      }
      await archive.call(db.natal_charts, id);
      log.info('Chart archived', { chartId: id, userId });
      return res.status(200).json({ success: true, archived: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    if (error instanceof ChartAccessPolicyError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    log.error('Error', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
}
