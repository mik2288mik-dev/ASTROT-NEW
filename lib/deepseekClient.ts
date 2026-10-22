import OpenAI from 'openai';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * DeepSeek serves the general Zodiac horoscope product, and all Luna content
 * only while AI_CONTENT_PROVIDER=deepseek is set (see openaiResponses.ts).
 */
export function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  return apiKey
    ? new OpenAI({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL })
    : null;
}
