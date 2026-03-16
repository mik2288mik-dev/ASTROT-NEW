import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/charts] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/charts] ERROR: ${message}`, error || '');
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  log.info(`Request: ${req.method} /api/charts/${userId}`);

  try {
    if (req.method === 'GET') {
      log.info(`[GET] Fetching chart for userId=${userId}`);

      if (!process.env.DATABASE_URL) {
        log.info('[GET] DATABASE_URL not configured, returning 404');
        return res.status(404).json({ error: 'Chart not found' });
      }

      let chartRecord;
      try {
        chartRecord = await db.natal_charts.get(userId);
      } catch (dbError: any) {
        log.error('[GET] Database error', { error: dbError.message, userId });
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to load chart from storage',
        });
      }

      if (!chartRecord || !chartRecord.chart_data) {
        log.info(`[GET] DB_MISS: no chart for userId=${userId}`);
        return res.status(404).json({ error: 'Chart not found' });
      }

      const chartData = chartRecord.chart_data;

      if (!chartData.sun || !chartData.moon) {
        log.error('[GET] Invalid chart data structure', {
          hasSun: !!chartData.sun,
          hasMoon: !!chartData.moon,
        });
        return res.status(500).json({ error: 'Invalid chart data structure' });
      }

      log.info(`[GET] DB_HIT: returning chart for userId=${userId}`, {
        sunSign: chartData.sun?.sign,
        calculatedAt: chartRecord.calculated_at,
      });

      res.setHeader('X-Chart-Source', 'database');
      res.setHeader('X-Chart-Calculated-At', chartRecord.calculated_at || 'unknown');

      return res.status(200).json(chartData);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const chartData = req.body;

      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        log.error(`[${req.method}] Invalid chart data`, {
          hasSun: !!chartData?.sun,
          hasMoon: !!chartData?.moon,
          hasRising: !!chartData?.rising,
        });
        return res.status(400).json({
          error: 'Invalid chart data',
          message: 'Chart data must contain sun, moon, and rising positions',
        });
      }

      log.info(`[${req.method}] Saving chart for userId=${userId}`, {
        sunSign: chartData.sun?.sign,
      });

      const savedChart = await db.natal_charts.set(userId, chartData);

      log.info(`[${req.method}] SAVED: chart saved for userId=${userId}`);

      return res.status(200).json(savedChart.chart_data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack,
      userId,
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
