import type { NextApiRequest, NextApiResponse } from 'next';
import { formatValidationErrors, validateNatalChartInput } from '../../../lib/validation';
import { db } from '../../../lib/db';
import { buyChartSlot, getChartSlotCost } from '../../../services/chartSlotService';
import { createOrReuseCanonicalChart } from '../../../lib/natalChartPersistence';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.query.userId as string) || req.body?.userId;

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    if (req.method === 'GET') {
      const charts = await db.natal_charts.getAll(userId);
      const user = await db.users.get(userId);
      const chartSlots = user?.chart_slots ?? 1;

      return res.status(200).json({
        charts,
        chartSlots,
        canAddMore: charts.length < chartSlots,
        slotCost: getChartSlotCost(),
      });
    }

    if (req.method === 'POST') {
      const { action, name, birthDate, birthTime, birthPlace, chartData, language } = req.body || {};

      if (action === 'buy-slot') {
        const result = await buyChartSlot(userId);
        return res.status(200).json({
          success: true,
          newBalance: result.newBalance,
          chartSlots: result.chartSlots,
        });
      }

      const normalizedBirthTime = birthTime || '12:00';
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const validation = validateNatalChartInput({
        name: name || 'My Chart',
        birthDate,
        birthTime: normalizedBirthTime,
        birthPlace,
        language: userLanguage,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: formatValidationErrors(validation.errors, userLanguage),
          errors: validation.errors,
        });
      }

      if (!birthDate || !birthPlace) {
        return res.status(400).json({
          error: 'birthDate and birthPlace are required',
        });
      }

      const result = await createOrReuseCanonicalChart({
        userId,
        name: name || 'Моя карта',
        birthDate,
        birthTime: normalizedBirthTime,
        birthPlace,
        chartData,
        language: userLanguage,
      });

      log.info(result.reused ? 'Chart reused' : 'Chart created', {
        userId,
        chartId: result.chart.id,
        reused: result.reused,
      });

      return res.status(200).json({
        ...result.chart,
        reused: result.reused,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error', { error: error.message });
    if (error.message?.includes('Chart slots limit')) {
      return res.status(403).json({ error: error.message, code: 'SLOTS_LIMIT' });
    }
    if (error.message?.includes('Insufficient Lumi')) {
      return res.status(403).json({ error: error.message, code: 'INSUFFICIENT_LUMI' });
    }
    return res.status(500).json({ error: error.message });
  }
}
