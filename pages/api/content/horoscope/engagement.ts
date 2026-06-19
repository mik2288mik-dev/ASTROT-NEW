import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { normalizeEngagementKey } from '../../../../lib/horoscope/signDaily';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function readLanguage(req: NextApiRequest): Language {
  const raw = String((req.method === 'GET' ? req.query.language : req.body?.language) || '').trim();
  return raw === 'en' ? 'en' : 'ru';
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String((req.method === 'GET' ? req.query.userId : req.body?.userId) || '').trim();
  const sign = normalizeEngagementKey(String((req.method === 'GET' ? req.query.sign : req.body?.sign) || ''));
  const date = readDate(req);
  const language = readLanguage(req);

  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(language));
  }
  try {
    requireTelegramUserId(req, userId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }
  if (!sign) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'sign must be one of the zodiac keys' });
  }

  try {
    if (req.method === 'GET') {
      const summary = await db.horoscope_engagement.getSummary(userId, sign, date);
      return res.status(200).json({ summary });
    }

    const action = String(req.body?.action || '').trim();
    if (action === 'view') {
      const summary = await db.horoscope_engagement.markViewed(userId, sign, date);
      return res.status(200).json({ summary });
    }
    if (action === 'repost') {
      const summary = await db.horoscope_engagement.markReposted(userId, sign, date);
      return res.status(200).json({ summary });
    }
    return res.status(400).json({ error: 'BAD_REQUEST', message: "action must be 'view' or 'repost'" });
  } catch (error: any) {
    console.error('[API/content/horoscope/engagement]', error?.message || error);
    return res.status(500).json({ error: 'ENGAGEMENT_FAILED', message: error?.message || 'Failed' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.LUMI_ACTION);
