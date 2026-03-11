import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/cards] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/cards] ERROR: ${message}`, error || ''),
};

function getUserId(req: NextApiRequest): string | null {
  const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;
  return Array.isArray(userId) ? userId[0] : userId || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  log.info('Request received', { method: req.method, userId });

  try {
    if (req.method === 'GET') {
      const cards = await db.cards.list(userId);
      return res.status(200).json({ success: true, cards });
    }

    if (req.method === 'POST') {
      const { name, birth_date, birth_time, birth_place, latitude, longitude, timezone, data_json } = req.body;

      if (!birth_date || !birth_place || data_json === undefined) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'birth_date, birth_place, and data_json are required',
        });
      }

      const payload = {
        name: name?.trim() || 'Я',
        birth_date,
        birth_time: birth_time || null,
        birth_place,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timezone: timezone || null,
        data_json,
      };

      const card = await db.cards.create(userId, payload);
      log.info('Card created', { userId, cardId: card.id });
      return res.status(200).json({ success: true, card });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', { error: error.message, userId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
