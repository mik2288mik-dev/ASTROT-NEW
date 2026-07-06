/**
 * Thin OpenAI wrapper for the natal-reading screen.
 *
 * (Filename kept for stability with existing imports — under the hood it talks
 *  to OpenAI, the project's primary LLM provider.)
 *
 * The model is resolved per-call via getOpenAIModelForContent so admins can
 * override it from app_settings / env without touching code.
 */

import OpenAI from 'openai';
import type {
  ContentAccessTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import { getOpenAIModelForContent } from './appSettings';
import { buildOpenAIChatParams } from './openaiChat';

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

export type ReadingModelOptions = {
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
};

export type ReadingCallOptions = {
  system: string;
  user: string;
  model: ReadingModelOptions;
  /** kept for compatibility — OpenAI prompt caching is automatic for prompts >1024 tokens */
  cacheSystem?: boolean;
  maxTokens?: number;
  temperature?: number;
  /**
   * Explicit model id that bypasses per-content resolution (getOpenAIModelForContent).
   * Used by the daily-canvas generator, which has its own env-overridable model slot
   * (getDailyCanvasModel) independent of the shared interpretation tiers.
   */
  modelOverride?: string;
};

function readingMessages(opts: ReadingCallOptions) {
  return [
    { role: 'system' as const, content: opts.system },
    { role: 'user' as const, content: opts.user },
  ];
}

export async function llmJson<T = any>(opts: ReadingCallOptions): Promise<T> {
  const client = getClient();
  const model = opts.modelOverride || (await getOpenAIModelForContent(opts.model)).model;

  const completion = await client.chat.completions.create(
    buildOpenAIChatParams(model, {
      messages: readingMessages(opts),
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      jsonMode: true,
    })
  );

  const text = completion.choices[0]?.message?.content || '{}';
  return parseModelJson<T>(text);
}

export async function llmTagged(opts: ReadingCallOptions): Promise<string> {
  const client = getClient();
  const { model } = await getOpenAIModelForContent(opts.model);

  const completion = await client.chat.completions.create(
    buildOpenAIChatParams(model, {
      messages: readingMessages(opts),
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      jsonMode: false,
    })
  );

  return (completion.choices[0]?.message?.content || '').trim();
}

function parseModelJson<T>(raw: string): T {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  }
  const first = text.search(/[{[]/);
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    text = text.slice(first, last + 1);
  }
  return JSON.parse(text) as T;
}

/* Legacy aliases — keep import sites stable. */
export const claudeJson = llmJson;
export const claudeTagged = llmTagged;
export const CLAUDE_MODEL = 'openai-resolved-per-call';

export type {
  ReadingModelOptions as ClaudeModelOptions,
  ReadingCallOptions as ClaudeJsonOptions,
};
