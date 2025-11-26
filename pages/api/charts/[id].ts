import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/charts/[id]] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/charts/[id]] ERROR: ${message}`, error || '');
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

  log.info(`Request received`, {
    method: req.method,
    userId,
    path: req.url
  });

  try {
    if (req.method === 'GET') {
      // Get chart data
      log.info(`[GET] Fetching chart for user: ${userId}`);
      const chart = await db.charts.get(userId);
      
      if (!chart) {
        log.info(`[GET] Chart not found for user: ${userId}`);
        return res.status(404).json({ error: 'Chart not found' });
      }

      log.info(`[GET] Chart found for user: ${userId}`, {
        hasSun: !!chart.chart_data?.sun,
        hasMoon: !!chart.chart_data?.moon,
        element: chart.chart_data?.element
      });

      return res.status(200).json(chart.chart_data || chart);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Save chart data
      const chartData = req.body;
      log.info(`[${req.method}] Saving chart for user: ${userId}`, {
        hasSun: !!chartData.sun,
        hasMoon: !!chartData.moon,
        element: chartData.element
      });

      const savedChart = await db.charts.set(userId, {
        user_id: userId,
        chart_data: chartData,
      });

      log.info(`[${req.method}] Chart saved successfully for user: ${userId}`);

      return res.status(200).json(savedChart.chart_data || savedChart);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', {
      error: error.message,
      stack: error.stack,
      userId
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
