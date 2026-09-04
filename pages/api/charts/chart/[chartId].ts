import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getCanonicalNatalChart } from '../../../../lib/natalChartRead';
import chartsHandler from '../index';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  assertChartCanBeArchived,
  ChartAccessPolicyError,
  exposeChartAccess,
} from '../../../../lib/chartAccessPolicy';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts/chart] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts/chart] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.chartId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid chartId' });
  }

  if(req.method==='PUT') { req.body={...req.body,chartId:id,primary:false}; return chartsHandler(req,res); }

  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = auth.userId;
    const entitlement = await getPremiumEntitlementState(userId);

    if (req.method === 'GET') {
      const chart = await getCanonicalNatalChart(userId, id);
      const active = await db.natal_charts.getAll(userId);
      return res.status(200).json(exposeChartAccess(chart, entitlement.isPremium, active));
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
    if(error?.code==='CHART_REPAIR_REQUIRED'||error?.code==='CHART_NOT_FOUND') return res.status(error.status).json({error:error.message,code:error.code});
    log.error('Error', { error: error.message });
    return res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'production' ? {} : { message: error.message }),
    });
  }
}
