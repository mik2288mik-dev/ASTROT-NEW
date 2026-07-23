import OpenAI from 'openai';
import type { ForecastDailyReading, Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { getModelForTier } from '../appSettings';
import { buildContentCacheKey, getContentPolicy } from '../contentMatrix';
import { buildSignYearlyHoroscopePrompt, parseModelJson } from '../contentPromptBuilders';
import { yearKeyToValidRangeUtc } from '../date-utils';
import { getPool } from '../db';
import { buildOpenAIChatParams } from '../openaiChat';
import { normalizeZodiacKey, type ZodiacKey } from './signDaily';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_yearly');

const YEARLY_CONTEXT: Record<Language, string> = {
  ru: 'Это общий разбор для твоего знака. Личная картина начинается с натальной карты.',
  en: 'This is a general reading for your sign. Your personal picture starts with your natal chart.',
};

export function buildSignYearlyCacheKey(sign: string, periodKey: string, language: Language): string {
  return buildContentCacheKey('sign_yearly', {
    zodiacSign: sign,
    periodKey,
    contentKey: language,
  });
}

function fallback(sign: ZodiacKey, periodKey: string, language: Language): ForecastDailyReading {
  const label = getZodiacSign(language, sign);
  return language === 'en'
    ? {
        date: periodKey,
        headline: `${label}: choose before you commit`,
        summary: 'This year makes it useful to notice which decisions are truly yours and which merely arrived with confidence attached.',
        reading: 'The useful thread is discernment. A convincing offer, plan, or opinion can still be a poor fit for you. Pause long enough to check what the choice asks from your time and attention. Small, repeatable decisions will tell you more than a dramatic promise.',
        focus: 'Give important choices enough time to become clear.',
        chance: 'Rely on consistency and direct conversations.',
        risk: 'Do not turn someone else’s urgency into your obligation.',
        context: YEARLY_CONTEXT.en,
        advice: ['Ask what a decision changes in everyday life.', 'Keep one priority visible.', 'Review an agreement before expanding it.'],
      }
    : {
        date: periodKey,
        headline: `${label}: сначала выбрать, потом соглашаться`,
        summary: 'В этом году полезно замечать, какие решения действительно твои, а какие просто поданы слишком уверенно.',
        reading: 'Главная линия — разборчивость. Убедительное предложение, план или мнение всё равно могут тебе не подходить. Остановись и проверь, чего выбор потребует от твоего времени и внимания. Небольшие повторяемые решения расскажут больше, чем громкое обещание.',
        focus: 'Давай важным решениям время стать яснее.',
        chance: 'Опирайся на последовательность и прямые разговоры.',
        risk: 'Не превращай чужую срочность в свою обязанность.',
        context: YEARLY_CONTEXT.ru,
        advice: ['Проверяй, что решение меняет в обычной жизни.', 'Держи один приоритет на виду.', 'Пересматривай договорённость до её расширения.'],
      };
}

function normalize(raw: Partial<ForecastDailyReading>, sign: ZodiacKey, periodKey: string, language: Language): ForecastDailyReading {
  const fb = fallback(sign, periodKey, language);
  const clean = (value: unknown, backup: string) => String(value || '').replace(/\s+/g, ' ').trim() || backup;
  const advice = Array.isArray(raw.advice)
    ? [...new Set(raw.advice.map((item) => clean(item, '')).filter(Boolean))].slice(0, 3)
    : fb.advice;
  return {
    date: periodKey,
    headline: clean(raw.headline, fb.headline),
    summary: clean(raw.summary, fb.summary),
    reading: clean(raw.reading, fb.reading),
    focus: clean(raw.focus, fb.focus),
    chance: clean(raw.chance, fb.chance),
    risk: clean(raw.risk, fb.risk),
    context: YEARLY_CONTEXT[language],
    advice,
  };
}

export async function getCachedSignYearlyHoroscope(
  sign: ZodiacKey,
  periodKey: string,
  language: Language
): Promise<ForecastDailyReading | null> {
  try {
    const result = await getPool().query(
      `SELECT payload FROM content_cache
       WHERE content_type = 'sign_yearly' AND period_key = $1 AND zodiac_sign = $2
         AND content_key = $3 AND prompt_version = $4 AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [periodKey, sign, language, policy.promptVersion]
    );
    const payload = result.rows[0]?.payload;
    return payload ? normalize(payload, sign, periodKey, language) : null;
  } catch {
    return null;
  }
}

async function generate(sign: ZodiacKey, periodKey: string, language: Language): Promise<ForecastDailyReading> {
  const fb = fallback(sign, periodKey, language);
  if (!openai) return fb;
  const prompt = buildSignYearlyHoroscopePrompt({
    language,
    context: { sign: getZodiacSign(language, sign), year: periodKey },
  });
  try {
    const model = await getModelForTier(policy.modelTier);
    const completion = await openai.chat.completions.create(buildOpenAIChatParams(model, {
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      temperature: 0.7,
      maxTokens: 700,
      jsonMode: true,
    }));
    return normalize(
      parseModelJson<Partial<ForecastDailyReading>>(completion.choices[0]?.message?.content, {}),
      sign,
      periodKey,
      language
    );
  } catch {
    return fb;
  }
}

export async function getOrGenerateSignYearlyHoroscope(
  signInput: string,
  periodKey: string,
  language: Language
): Promise<ForecastDailyReading> {
  const sign = normalizeZodiacKey(signInput);
  if (!sign) throw new Error('Invalid zodiac sign');
  const cached = await getCachedSignYearlyHoroscope(sign, periodKey, language);
  if (cached) return cached;
  const reading = await generate(sign, periodKey, language);
  try {
    const { validTo } = yearKeyToValidRangeUtc(periodKey);
    await getPool().query(
      `INSERT INTO content_cache (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
       VALUES ('sign_yearly', $1, $2, $3, 'free', $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        language,
        periodKey,
        sign,
        policy.modelTier,
        await getModelForTier(policy.modelTier),
        policy.promptVersion,
        JSON.stringify(reading),
        reading.reading,
        validTo,
      ]
    );
  } catch {
    // Content remains readable when persistence is temporarily unavailable.
  }
  return reading;
}
