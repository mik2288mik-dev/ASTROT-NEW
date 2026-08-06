import OpenAI from 'openai';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export function isDeepSeekModel(model: string): boolean {
  return /^deepseek-/i.test(model);
}

export function getContentAiClient(model: string): OpenAI | null {
  if (isDeepSeekModel(model)) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    return apiKey
      ? new OpenAI({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL })
      : null;
  }
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}
