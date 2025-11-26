import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { history, message, profile, systemInstruction } = req.body;
    const lang = profile?.language === 'ru';

    // TODO: Implement actual AI chat using OpenAI API
    // For now, return mock response
    
    const response = lang
      ? 'Звезды временно скрыты облаками. Попробуйте позже.'
      : 'The stars are temporarily clouded. Please try again later.';

    return res.status(200).json({ response });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
