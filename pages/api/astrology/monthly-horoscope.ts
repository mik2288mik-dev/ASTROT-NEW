import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData } = req.body;
    const lang = profile?.language === 'ru';
    const month = new Date().toLocaleString(lang ? 'ru' : 'en', { month: 'long' });

    const horoscope = {
      month,
      theme: lang ? 'Трансформация' : 'Transformation',
      focus: lang ? 'Личностный рост и развитие' : 'Personal growth and development',
      content: lang
        ? `Этот месяц ${month} принесет важные изменения в вашей жизни.`
        : `This ${month} will bring important changes to your life.`
    };

    return res.status(200).json(horoscope);
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
