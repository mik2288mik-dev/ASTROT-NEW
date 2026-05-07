import type { NextApiRequest, NextApiResponse } from 'next';
import type { HoroscopeReactionKey, Language } from '../../../../types';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { normalizeZodiacKey } from '../../../../lib/horoscope/signDaily';
import { hydrateReactionSummaryLabels } from '../../../../lib/todayOverview';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';

const REACTION_KEYS = new Set<HoroscopeReactionKey>(['spot_on', 'funny', 'gentle', 'not_mine']);

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
  const sign = normalizeZodiacKey(String((req.method === 'GET' ? req.query.sign : req.body?.sign) || ''));
  const date = readDate(req);
  const language = readLanguage(req);

  if (!userId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'userId is required' });
  }
  if (!sign) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'sign must be one of the zodiac keys' });
  }

  try {
    if (req.method === 'GET') {
      const summary = await db.horoscope_reactions.getSummary(userId, sign, date);
      return res.status(200).json({ summary: hydrateReactionSummaryLabels(summary, language) });
    }

    const reactionKey = String(req.body?.reactionKey || '').trim() as HoroscopeReactionKey;
    if (!REACTION_KEYS.has(reactionKey)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'reactionKey is invalid' });
    }

    const summary = await db.horoscope_reactions.set(userId, sign, date, reactionKey);
    return res.status(200).json({ summary: hydrateReactionSummaryLabels(summary, language) });
  } catch (error: any) {
    console.error('[API/content/horoscope/reactions]', error?.message || error);
    return res.status(500).json({ error: 'REACTIONS_FAILED', message: error?.message || 'Failed' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.LUMI_ACTION);
