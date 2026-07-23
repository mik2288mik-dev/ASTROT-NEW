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
import { normalizeSignPeriodReading, SignPeriodGenerationError } from './signPeriodShared';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_yearly');
const GENERATION_ERROR = 'SIGN_YEARLY_GENERATION_FAILED' as const;

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

function normalize(
  raw: Partial<ForecastDailyReading>,
  periodKey: string,
  language: Language
): ForecastDailyReading {
  return normalizeSignPeriodReading(raw, periodKey, GENERATION_ERROR, {
    context: YEARLY_CONTEXT[language],
  });
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
    return payload ? normalize(payload, periodKey, language) : null;
  } catch {
    return null;
  }
}

async function generate(sign: ZodiacKey, periodKey: string, language: Language): Promise<ForecastDailyReading> {
  if (!openai) throw new SignPeriodGenerationError(GENERATION_ERROR);
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
    const parsed = parseModelJson<Partial<ForecastDailyReading>>(
      completion.choices[0]?.message?.content,
      {}
    );
    return normalize(parsed, periodKey, language);
  } catch (error) {
    if (error instanceof SignPeriodGenerationError) throw error;
    throw new SignPeriodGenerationError(GENERATION_ERROR, error);
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
    // A valid model result remains usable when persistence is temporarily unavailable.
  }
  return reading;
}
