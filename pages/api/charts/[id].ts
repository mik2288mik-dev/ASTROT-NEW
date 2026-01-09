import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/charts] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/charts] ERROR: ${message}`, error || '');
  },
};

/**
 * API для работы с натальными картами
 * 
 * GET /api/charts/:userId - получить карту из БД
 *   - Если карта есть: 200 + chartData
 *   - Если нет: 404
 * 
 * POST /api/charts/:userId - НЕ РЕКОМЕНДУЕТСЯ напрямую
 *   - Используйте /api/astrology/natal-chart для расчёта и сохранения
 *   - Этот endpoint только для совместимости
 */
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
    // ============ GET: Получить карту из БД ============
    if (req.method === 'GET') {
      log.info(`[GET] Fetching chart for userId=${userId}`);
      
      const chartRecord = await db.charts.get(userId);
      
      if (!chartRecord || !chartRecord.chart_data) {
        log.info(`[GET] DB_MISS: no chart for userId=${userId}`);
        return res.status(404).json({ error: 'Chart not found' });
      }

      const chartData = chartRecord.chart_data;
      
      // Валидация данных
      if (!chartData.sun || !chartData.moon) {
        log.error('[GET] Invalid chart data structure', { 
          hasSun: !!chartData.sun, 
          hasMoon: !!chartData.moon 
        });
        return res.status(500).json({ error: 'Invalid chart data structure' });
      }

      log.info(`[GET] DB_HIT: returning chart for userId=${userId}`, {
        sunSign: chartData.sun?.sign,
        calculatedAt: chartRecord.calculated_at
      });

      // Добавляем метаданные
      res.setHeader('X-Chart-Source', 'database');
      res.setHeader('X-Chart-Calculated-At', chartRecord.calculated_at || 'unknown');
      
      return res.status(200).json(chartData);
    }

    // ============ POST: Сохранить карту (legacy) ============
    if (req.method === 'POST' || req.method === 'PUT') {
      const chartData = req.body;
      
      // Валидация
      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        log.error(`[${req.method}] Invalid chart data`, {
          hasSun: !!chartData?.sun,
          hasMoon: !!chartData?.moon,
          hasRising: !!chartData?.rising
        });
        return res.status(400).json({ 
          error: 'Invalid chart data',
          message: 'Chart data must contain sun, moon, and rising positions'
        });
      }
      
      log.info(`[${req.method}] Saving chart for userId=${userId}`, {
        sunSign: chartData.sun?.sign
      });

      // Сохраняем без данных рождения (legacy mode)
      const savedChart = await db.charts.set(userId, chartData);

      log.info(`[${req.method}] SAVED: chart saved for userId=${userId}`);

      return res.status(200).json(savedChart.chart_data);
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
