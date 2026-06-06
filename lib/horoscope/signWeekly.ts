import OpenAI from 'openai';
import type { ForecastDailyReading, Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { getModelForTier } from '../appSettings';
import { getContentPolicy } from '../contentMatrix';
import { buildSignWeeklyHoroscopePrompt, parseLumiaJson } from '../contentPromptBuilders';
import { getPool } from '../db';
import { formatIsoWeekPeriodLabel, isoWeekToValidRangeUtc } from '../date-utils';
import { normalizeZodiacKey, type ZodiacKey } from './signDaily';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_weekly_horoscope');

function fallback(sign: ZodiacKey, periodKey: string, language: Language): ForecastDailyReading {
  const label = getZodiacSign(language, sign);
  const range = formatIsoWeekPeriodLabel(periodKey, language);
  return language === 'en'
    ? { date: periodKey, headline: `${label}: one clear theme for the week`, summary: range, reading: 'This week rewards a calmer pace and one deliberate priority. Notice where outside urgency pulls you away from what matters, then return to the conversation or task that can genuinely move forward. The main story is about choosing what deserves your attention before other people choose it for you. A clear boundary early in the week will make later decisions easier. Leave space to revise a plan instead of treating the first version as final. By the weekend, the useful result will come from consistency rather than a dramatic push.', focus: 'Choose one priority and protect time for it.', chance: '', risk: '', context: '', advice: ['Clarify expectations before agreeing.', 'Leave room to adjust the plan.'] }
    : { date: periodKey, headline: `${label}: один ясный сюжет недели`, summary: range, reading: 'На этой неделе полезнее выбрать один главный сюжет и не распыляться на чужую срочность. Заметь, где хочется ускориться только из-за давления, и вернись к разговору или делу, которое действительно можно сдвинуть. Главная тема недели — заранее решить, чему ты готов уделять внимание, а что может подождать. Один ясный разговор в начале недели упростит дальнейшие решения. Оставь место для корректировки плана и не считай первую версию окончательной. К выходным результат даст последовательность, а не резкий рывок.', focus: 'Выбери один приоритет и защити для него время.', chance: '', risk: '', context: '', advice: ['Уточняй ожидания до того, как соглашаться.', 'Оставь в плане место для корректировки.'] };
}

function normalize(raw: Partial<ForecastDailyReading>, sign: ZodiacKey, periodKey: string, language: Language): ForecastDailyReading {
  const fb = fallback(sign, periodKey, language);
  const clean = (value: unknown, backup: string) => String(value || '').replace(/\s+/g, ' ').trim() || backup;
  return {
    date: periodKey,
    headline: clean(raw.headline, fb.headline),
    summary: clean(raw.summary, fb.summary),
    reading: clean(raw.reading, fb.reading),
    focus: clean(raw.focus, fb.focus || ''),
    chance: clean(raw.chance, fb.chance || ''),
    risk: clean(raw.risk, fb.risk || ''),
    context: clean(raw.context, fb.context || ''),
    advice: Array.isArray(raw.advice) ? raw.advice.map((item) => clean(item, '')).filter(Boolean).slice(0, 2) : fb.advice,
  };
}

export async function getCachedSignWeeklyHoroscope(sign: ZodiacKey, periodKey: string, language: Language): Promise<ForecastDailyReading | null> {
  try {
    const result = await getPool().query(
      `SELECT payload FROM content_cache
       WHERE content_type = 'sign_weekly_horoscope' AND period_key = $1 AND zodiac_sign = $2
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
  const signLabel = getZodiacSign(language, sign);
  const prompt = buildSignWeeklyHoroscopePrompt({ language, context: { sign: signLabel, periodKey } });
  try {
    const model = await getModelForTier(policy.modelTier);
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 700,
    });
    const parsed = parseLumiaJson<{ headline?: string; text?: string; advice?: string[] }>(completion.choices[0]?.message?.content, {});
    return normalize({ ...parsed, summary: parsed.text, reading: parsed.text, focus: parsed.advice?.[0] }, sign, periodKey, language);
  } catch {
    return fb;
  }
}

export async function getOrGenerateSignWeeklyHoroscope(signInput: string, periodKey: string, language: Language): Promise<ForecastDailyReading> {
  const sign = normalizeZodiacKey(signInput);
  if (!sign) throw new Error('Invalid zodiac sign');
  const cached = await getCachedSignWeeklyHoroscope(sign, periodKey, language);
  if (cached) return cached;
  const reading = await generate(sign, periodKey, language);
  try {
    const { validTo } = isoWeekToValidRangeUtc(periodKey);
    await getPool().query(
      `INSERT INTO content_cache (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
       VALUES ('sign_weekly_horoscope', $1, $2, $3, 'free', $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT DO NOTHING`,
      [language, periodKey, sign, policy.modelTier, await getModelForTier(policy.modelTier), policy.promptVersion, JSON.stringify(reading), reading.reading || '', validTo]
    );
  } catch {
    // Content remains readable when persistence is temporarily unavailable.
  }
  return reading;
}
