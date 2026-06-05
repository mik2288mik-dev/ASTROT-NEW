import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 50);

  if (!userId) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }
  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const user = await db.users.get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  const items = await db.astro_questions.getByUser(userId, limit);
  return res.status(200).json({
    items: items.map((item: any) => ({
      question: item.question,
      answer: item.answer,
      createdAt: new Date(item.created_at).toISOString(),
    })),
  });
}
