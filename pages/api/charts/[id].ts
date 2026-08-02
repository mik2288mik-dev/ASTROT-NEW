import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { ensureCanonicalPrimaryChart } from '../../../lib/natalChartPersistence';

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
      const user = await db.users.get(userId);
      const birthDate = user?.birth_date;
      const birthTime = user?.birth_time || '';
      const birthPlace = user?.birth_place;

      if (!birthDate || !birthPlace) {
        return res.status(400).json({
          error: 'Missing birth data',
          message: 'User birthDate and birthPlace are required for canonical chart persistence',
        });
      }

      const result = await ensureCanonicalPrimaryChart({
        userId,
        name: user?.name || 'My Chart',
        birthDate,
        birthTime,
        birthPlace,
        language: user?.language || 'ru',
        forceRecalculate: false,
      });
      return res.status(200).json(result.chart.chart_data);
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
