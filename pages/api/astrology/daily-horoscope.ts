import type { NextApiRequest, NextApiResponse } from 'next';

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[API/astrology/daily-horoscope] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[API/astrology/daily-horoscope] ERROR: ${message}`, error || '');
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, context } = req.body;
    const lang = profile?.language === 'ru';

    const horoscope = {
      date: new Date().toISOString().split('T')[0],
      mood: lang ? 'Вдохновленный' : 'Inspired',
      color: 'Purple',
      number: 7,
      content: lang
        ? 'Сегодня звезды благоприятствуют новым начинаниям.'
        : 'Today the stars favor new beginnings.',
      moonImpact: lang
        ? 'Луна в вашем знаке усиливает интуицию.'
        : 'Moon in your sign enhances intuition.',
      transitFocus: lang
        ? 'Меркурий способствует общению.'
        : 'Mercury favors communication.'
    };

    return res.status(200).json(horoscope);
  } catch (error: any) {
    log.error('Error getting daily horoscope', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
