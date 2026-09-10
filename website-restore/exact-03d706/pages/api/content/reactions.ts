import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  ContentReactionKey,
  ContentReactionSurface,
  Language,
} from '../../../types';
import { db } from '../../../lib/db';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../lib/rateLimit';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';

const SURFACES = new Set<ContentReactionSurface>(['compatibility']);
const REACTION_KEYS = new Set<ContentReactionKey>(['like']);

function readValue(req: NextApiRequest, key: string): string {
  return String((req.method === 'GET' ? req.query[key] : req.body?.[key]) || '').trim();
}

function readLanguage(req: NextApiRequest): Language {
  return readValue(req, 'language') === 'en' ? 'en' : 'ru';
}

function isValidContentKey(value: string): boolean {
  return value.length >= 8
    && value.length <= 220
    && /^(?:sign|deep):[a-z0-9:._-]+$/.test(value);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const userId = readValue(req, 'userId');
  const surface = readValue(req, 'surface') as ContentReactionSurface;
  const contentKey = readValue(req, 'contentKey').toLowerCase();
  const reactionKey = (readValue(req, 'reactionKey') || 'like') as ContentReactionKey;
  const language = readLanguage(req);

  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(language));
  }
  if (!SURFACES.has(surface) || !isValidContentKey(contentKey) || !REACTION_KEYS.has(reactionKey)) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: language === 'en' ? 'Reaction target is invalid' : 'Некорректная цель реакции',
    });
  }

  try {
    await requireAppUser(req, { expectedUserId: userId, allowGuest: true });
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    throw error;
  }

  try {
    if (req.method === 'GET') {
      const summary = await db.content_reactions.getSummary(userId, surface, contentKey, reactionKey);
      return res.status(200).json({ summary });
    }

    const summary = req.body?.remove === true
      ? await db.content_reactions.unset(userId, surface, contentKey, reactionKey)
      : await db.content_reactions.set(userId, surface, contentKey, reactionKey);
    return res.status(200).json({ summary });
  } catch (error: any) {
    console.error('[API/content/reactions]', error?.message || error);
    return res.status(500).json({
      error: 'REACTIONS_FAILED',
      message: language === 'en' ? 'Unable to save the reaction' : 'Не удалось сохранить реакцию',
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.HOROSCOPE_ENGAGEMENT);
