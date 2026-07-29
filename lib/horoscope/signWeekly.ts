import OpenAI from 'openai';
import type { ForecastDailyReading, Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { getModelForTier } from '../appSettings';
import { getContentPolicy } from '../contentMatrix';
import { buildOpenAIChatParams } from '../openaiChat';
import { buildSignWeeklyHoroscopePrompt, parseModelJson } from '../contentPromptBuilders';
import { getPool } from '../db';
import { isoWeekToValidRangeUtc } from '../date-utils';
import { normalizeZodiacKey, type ZodiacKey } from './signDaily';
import { normalizeSignPeriodReading, SignPeriodGenerationError } from './signPeriodShared';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_weekly_horoscope');
const GENERATION_ERROR = 'SIGN_WEEKLY_GENERATION_FAILED' as const;

function normalize(raw: Partial<ForecastDailyReading>, periodKey: string): ForecastDailyReading {
  return normalizeSignPeriodReading(raw, periodKey, GENERATION_ERROR);
}

export async function getCachedSignWeeklyHoroscope(
  sign: ZodiacKey,
  periodKey: string,
  language: Language
): Promise<ForecastDailyReading | null> {
  try {
    const result = await getPool().query(
      `SELECT payload FROM content_cache
       WHERE content_type = 'sign_weekly_horoscope' AND period_key = $1 AND zodiac_sign = $2
         AND content_key = $3 AND prompt_version = $4 AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [periodKey, sign, language, policy.promptVersion]
    );
    const payload = result.rows[0]?.payload;
    return payload ? normalize(payload, periodKey) : null;
  } catch {
    return null;
  }
}

async function generate(sign: ZodiacKey, periodKey: string, language: Language): Promise<ForecastDailyReading> {
  if (!openai) throw new SignPeriodGenerationError(GENERATION_ERROR);
  const prompt = buildSignWeeklyHoroscopePrompt({
    language,
    context: { sign: getZodiacSign(language, sign), periodKey },
  });
  try {
    const model = await getModelForTier(policy.modelTier);
    const completion = await openai.chat.completions.create(buildOpenAIChatParams(model, {
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      temperature: 0.72,
      maxTokens: 700,
      jsonMode: true,
    }));
    const parsed = parseModelJson<Partial<ForecastDailyReading>>(
      completion.choices[0]?.message?.content,
      {}
    );
    return normalize(parsed, periodKey);
  } catch (error) {
    if (error instanceof SignPeriodGenerationError) throw error;
    throw new SignPeriodGenerationError(GENERATION_ERROR, error);
  }
}

export async function getOrGenerateSignWeeklyHoroscope(
  signInput: string,
  periodKey: string,
  language: Language
): Promise<ForecastDailyReading> {
  const sign = normalizeZodiacKey(signInput);
  if (!sign) throw new Error('Invalid zodiac sign');
  const cached = await getCachedSignWeeklyHoroscope(sign, periodKey, language);
  if (cached) return cached;

  const reading = await generate(sign, periodKey, language);
  try {
    const { validTo } = isoWeekToValidRangeUtc(periodKey);
    await getPool().query(
      `INSERT INTO content_cache (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
       VALUES ('sign_weekly_horoscope', $1, $2, $3, 'pro', $4, $5, $6, $7::jsonb, $8, $9)
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
