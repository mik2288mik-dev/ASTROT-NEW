import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { buildCanonicalNatalInputHash, isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/charts] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/charts] ERROR: ${message}`, error || '');
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const rawUserId = Array.isArray(id) ? id[0] : id;

  if (!isValidUserId(rawUserId)) {
    return res.status(400).json(invalidUserIdPayload('ru'));
  }
  const userId = String(rawUserId).trim();

  try {
    await requireAppUser(req, { expectedUserId: userId, allowGuest: true });

    if (req.method === 'GET') {
      const chartRecord = await db.natal_charts.get(userId);

      if (!chartRecord || !chartRecord.chart_data || !isCanonicalNatalChartDataComplete(chartRecord.chart_data)) {
        return res.status(404).json({ error: 'Chart not found' });
      }

      res.setHeader('X-Chart-Source', 'database');
      res.setHeader('X-Chart-Calculated-At', chartRecord.calculated_at || 'unknown');
      return res.status(200).json(chartRecord.chart_data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const chartData = req.body;
      const user = await db.users.get(userId);
      const birthDate = user?.birth_date;
      const birthTime = user?.birth_time || '';
      const normalizedBirthTime = birthTime || '12:00';
      const birthPlace = user?.birth_place;

      if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
        return res.status(400).json({
          error: 'Invalid chart data',
          message: 'Chart data must contain sun, moon, and rising positions',
        });
      }

      if (!birthDate || !birthPlace) {
        return res.status(400).json({
          error: 'Missing birth data',
          message: 'User birthDate and birthPlace are required for canonical chart persistence',
        });
      }

      if (typeof chartData.latitude !== 'number' || typeof chartData.longitude !== 'number' || typeof chartData.timezone !== 'string') {
        return res.status(400).json({
          error: 'Missing canonical natal data',
          message: 'Chart data must include latitude, longitude, and timezone',
        });
      }

      const inputHash = buildCanonicalNatalInputHash({
        birthDate,
        birthTime: normalizedBirthTime,
        birthTimeQuality: chartData.birthTimeQuality || chartData.chartQuality?.birthTimeQuality || undefined,
        latitude: chartData.latitude,
        longitude: chartData.longitude,
        timezone: chartData.timezone,
      });

      const savedChart = await db.natal_charts.set(userId, chartData, birthDate, normalizedBirthTime, birthPlace, inputHash);
      return res.status(200).json(savedChart.chart_data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
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
