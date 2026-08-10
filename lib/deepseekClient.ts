import OpenAI from 'openai';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/** DeepSeek is intentionally isolated to the general Zodiac horoscope product. */
export function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  return apiKey
    ? new OpenAI({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL })
    : null;
}
