import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts/set-primary] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts/set-primary] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chartId, userId } = req.body || req.query;

  if (!chartId) {
    return res.status(400).json({ error: 'chartId is required' });
  }

  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload('ru'));
  }

  const chartIdNum = parseInt(String(chartId), 10);
  if (isNaN(chartIdNum)) {
    return res.status(400).json({ error: 'chartId must be a number' });
  }

  try {
    const chart = await db.natal_charts.getById(chartIdNum);
    if (!chart) {
      return res.status(404).json({ error: 'Chart not found' });
    }
    if (String(chart.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Chart does not belong to user' });
    }

    await db.natal_charts.setPrimary(chartIdNum);
    log.info('Primary set', { chartId: chartIdNum, userId });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    log.error('Error', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
}
