import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';

const log = {
  info: (message: string, data?: any) => console.log(`[API/cards/[id]] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/cards/[id]] ERROR: ${message}`, error || ''),
};

function getUserId(req: NextApiRequest): string | null {
  const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;
  return Array.isArray(userId) ? userId[0] : userId || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const cardIdRaw = Array.isArray(id) ? id[0] : id;
  const cardId = cardIdRaw ? parseInt(String(cardIdRaw), 10) : NaN;

  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (isNaN(cardId) || cardId < 1) {
    return res.status(400).json({ error: 'Invalid card id' });
  }

  log.info('Request received', { method: req.method, userId, cardId });

  try {
    if (req.method === 'GET') {
      const card = await db.cards.getById(cardId, userId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      return res.status(200).json({ success: true, card });
    }

    if (req.method === 'PUT') {
      const { name, birth_date, birth_time, birth_place, latitude, longitude, timezone, data_json, is_purchased_full, is_purchased_pro } = req.body;

      const payload: Record<string, any> = {};
      if (name !== undefined) payload.name = name;
      if (birth_date !== undefined) payload.birth_date = birth_date;
      if (birth_time !== undefined) payload.birth_time = birth_time;
      if (birth_place !== undefined) payload.birth_place = birth_place;
      if (latitude !== undefined) payload.latitude = latitude;
      if (longitude !== undefined) payload.longitude = longitude;
      if (timezone !== undefined) payload.timezone = timezone;
      if (data_json !== undefined) payload.data_json = data_json;
      if (is_purchased_full !== undefined) payload.is_purchased_full = is_purchased_full;
      if (is_purchased_pro !== undefined) payload.is_purchased_pro = is_purchased_pro;

      const card = await db.cards.update(cardId, userId, payload);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      log.info('Card updated', { userId, cardId });
      return res.status(200).json({ success: true, card });
    }

    if (req.method === 'DELETE') {
      const result = await db.cards.delete(cardId, userId);
      if (!result.success) {
        return res.status(404).json({ error: 'Card not found' });
      }
      log.info('Card deleted', { userId, cardId });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    log.error('Error processing request', { error: error.message, userId, cardId });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
