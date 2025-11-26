import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, topic, chartData } = req.body;
    const lang = profile?.language === 'ru';

    const analysis = lang
      ? `Глубокий анализ по теме "${topic}" для ${profile?.name}. Ваша карта показывает интересные аспекты в этой области.`
      : `Deep analysis on "${topic}" for ${profile?.name}. Your chart shows interesting aspects in this area.`;

    return res.status(200).json({ analysis });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
