import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { createOrReuseCanonicalChart } from '../../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete } from '../../../../lib/natalChartCanonical';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts/chart] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts/chart] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chartId } = req.query;
  const id = parseInt(String(chartId), 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid chartId' });
  }

  const userId = (req.query.userId as string) || req.body?.userId;

  try {
    if (req.method === 'GET') {
      let chart = await db.natal_charts.getById(id);
      if (!chart) return res.status(404).json({ error: 'Chart not found' });
      if (userId && String(chart.user_id) !== String(userId)) {
        return res.status(403).json({ error: 'Chart does not belong to user' });
      }
      if (!isCanonicalNatalChartDataComplete(chart.chart_data) && chart.birth_date && chart.birth_place) {
        const repaired = await createOrReuseCanonicalChart({
          userId: String(chart.user_id),
          name: chart.name || 'Моя карта',
          birthDate: chart.birth_date,
          birthTime: chart.birth_time || '12:00',
          birthPlace: chart.birth_place,
        });
        chart = repaired.chart || chart;
      }
      return res.status(200).json(chart);
    }

    if (req.method === 'DELETE') {
      if (!userId) {
        return res.status(400).json({ error: 'userId is required for delete' });
      }
      const chart = await db.natal_charts.getById(id);
      if (!chart) return res.status(404).json({ error: 'Chart not found' });
      if (String(chart.user_id) !== String(userId)) {
        return res.status(403).json({ error: 'Chart does not belong to user' });
      }
      await db.natal_charts.delete(id);
      log.info('Chart deleted', { chartId: id, userId });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
}
