/**
 * Calculate natal chart without saving.
 * Used for multi-chart creation flow: client gets chartData, then POSTs to /api/charts.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { calculateNatalChart } from '../../../lib/swisseph-calculator';
import { validateNatalChartInput, formatValidationErrors } from '../../../lib/validation';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/calculate-natal] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/calculate-natal] ERROR: ${msg}`, err || ''),
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, birthDate, birthTime, birthPlace, language } = req.body;

    const validation = validateNatalChartInput({
      name,
      birthDate,
      birthTime: birthTime || '12:00',
      birthPlace,
      language: language || 'ru',
    });

    if (!validation.isValid) {
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const errorMessage = formatValidationErrors(validation.errors, userLanguage);
      return res.status(400).json({ error: 'Validation failed', message: errorMessage, errors: validation.errors });
    }

    const chartData = await calculateNatalChart(
      name || 'Chart',
      birthDate,
      birthTime || '12:00',
      birthPlace
    );

    if (!chartData || !chartData.sun || !chartData.moon || !chartData.rising) {
      throw new Error('Invalid chart data: missing essential planets');
    }

    log.info('Calculated', { sunSign: chartData.sun?.sign });
    return res.status(200).json(chartData);
  } catch (error: any) {
    log.error('Error', { error: error.message });
    const userLanguage = req.body?.language === 'en' ? 'en' : 'ru';
    const errorMsg = (error.message || '').toLowerCase();
    let message = userLanguage === 'ru' ? 'Не удалось рассчитать карту.' : 'Failed to calculate chart.';
    if (errorMsg.includes('location') || errorMsg.includes('coordinates') || errorMsg.includes('nominatim')) {
      message = userLanguage === 'ru'
        ? 'Не удалось найти место рождения.'
        : 'Location not found.';
    }
    return res.status(500).json({ error: 'Calculation failed', message });
  }
}
