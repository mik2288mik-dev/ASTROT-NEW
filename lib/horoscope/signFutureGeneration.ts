import { getPool } from '../db';
import { getMoscowTodayKey } from '../date-utils';
import { getDeepSeekClient } from '../deepseekClient';
import { buildDeepSeekChatParams } from '../deepseekChat';
import { withContentGenerationLock } from '../contentGenerationLock';
import { checkRateLimit } from '../rateLimit';
import { getContentPolicy } from '../contentMatrix';
import { buildSignSkyBatchDigest } from './signSkyDigest';
import { getSignForecastVoice, SIGN_HOROSCOPE_MODEL, parseSignHoroscopeJson, validateSignHoroscopeReading } from './signContract';
import { isSignFutureReading, SIGN_FUTURE_VERSION, SIGN_FUTURE_LABELS, signFutureStops, type SignFutureSelection, type SignFutureReading, type SignFutureGrant } from './signFutureContract';

export class SignFutureError extends Error {
  constructor(public code: string, public status = 503, public freeChoice?: SignFutureGrant) { super(code); }
}
type Input = SignFutureSelection & { userId: string; premium: boolean };
const selectionOf = ({ sign, date, period, endDate, topic, language }: SignFutureSelection): SignFutureSelection => ({ sign, date, period, topic, language, ...(endDate ? { endDate } : {}) });
const periodKey = (input: SignFutureSelection) => input.period === 'month' ? input.date.slice(0, 7) : input.endDate ? `${input.date}:${input.endDate}` : input.date;
const contentType = (input: SignFutureSelection) => input.period === 'month' ? 'sign_monthly_horoscope' : input.period === 'week' ? 'sign_weekly_horoscope' : 'sign_daily_horoscope';
const contentKey = (input: SignFutureSelection) => `zodiac-future:${input.topic}:${input.language}`;

async function cached(input: SignFutureSelection): Promise<SignFutureReading | null> {
  const rows = await getPool().query<{ payload: unknown }>(
    `SELECT payload FROM content_cache WHERE content_type=$1 AND content_key=$2
      AND period_key=$3 AND zodiac_sign=$4 AND prompt_version=$5 LIMIT 1`,
    [contentType(input), contentKey(input), periodKey(input), input.sign, SIGN_FUTURE_VERSION]);
  const raw = rows.rows[0]?.payload;
  return isSignFutureReading(raw) && raw.status === 'ready' && raw.sign === input.sign && raw.topic === input.topic
    && raw.language === input.language && raw.date === input.date && raw.period === input.period && raw.endDate === input.endDate ? raw : null;
}

function skyContext(input: SignFutureSelection) {
  const dates = [input.date];
  if (input.period === 'week' && input.endDate) {
    const start = new Date(`${input.date}T12:00:00Z`).getTime(), end = new Date(`${input.endDate}T12:00:00Z`).getTime();
    dates.push(new Date(start + Math.floor((end - start) / 86400000 / 2) * 86400000).toISOString().slice(0, 10), input.endDate);
  }
  return [...new Set(dates)].map(date => {
    const digest = buildSignSkyBatchDigest(input.period === 'month' ? 'month' : 'day', input.period === 'month' ? date.slice(0, 7) : date);
    return { ...digest, signs: digest.signs.filter(item => item.sign === input.sign) };
  });
}

async function generate(input: Input): Promise<SignFutureReading> {
  const budget = checkRateLimit(input.userId, { name: 'zodiac-future-generate', windowMs: 3600000, maxRequests: 35 });
  if (!budget.allowed) throw new SignFutureError('RATE_LIMITED', 429);
  const recent = await getPool().query<{ payload: unknown }>(
    `SELECT payload FROM content_cache WHERE zodiac_sign=$1 AND content_key LIKE 'zodiac-future:%'
      ORDER BY updated_at DESC LIMIT 12`, [input.sign]);
  const history = recent.rows.flatMap(({ payload }) => isSignFutureReading(payload) && payload.status === 'ready' && payload.language === input.language
    ? [{ topic: payload.topic, text: payload.text }] : []);
  return generateSignFutureText(input, history);
}

/** Production DeepSeek writer; local samples bypass persistence, never entitlement checks in the API. */
export async function generateSignFutureText(input: SignFutureSelection, history: Array<{ topic: string; text: string }> = []): Promise<SignFutureReading> {
  const client = getDeepSeekClient();
  if (!client) throw new SignFutureError('ZODIAC_FUTURE_NOT_CONFIGURED');
  const system = `${getSignForecastVoice(input.language)}
Ты пишешь отдельный короткий прогноз по солнечному знаку на выбранную дату или точный диапазон. Это общий прогноз для всех людей этого знака, не личный натальный разбор. Не используй и не выдумывай дату рождения, профессию, отношения или планы конкретного человека.
Знак, тема и расчёт — скрытый контекст. В тексте не упоминай планеты, аспекты, дома, транзиты и расчёты. Пиши простыми словами на «ты», без коучинга, психологии, мистики, канцелярита, повторяющихся советов и фатализма. События — возможности, не обещания. Никаких медицинских или инвестиционных указаний, гарантированной удачи и утверждений о чужих мыслях.
Верни JSON с двумя полями: headline (короткий понятный заголовок) и text (2–3 связанных предложения, до 90 слов). Не дели ответ на рубрики. Для дня говори только об этом дне; для недели — только о переданном отрезке без расширения границ; для месяца — о целом месяце, не перечисляй каждый день. Текст должен отвечать именно на выбранную тему. Язык ответа: ${input.language === 'ru' ? 'русский' : 'английский'}.`;
  const context = skyContext(input);
  let issues: string[] = [];
  let previousDraft: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.chat.completions.create(buildDeepSeekChatParams(SIGN_HOROSCOPE_MODEL, {
      messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({
        sign: input.sign, date: input.date, endDate: input.endDate, period: input.period,
        topic: SIGN_FUTURE_LABELS[input.topic][input.language === 'ru' ? 0 : 1], skyContext: context, correction: issues,
        recent_answers_do_not_repeat: history, previous_draft_to_repair: previousDraft,
      }) }], maxTokens: 700, jsonMode: true,
    }), { timeout: 40000, maxRetries: 0 });
    previousDraft = parseSignHoroscopeJson(response.choices[0]?.message?.content);
    const valid = validateSignHoroscopeReading(previousDraft, { sign: input.sign, period: input.period, periodKey: periodKey(input) });
    if (valid.ok) {
      const words = (value: string) => value.toLocaleLowerCase().replace(/ё/gu, 'е').match(/[\p{L}\p{N}]+/gu) || [];
      const current = new Set(words(valid.reading.text).filter(word => word.length > 3));
      if (history.some(item => {
        const previous = new Set(words(item.text).filter(word => word.length > 3));
        return current.size >= 5 && [...current].filter(word => previous.has(word)).length / current.size > .7;
      })) { issues = ['Meaning repeats a recent answer. Choose a different supported observation for this topic.']; continue; }
      return { ...selectionOf(input), status: 'ready', headline: valid.reading.headline, text: valid.reading.text };
    }
    issues = 'issues' in valid ? valid.issues : ['Invalid answer'];
  }
  throw new SignFutureError('ZODIAC_FUTURE_COPY_REJECTED');
}

async function sharedAnswer(input: Input): Promise<SignFutureReading> {
  const result = await withContentGenerationLock({
    lockKey: `${SIGN_FUTURE_VERSION}:${input.sign}:${periodKey(input)}:${contentKey(input)}`, operation: 'zodiac-future',
    readCached: async () => { const value = await cached(input); return value ? { value } : null; },
    generate: async () => {
      const value = await generate(input);
      const end = input.period === 'month' ? new Date(Date.UTC(Number(input.date.slice(0, 4)), Number(input.date.slice(5, 7)), 1)) : new Date(`${input.endDate || input.date}T23:59:59+03:00`);
      await getPool().query(`INSERT INTO content_cache
        (content_type,content_key,period_key,zodiac_sign,user_id,chart_id,access_level,model_tier,model_used,prompt_version,payload,text,expires_at)
        VALUES ($1,$2,$3,$4,NULL,NULL,'pro',$10,$5,$6,$7::jsonb,$8,$9)
        ON CONFLICT (content_type,content_key,period_key,(COALESCE(zodiac_sign,'')),(COALESCE(user_id,0)),(COALESCE(chart_id,0)),prompt_version)
        DO UPDATE SET payload=EXCLUDED.payload,text=EXCLUDED.text,model_used=EXCLUDED.model_used,expires_at=EXCLUDED.expires_at,updated_at=NOW()`,
      [contentType(input), contentKey(input), periodKey(input), input.sign, SIGN_HOROSCOPE_MODEL, SIGN_FUTURE_VERSION, JSON.stringify(value), `${value.headline}\n\n${value.text}`, end.toISOString(), getContentPolicy('sign_daily_horoscope').modelTier]);
      return value;
    },
  });
  return result.status === 'ready' ? result.value : { ...selectionOf(input), status: 'generating', headline: '', text: '' };
}

export async function ensureSignFuture(input: Input): Promise<SignFutureReading> {
  if (!input.premium) throw new SignFutureError('PREMIUM_REQUIRED', 403);
  const stops = signFutureStops(getMoscowTodayKey());
  if (!stops.some(stop => stop.date === input.date && stop.period === input.period && stop.endDate === input.endDate)) throw new SignFutureError('DATE_OUTSIDE_HORIZON', 400);
  return sharedAnswer(input);
}
