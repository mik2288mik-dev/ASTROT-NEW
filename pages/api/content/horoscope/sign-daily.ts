import type { NextApiRequest, NextApiResponse } from 'next';
import type { Language } from '../../../../types';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import {
  getCachedSignDailyHoroscope,
  getOrGenerateSignDailyHoroscope,
  normalizeZodiacKey,
} from '../../../../lib/horoscope/signDaily';

export const config = { maxDuration: 45 };

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function readLanguage(req: NextApiRequest): Language {
  const raw = String((req.method === 'GET' ? req.query.language : req.body?.language) || '').trim();
  return raw === 'en' ? 'en' : 'ru';
}

function readStrict(req: NextApiRequest): boolean {
  const raw = req.method === 'GET' ? req.query.strict : req.body?.strict;
  return raw === true || raw === 'true' || raw === '1';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sign = normalizeZodiacKey(String((req.method === 'GET' ? req.query.sign : req.body?.sign) || ''));
  const date = readDate(req);
  const language = readLanguage(req);
  const strict = readStrict(req);

  if (!sign) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sign must be one of the zodiac keys',
    });
  }

  if (req.method === 'GET') {
    const cached = await getCachedSignDailyHoroscope(sign, date, language);
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_HOROSCOPE_NOT_READY' });
    }
    return res.status(200).json({ reading: cached, source: 'cache' });
  }

  try {
    const reading = await getOrGenerateSignDailyHoroscope(sign, date, language, {
      allowStaticFallback: !strict,
    });
    return res.status(200).json({ reading, source: 'generated' });
  } catch (error: any) {
    const status = error?.status === 503 ? 503 : 500;
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
