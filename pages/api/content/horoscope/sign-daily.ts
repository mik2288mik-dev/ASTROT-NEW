import OpenAI from 'openai';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDailyReading, Language } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { getZodiacSign } from '../../../../constants';

export const config = { maxDuration: 45 };

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const ZODIAC_KEYS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

type ZodiacKey = (typeof ZODIAC_KEYS)[number];

const SIGN_HOROSCOPE_PROMPT_VERSION = 'air-v2';

function readSign(req: NextApiRequest): ZodiacKey | null {
  const raw = String((req.method === 'GET' ? req.query.sign : req.body?.sign) || '').trim();
  const normalized = ZODIAC_KEYS.find((key) => key.toLowerCase() === raw.toLowerCase());
  return normalized || null;
}

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

function readLanguage(req: NextApiRequest): Language {
  const raw = String((req.method === 'GET' ? req.query.language : req.body?.language) || '').trim();
  return raw === 'en' ? 'en' : 'ru';
}

function cleanLine(value: unknown, fallback: string) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function cleanAdvice(value: unknown, fallback: string[]) {
  const items = Array.isArray(value)
    ? value.map((item) => cleanLine(item, '')).filter(Boolean).slice(0, 3)
    : [];
  return items.length ? items : fallback;
}

function buildFallback(sign: ZodiacKey, date: string, language: Language): ForecastDailyReading {
  const signLabel = getZodiacSign(language, sign);

  if (language === 'en') {
    return {
      date,
      headline: `${signLabel}: choose one honest rhythm for the day`,
      summary: `Today works better for ${signLabel} when you do not try to answer everything at once.`,
      chance: 'A simple decision can return a sense of control and ease.',
      risk: 'The soft risk is reacting too quickly before you understand what is actually important.',
      focus: 'Pick one priority and give it a calm, visible step.',
      reading:
        `For ${signLabel}, the day is less about proving something and more about finding the right pace. Notice where you are being pulled into noise, hurry, or other people’s expectations. The useful move is to return to one clear intention and act from there.\n\nIf you keep the day simple, you can feel more collected and less dependent on outside pressure. Let the horoscope be a small compass: not a prediction, but a way to choose your next step with more steadiness.`,
      context: 'This is a general zodiac horoscope. The deeper personal layer opens through your full natal chart.',
      advice: [
        'Do not turn one mood into a whole conclusion.',
        'Say yes only where your body also relaxes a little.',
        'A small clean step is stronger than a dramatic promise.',
      ],
    };
  }

  return {
    date,
    headline: `${signLabel}: день просит выбрать один честный ритм`,
    summary: `Сегодня ${signLabel} легче чувствует опору, когда не пытается отвечать на всё сразу.`,
    chance: 'Есть шанс спокойно сдвинуть важное дело, если не распыляться на чужой шум.',
    risk: 'Мягкий риск дня — отреагировать слишком быстро, пока главное ещё не стало ясным.',
    focus: 'Выберите один приоритет и сделайте по нему небольшой, но видимый шаг.',
    reading:
      `Для знака ${signLabel} этот день не про доказательство силы, а про точный темп. Обратите внимание, где вас уводит в спешку, лишние ожидания или желание всё сразу объяснить. Полезнее вернуться к одному ясному намерению и действовать от него.\n\nЕсли упростить день, станет легче почувствовать собранность и не зависеть от внешнего давления. Пусть гороскоп будет не приговором, а маленьким компасом: он помогает выбрать следующий шаг спокойнее и честнее.`,
    context: 'Это общий гороскоп по знаку. Более точный личный слой открывается через полную натальную карту.',
    advice: [
      'Не превращайте одно настроение в большой вывод.',
      'Соглашайтесь только там, где внутри становится чуть спокойнее.',
      'Маленький чистый шаг сильнее, чем драматичное обещание.',
    ],
  };
}

function normalizeReading(raw: Partial<ForecastDailyReading> | null, sign: ZodiacKey, date: string, language: Language) {
  const fallback = buildFallback(sign, date, language);
  const normalized = {
    date,
    headline: cleanLine(raw?.headline, fallback.headline),
    summary: cleanLine(raw?.summary, fallback.summary),
    chance: cleanLine(raw?.chance, fallback.chance),
    risk: cleanLine(raw?.risk, fallback.risk),
    focus: cleanLine(raw?.focus, fallback.focus),
    reading: cleanLine(raw?.reading, fallback.reading),
    context: cleanLine(raw?.context, fallback.context),
    advice: cleanAdvice(raw?.advice, fallback.advice),
  } satisfies ForecastDailyReading;

  const joined = [
    normalized.headline,
    normalized.summary,
    normalized.reading,
    normalized.focus,
    normalized.chance,
    normalized.risk,
  ].join(' ');
  const staleOrGeneric =
    /зв[её]зды\s+благоволят|stars?\s+align|Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces/i.test(
      joined
    ) ||
    joined.includes('undefined') ||
    joined.includes('null');

  return language === 'ru' && staleOrGeneric ? fallback : normalized;
}

function parseCached(content: unknown, sign: ZodiacKey, date: string, language: Language): ForecastDailyReading | null {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (parsed && typeof parsed === 'object') {
      return normalizeReading(parsed as Partial<ForecastDailyReading>, sign, date, language);
    }
  } catch {
    if (typeof content === 'string' && content.trim()) {
      const fallback = buildFallback(sign, date, language);
      return { ...fallback, reading: content.trim() };
    }
  }
  return null;
}

async function generateSignReading(sign: ZodiacKey, date: string, language: Language): Promise<ForecastDailyReading> {
  const fallback = buildFallback(sign, date, language);
  if (!openai) return fallback;

  const signLabel = getZodiacSign(language, sign);
  const system =
    language === 'en'
      ? 'You write warm, useful daily zodiac horoscopes. No fatalism, no medical/financial/legal promises, no generic fluff. Return only valid JSON.'
      : 'Ты пишешь тёплые, полезные ежедневные гороскопы по знаку для приложения Lumia. Без фатализма, медицинских/финансовых/юридических обещаний, клише вроде “звёзды благоволят” и общей воды. Не используй английские названия знаков. Верни только валидный JSON.';
  const user =
    language === 'en'
      ? `Create a general daily horoscope for ${signLabel} on ${date}. It is free zodiac content, not a full natal chart forecast. Return JSON with fields: headline, summary, chance, risk, focus, reading, context, advice. The reading must be 2 short paragraphs, human, practical, and inviting.`
      : `Создай общий ежедневный гороскоп для знака ${signLabel} на ${date}. Это бесплатный гороскоп по знаку, не прогноз по полной натальной карте. Верни JSON с полями: headline, summary, chance, risk, focus, reading, context, advice. Reading: 2 коротких абзаца, живо, понятно, практично, с желанием читать дальше. Не пиши “звёзды благоволят”, “вселенная говорит”, “энергия Марса и Юпитера” без реального смысла, не используй Aries/Virgo/Pisces и другие английские названия.`;

  try {
    const { model } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'forecast',
      contentVariant: 'daily',
    });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.82,
      max_tokens: 1000,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return normalizeReading(parsed, sign, date, language);
  } catch (error) {
    console.error('[horoscope/sign-daily] generation failed:', error instanceof Error ? error.message : error);
    return fallback;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sign = readSign(req);
  const date = readDate(req);
  const language = readLanguage(req);

  if (!sign) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sign must be one of the zodiac keys',
    });
  }

  const cacheKey = `${sign.toLowerCase()}:${language}:${SIGN_HOROSCOPE_PROMPT_VERSION}`;
  const cached = await db.daily_horoscopes.get(cacheKey, date).catch(() => null);
  const cachedReading = parseCached(cached, sign, date, language);

  if (req.method === 'GET') {
    if (!cachedReading) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'SIGN_HOROSCOPE_NOT_READY' });
    }
    return res.status(200).json({ reading: cachedReading, source: 'cache' });
  }

  if (cachedReading) {
    return res.status(200).json({ reading: cachedReading, source: 'cache' });
  }

  const reading = await generateSignReading(sign, date, language);
  await db.daily_horoscopes.set(cacheKey, date, JSON.stringify(reading)).catch((error) => {
    console.error('[horoscope/sign-daily] cache write failed:', error instanceof Error ? error.message : error);
  });

  return res.status(200).json({ reading, source: 'generated' });
}
