import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  getCachedSignDailyHoroscope,
  getOrGenerateSignDailyHoroscope,
  getSignDailyHoroscopeSnapshot,
  normalizeZodiacKey,
} from '../../../../lib/horoscope/signDaily';
import {
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { buildSignHoroscopeLockKey } from '../../../../lib/horoscope/signGenerationLock';
import { hasDatabaseUrl } from '../../../../lib/database-url';

export const config = { maxDuration: 90 };

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function readLanguage(req: NextApiRequest): Language {
  const raw = String((req.method === 'GET' ? req.query.language : req.body?.language) || '').trim();
  return raw === 'en' ? 'en' : 'ru';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sign = normalizeZodiacKey(String((req.method === 'GET' ? req.query.sign : req.body?.sign) || ''));
  const date = readDate(req);
  const language = readLanguage(req);

  // Today is public Free content, but callers may only access the current
  // Moscow day. Tomorrow is warmed through the authenticated cron path.
  if (date !== getMoscowTodayKey()) {
    return res.status(400).json({ error: 'PERIOD_NOT_CURRENT', code: 'PERIOD_NOT_CURRENT' });
  }

  if (!sign) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sign must be one of the zodiac keys',
    });
  }

  if (req.method === 'GET') {
    const snapshot = await getSignDailyHoroscopeSnapshot(sign, date, language);
    if (!snapshot) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_HOROSCOPE_NOT_READY' });
    }
    return res.status(200).json({
      reading: snapshot.reading,
      source: snapshot.stale ? 'stale' : 'cache',
      stale: snapshot.stale,
    });
  }

  if (!hasDatabaseUrl()) {
    return res.status(503).json({
      error: 'CONTENT_CACHE_UNAVAILABLE',
      code: 'CONTENT_CACHE_UNAVAILABLE',
    });
  }

  try {
    const lockResult = await withContentGenerationLock({
      lockKey: buildSignHoroscopeLockKey('day', date, language),
      operation: `sign-daily-batch-${language}-${date}`,
      readCached: async () => {
        const cached = await getCachedSignDailyHoroscope(sign, date, language);
        return cached ? { value: cached, source: 'cache' } : null;
      },
      generate: () => getOrGenerateSignDailyHoroscope(sign, date, language),
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    return res.status(200).json({
      reading: lockResult.value,
      source: lockResult.fromCache ? (lockResult.source || 'cache') : 'generated',
    });
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    const code = error?.code || (status === 503 ? 'CONTENT_GENERATION_UNAVAILABLE' : 'SIGN_HOROSCOPE_FAILED');
    return res.status(status).json({
      error: code,
      code,
      message:
        language === 'en'
          ? 'The horoscope could not be generated right now. Please try again.'
          : 'Гороскоп сейчас не удалось сгенерировать. Попробуй ещё раз.',
    });
  }
}
