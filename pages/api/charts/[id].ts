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

      // Проверяем что chart_data существует и содержит обязательные поля
      const chartData = chart.chart_data || chart;
      if (!chartData || !chartData.sun || !chartData.moon) {
        log.error('[GET] Invalid chart data structure', { hasSun: !!chartData?.sun, hasMoon: !!chartData?.moon });
        return res.status(500).json({ error: 'Invalid chart data structure' });
      }
      
      return res.status(200).json(chartData);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Save chart data
      const chartData = req.body;
      
      // Валидация обязательных полей
      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        log.error(`[${req.method}] Invalid chart data: missing required fields`, {
          hasSun: !!chartData?.sun,
          hasMoon: !!chartData?.moon,
          hasRising: !!chartData?.rising
        });
        return res.status(400).json({ 
          error: 'Invalid chart data',
          message: 'Chart data must contain sun, moon, and rising positions'
        });
      }
      
      log.info(`[${req.method}] Saving chart for user: ${userId}`, {
        hasSun: !!chartData.sun,
        hasMoon: !!chartData.moon,
        hasRising: !!chartData.rising,
        element: chartData.element
      });

      const savedChart = await db.charts.set(userId, {
        user_id: userId,
        chart_data: chartData,
      });

      log.info(`[${req.method}] Chart saved successfully for user: ${userId}`);

      const savedChartData = savedChart.chart_data || savedChart;
      // Проверяем сохраненные данные перед возвратом
      if (!savedChartData || !savedChartData.sun || !savedChartData.moon) {
        log.error(`[${req.method}] Saved chart data is invalid`, { userId });
        return res.status(500).json({ error: 'Failed to save chart data correctly' });
      }

      return res.status(200).json(savedChartData);
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
