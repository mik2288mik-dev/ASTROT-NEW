import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  getSignDailyHoroscopeSnapshot,
  normalizeZodiacKey,
} from '../../../../lib/horoscope/signDaily';
import { projectSignHoroscopeForWire } from '../../../../lib/horoscope/signWireCompatibility';

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
  const userAgent = String(req.headers?.['user-agent'] || '');

  // Today is public Free content, but callers may only access the current
  // Moscow day. All periods are prepared by the explicit monthly job.
  if (date !== getMoscowTodayKey()) {
    return res.status(400).json({ error: 'PERIOD_NOT_CURRENT', code: 'PERIOD_NOT_CURRENT' });
  }

  if (!sign) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sign must be one of the zodiac keys',
    });
  }

  const snapshot = await getSignDailyHoroscopeSnapshot(sign, date, language);
  if (!snapshot) {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_HOROSCOPE_NOT_READY' });
  }
  return res.status(200).json({
    reading: projectSignHoroscopeForWire(snapshot.reading, userAgent),
    source: snapshot.stale ? 'stale' : 'cache',
    stale: snapshot.stale,
  });
}
