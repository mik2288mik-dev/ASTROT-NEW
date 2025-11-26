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

    const horoscope = {
      weekRange: `${new Date().toLocaleDateString()} - ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
      theme: lang ? 'Новые возможности' : 'New Opportunities',
      advice: lang ? 'Эта неделя принесет важные изменения.' : 'This week will bring important changes.',
      love: lang ? 'В отношениях наступит период гармонии.' : 'A period of harmony in relationships.',
      career: lang ? 'Профессиональный рост ожидается.' : 'Professional growth is expected.'
    };

    return res.status(200).json(horoscope);
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
