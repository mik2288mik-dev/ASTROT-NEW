import OpenAI from 'openai';
import type { ForecastDailyReading, Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { getModelForTier } from '../appSettings';
import { getContentPolicy } from '../contentMatrix';
import { buildSignMonthlyHoroscopePrompt, parseLumiaJson } from '../contentPromptBuilders';
import { getPool } from '../db';
import { formatMonthPeriodLabel } from '../date-utils';
import { normalizeZodiacKey, type ZodiacKey } from './signDaily';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_monthly_horoscope');

/** Конец месяца (UTC) для срока жизни кэша — первый день следующего месяца. */
function monthEndUtc(periodKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  const now = new Date();
  if (!m) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 1, 0, 0, 0)).toISOString();
}

function fallback(sign: ZodiacKey, periodKey: string, language: Language): ForecastDailyReading {
  const label = getZodiacSign(language, sign);
  const range = formatMonthPeriodLabel(periodKey, language);
  return language === 'en'
    ? { date: periodKey, headline: `${label}: one theme for the month`, summary: range, reading: 'This month rewards choosing one main story and carrying it steadily instead of grabbing everything at once. Notice where you say yes out of pressure or habit — that is where fatigue builds. The month suits putting one important thing in order and bringing it to a clear result, rather than starting five new ones. Around the middle it gets clearer what is truly yours and what you can let go of without loss. Do not judge the whole month by its first week: the rhythm will shift. The real result comes from consistency and honesty with yourself, not sharp turns.', focus: 'Pick one main direction for the month and hold it.', chance: '', risk: '', context: '', advice: ['Put one thing in order instead of starting five.', 'Check in with yourself before taking on more.'] }
    : { date: periodKey, headline: `${label}: главный сюжет месяца`, summary: range, reading: 'В этом месяце полезнее выбрать один главный сюжет и вести его спокойно, а не хвататься за всё сразу. Обрати внимание, где ты соглашаешься из-за давления или привычки — именно там копится усталость. Месяц хорошо подходит, чтобы навести порядок в одном важном деле и довести его до понятного результата, а не начинать пять новых. Ближе к середине станет яснее, что действительно твоё, а что можно отпустить без потерь. Не оценивай весь месяц по первой неделе: ритм будет меняться. Итог дадут последовательность и честность с собой, а не резкие развороты.', focus: 'Выбери одно главное направление месяца и держи его.', chance: '', risk: '', context: '', advice: ['Наводи порядок в одном деле, не начинай пять новых.', 'Сверяйся с собой, прежде чем брать новое.'] };
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

export async function getCachedSignMonthlyHoroscope(sign: ZodiacKey, periodKey: string, language: Language): Promise<ForecastDailyReading | null> {
  try {
    const result = await getPool().query(
      `SELECT payload FROM content_cache
       WHERE content_type = 'sign_monthly_horoscope' AND period_key = $1 AND zodiac_sign = $2
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
  const prompt = buildSignMonthlyHoroscopePrompt({ language, context: { sign: signLabel, periodKey } });
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

export async function getOrGenerateSignMonthlyHoroscope(signInput: string, periodKey: string, language: Language): Promise<ForecastDailyReading> {
  const sign = normalizeZodiacKey(signInput);
  if (!sign) throw new Error('Invalid zodiac sign');
  const cached = await getCachedSignMonthlyHoroscope(sign, periodKey, language);
  if (cached) return cached;
  const reading = await generate(sign, periodKey, language);
  try {
    await getPool().query(
      `INSERT INTO content_cache (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
       VALUES ('sign_monthly_horoscope', $1, $2, $3, 'free', $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT DO NOTHING`,
      [language, periodKey, sign, policy.modelTier, await getModelForTier(policy.modelTier), policy.promptVersion, JSON.stringify(reading), reading.reading || '', monthEndUtc(periodKey)]
    );
  } catch {
    // Content remains readable when persistence is temporarily unavailable.
  }
  return reading;
}
