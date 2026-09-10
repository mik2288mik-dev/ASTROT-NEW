import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  return res.status(410).json({
    error: 'EMAIL_MAGIC_LOGIN_RETIRED',
    message: 'Use email and password authentication',
  });
}
