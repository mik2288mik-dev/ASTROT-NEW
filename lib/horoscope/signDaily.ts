import OpenAI from 'openai';
import type { ForecastDailyReading, Language } from '../../types';
import { getModelForTier } from '../appSettings';
import { getContentPolicy } from '../contentMatrix';
import { buildOpenAIChatParams } from '../openaiChat';
import { buildSignDailyHoroscopePrompt, parseLumiaJson } from '../contentPromptBuilders';
import { db } from '../db';
import { getZodiacSign } from '../../constants';
import { getMoonPhase } from './moonPhase';

/** Реальный контекст дня для общего гороскопа по знаку — фаза Луны конкретной даты. */
function dayContext(date: string, language: Language) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
    : new Date();
  const moon = getMoonPhase(dt, language === 'en' ? 'en' : 'ru');
  return {
    phase: moon.label,
    illumination: `${Math.round(moon.illumination)}%`,
    meaning: moon.meaning,
  };
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const ZODIAC_KEYS = [
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

export type ZodiacKey = (typeof ZODIAC_KEYS)[number];

export const SIGN_HOROSCOPE_PROMPT_VERSION = getContentPolicy('sign_daily_horoscope').promptVersion;

export function normalizeZodiacKey(value: string | null | undefined): ZodiacKey | null {
  const raw = String(value || '').trim();
  return ZODIAC_KEYS.find((key) => key.toLowerCase() === raw.toLowerCase()) || null;
}

/**
 * Ключ вовлечённости (лайки/просмотры): либо один знак, либо пара "знак_знак" в
 * каноническом порядке — для совместимости. Возвращает null, если невалидно.
 */
export function normalizeEngagementKey(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (raw.startsWith('arcana_')) {
    const n = Number.parseInt(raw.slice(7), 10);
    return Number.isInteger(n) && n >= 1 && n <= 22 ? `arcana_${n}` : null;
  }
  if (raw.includes('_')) {
    const parts = raw.split('_');
    if (parts.length !== 2) return null;
    const a = normalizeZodiacKey(parts[0]);
    const b = normalizeZodiacKey(parts[1]);
    if (!a || !b) return null;
    return [a, b].sort().join('_');
  }
  return normalizeZodiacKey(raw);
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

export function buildSignDailyFallback(
  sign: ZodiacKey,
  date: string,
  language: Language
): ForecastDailyReading {
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
    context: 'This is a general zodiac horoscope. A more precise personal reading opens through your full natal chart.',
      advice: [
        'Do not turn one mood into a whole conclusion.',
        'Say yes only where your body also relaxes a little.',
        'A small clean step is stronger than a dramatic promise.',
      ],
    };
  }

  return {
    date,
    headline: `${signLabel}: день для одного понятного шага`,
    summary: `Сегодня ${signLabel} лучше не пытаться отвечать на всё сразу.`,
    chance: 'Есть шанс сдвинуть важное дело, если не распыляться на чужие запросы.',
    risk: 'Риск дня - отреагировать слишком быстро, пока главное ещё не стало ясным.',
    focus: 'Выберите один приоритет и сделайте по нему небольшой, но видимый шаг.',
    reading:
      `Для знака ${signLabel} этот день не про попытку доказать всё сразу. Обратите внимание, где вас уводит в спешку, лишние ожидания или желание всем ответить немедленно. Полезнее выбрать одно понятное действие и довести его до конца.\n\nЕсли упростить день, станет легче не зависеть от внешнего давления. Это не приговор и не обещание событий, а общий ориентир по знаку: что проверить, где не торопиться и какой следующий шаг выбрать.`,
    context: 'Это общий гороскоп по знаку. Более точный личный разбор открывается через полную натальную карту.',
    advice: [
      'Не превращайте одно настроение в большой вывод.',
      'Соглашайтесь только там, где понятны условия и последствия.',
      'Маленький чистый шаг сильнее, чем драматичное обещание.',
    ],
  };
}

function normalizeReading(
  raw: Partial<ForecastDailyReading> | null,
  sign: ZodiacKey,
  date: string,
  language: Language
) {
  const fallback = buildSignDailyFallback(sign, date, language);
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

function parseCached(
  content: unknown,
  sign: ZodiacKey,
  date: string,
  language: Language
): ForecastDailyReading | null {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (parsed && typeof parsed === 'object') {
      return normalizeReading(parsed as Partial<ForecastDailyReading>, sign, date, language);
    }
  } catch {
    if (typeof content === 'string' && content.trim()) {
      const fallback = buildSignDailyFallback(sign, date, language);
      return { ...fallback, reading: content.trim() };
    }
  }
  return null;
}

async function generateSignReading(
  sign: ZodiacKey,
  date: string,
  language: Language,
  options?: { allowStaticFallback?: boolean }
): Promise<ForecastDailyReading> {
  const fallback = buildSignDailyFallback(sign, date, language);
  const allowStaticFallback = options?.allowStaticFallback !== false;
  if (!openai) {
    if (!allowStaticFallback) {
      const error = new Error('OpenAI content generation is not configured') as Error & { code?: string; status?: number };
      error.code = 'CONTENT_GENERATION_UNAVAILABLE';
      error.status = 503;
      throw error;
    }
    return fallback;
  }

  const signLabel = getZodiacSign(language, sign);
  const prompt = buildSignDailyHoroscopePrompt({ language, context: { sign: signLabel, date, moon: dayContext(date, language) } });

  try {
    const model = await getModelForTier(getContentPolicy('sign_daily_horoscope').modelTier);
    const completion = await openai.chat.completions.create(buildOpenAIChatParams(model, {
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.82,
      maxTokens: 500,
      jsonMode: true,
    }));
    const parsed = parseLumiaJson<{ headline?: string; text?: string; advice?: string }>(completion.choices[0]?.message?.content, {});
    return normalizeReading({ ...parsed, summary: parsed.text, reading: parsed.text, focus: parsed.advice, advice: parsed.advice ? [parsed.advice] : [] }, sign, date, language);
  } catch (error: any) {
    console.error('[horoscope/sign-daily] generation failed:', error instanceof Error ? error.message : error);
    if (!allowStaticFallback) {
      const nextError = new Error(error?.message || 'Sign horoscope generation failed') as Error & {
        code?: string;
        status?: number;
      };
      nextError.code = 'CONTENT_GENERATION_UNAVAILABLE';
      nextError.status = 503;
      throw nextError;
    }
    return fallback;
  }
}

function cacheKeyForSign(sign: ZodiacKey, language: Language) {
  return `${sign.toLowerCase()}:${language}:${SIGN_HOROSCOPE_PROMPT_VERSION}`;
}

export async function getCachedSignDailyHoroscope(
  sign: ZodiacKey,
  date: string,
  language: Language
): Promise<ForecastDailyReading | null> {
  const cached = await db.daily_horoscopes.get(cacheKeyForSign(sign, language), date).catch(() => null);
  return parseCached(cached, sign, date, language);
}

export async function getOrGenerateSignDailyHoroscope(
  sign: ZodiacKey,
  date: string,
  language: Language,
  options?: { allowStaticFallback?: boolean; requirePersistence?: boolean }
): Promise<ForecastDailyReading> {
  const cached = await getCachedSignDailyHoroscope(sign, date, language);
  if (cached) return cached;

  const reading = await generateSignReading(sign, date, language, options);
  try {
    await db.daily_horoscopes.set(cacheKeyForSign(sign, language), date, JSON.stringify(reading));
  } catch (error: any) {
    console.error('[horoscope/sign-daily] cache write failed:', error instanceof Error ? error.message : error);
    if (options?.requirePersistence) {
      const nextError = new Error(error?.message || 'Sign horoscope persistence failed') as Error & {
        code?: string;
        status?: number;
      };
      nextError.code = 'SIGN_HOROSCOPE_PERSIST_FAILED';
      nextError.status = 500;
      throw nextError;
    }
  }

  if (options?.requirePersistence) {
    const persisted = await getCachedSignDailyHoroscope(sign, date, language);
    if (!persisted) {
      const error = new Error('Sign horoscope was not persisted') as Error & {
        code?: string;
        status?: number;
      };
      error.code = 'SIGN_HOROSCOPE_PERSIST_FAILED';
      error.status = 500;
      throw error;
    }
    return persisted;
  }

  return reading;
}
