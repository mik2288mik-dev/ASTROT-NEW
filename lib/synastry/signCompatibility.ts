import OpenAI from 'openai';
import type { Language } from '../../types';
import { getZodiacSign } from '../../constants';
import { getModelForTier } from '../appSettings';
import { buildContentCacheKey, getContentPolicy } from '../contentMatrix';
import { buildSignCompatibilityPrompt, parseLumiaJson } from '../contentPromptBuilders';
import { getPool } from '../db';
import { normalizeZodiacKey, type ZodiacKey } from '../horoscope/signDaily';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const policy = getContentPolicy('sign_compatibility');

export type SignCompatibilityResult = { signA: ZodiacKey; signB: ZodiacKey; attraction: string; difficulty: string; communication: string; limitation: string };

export function normalizeSignPair(first: string, second: string): [ZodiacKey, ZodiacKey] | null {
  const a = normalizeZodiacKey(first); const b = normalizeZodiacKey(second);
  if (!a || !b) return null;
  return [a, b].sort() as [ZodiacKey, ZodiacKey];
}

export function buildSignCompatibilityCacheKey(first: string, second: string, language: Language): string | null {
  const pair = normalizeSignPair(first, second);
  return pair ? buildContentCacheKey('sign_compatibility', { contentKey: `${pair[0]}:${pair[1]}:${language}` }) : null;
}

function fallback(a: ZodiacKey, b: ZodiacKey, language: Language): SignCompatibilityResult {
  const first = getZodiacSign(language, a); const second = getZodiacSign(language, b);
  return language === 'en' ? { signA: a, signB: b, attraction: `${first} and ${second} can be drawn to the contrast between their ways of acting. One often brings momentum while the other notices what the connection needs to feel steadier. Curiosity stays alive when neither person tries to make the other react in exactly the same way.`, difficulty: `The difficult point is usually pace and expectations. A quick reaction may look careless to one person, while a pause may look like distance to the other. The bond becomes tense when both start guessing instead of checking what was actually meant.`, communication: `Name the important part directly and leave room for a different response speed. Ask one clear question before drawing a conclusion. This pairing works better when warmth and boundaries are both spoken aloud.`, limitation: 'This is a general reading based only on two zodiac signs. Birth time, place, Moon, Venus and the full charts may change the picture.' } : { signA: a, signB: b, attraction: `${first} и ${second} могут тянуться к разнице в том, как каждый действует и показывает интерес. Один чаще добавляет движению скорость, другой помогает заметить, что нужно связи для устойчивости. Интерес сохраняется, когда никто не требует одинаковых реакций.`, difficulty: `Сложное место обычно связано с темпом и ожиданиями. Быстрый ответ может показаться невнимательным, а пауза — холодностью. Напряжение растёт, когда оба начинают додумывать мотивы вместо того, чтобы уточнить, что человек действительно имел в виду.`, communication: `Говорите прямо о главном и оставляйте друг другу право отвечать в разном темпе. До вывода задай один ясный вопрос. Этой паре легче, когда и тепло, и границы произносятся словами, а не проверяются догадками.`, limitation: 'Это общий разбор только по двум знакам. Время и место рождения, Луна, Венера и полные карты могут заметно изменить картину.' };
}

export async function getCachedSignCompatibility(first: string, second: string, language: Language): Promise<SignCompatibilityResult | null> {
  const cacheKey = buildSignCompatibilityCacheKey(first, second, language); if (!cacheKey) return null;
  const result = await getPool().query(`SELECT payload FROM content_cache WHERE content_type = 'sign_compatibility' AND content_key = $1 AND prompt_version = $2 LIMIT 1`, [cacheKey, policy.promptVersion]);
  return (result.rows[0]?.payload as SignCompatibilityResult | undefined) || null;
}

export async function getOrGenerateSignCompatibility(first: string, second: string, language: Language): Promise<SignCompatibilityResult> {
  const pair = normalizeSignPair(first, second); const cacheKey = buildSignCompatibilityCacheKey(first, second, language);
  if (!pair || !cacheKey) throw new Error('Invalid zodiac sign pair');
  const cached = await getCachedSignCompatibility(pair[0], pair[1], language); if (cached) return cached;
  let payload = fallback(pair[0], pair[1], language); const model = await getModelForTier(policy.modelTier);
  if (openai) {
    const prompt = buildSignCompatibilityPrompt({ language, context: { signA: getZodiacSign(language, pair[0]), signB: getZodiacSign(language, pair[1]) } });
    const completion = await openai.chat.completions.create({ model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], response_format: { type: 'json_object' }, temperature: 0.6, max_tokens: 700 });
    const raw = parseLumiaJson<Partial<SignCompatibilityResult>>(completion.choices[0]?.message?.content, payload);
    payload = { signA: pair[0], signB: pair[1], attraction: String(raw.attraction || payload.attraction).trim(), difficulty: String(raw.difficulty || payload.difficulty).trim(), communication: String(raw.communication || payload.communication).trim(), limitation: payload.limitation };
  }
  await getPool().query(`INSERT INTO content_cache (content_type, content_key, access_level, model_tier, model_used, prompt_version, payload, text) VALUES ('sign_compatibility', $1, 'free', $2, $3, $4, $5::jsonb, $6) ON CONFLICT DO NOTHING`, [cacheKey, policy.modelTier, model, policy.promptVersion, JSON.stringify(payload), `${payload.attraction}\n${payload.difficulty}\n${payload.communication}`]);
  return (await getCachedSignCompatibility(pair[0], pair[1], language)) || payload;
}
