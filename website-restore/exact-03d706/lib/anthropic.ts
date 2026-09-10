/**
 * Thin OpenAI wrapper for the natal-reading screen.
 *
 * (Filename kept for stability with existing imports — under the hood it talks
 *  to OpenAI, the project's primary LLM provider.)
 *
 * All calls use the fixed OpenAI Luna model through the Responses API.
 */

import type {
  ContentAccessTier,
  ContentSurface,
  ContentVariant,
} from '../types';
import {
  createLunaJsonResponse,
  createLunaTextResponse,
  OPENAI_LUNA_MODEL,
} from './openaiResponses';

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
  onMetrics?: (metrics: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  }) => void;
};

export async function llmJson<T = any>(opts: ReadingCallOptions): Promise<T> {
  const model = OPENAI_LUNA_MODEL;
  const startedAt = Date.now();
  const response = await createLunaJsonResponse({
    instructions: opts.system,
    input: opts.user,
    maxOutputTokens: opts.maxTokens ?? 1800,
  });
  opts.onMetrics?.({
    model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: Date.now() - startedAt,
  });
  return parseModelJson<T>(response.content);
}

export async function llmTagged(opts: ReadingCallOptions): Promise<string> {
  const model = OPENAI_LUNA_MODEL;
  const startedAt = Date.now();
  const response = await createLunaTextResponse({
    instructions: opts.system,
    input: opts.user,
    maxOutputTokens: opts.maxTokens ?? 1800,
  });
  opts.onMetrics?.({
    model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: Date.now() - startedAt,
  });
  return response.content;
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
export const CLAUDE_MODEL = OPENAI_LUNA_MODEL;

export type {
  ReadingModelOptions as ClaudeModelOptions,
  ReadingCallOptions as ClaudeJsonOptions,
};
