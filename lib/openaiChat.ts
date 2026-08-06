import type OpenAI from 'openai';
import { isDeepSeekModel } from './contentAiClient';

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * Builds chat-completion params that work for BOTH classic chat models
 * (gpt-4o / gpt-4.1 …) and the GPT-5 / o-series reasoning models.
 *
 * The reasoning models reject `max_tokens` and any non-default `temperature`
 * — they require `max_completion_tokens` and the default temperature. Sending
 * the legacy params makes every request 400, which silently drops generation
 * to canned fallback text. Branching on the resolved model id keeps every
 * content surface (daily, natal, horoscopes, synastry…) actually generating.
 */
export function buildOpenAIChatParams(
  model: string,
  opts: {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  }
): CreateParams {
  const isReasoningModel = /^(gpt-5|o[1-9])/i.test(model);
  const isDeepSeek = isDeepSeekModel(model);
  const params: CreateParams = {
    model,
    messages: opts.messages,
  };
  if (opts.jsonMode) params.response_format = { type: 'json_object' };
  if (isDeepSeek) {
    params.max_tokens = opts.maxTokens ?? 1800;
    params.temperature = 1.1;
    (params as any).thinking = { type: 'disabled' };
  } else if (isReasoningModel) {
    params.max_completion_tokens = opts.maxTokens ?? 1800;
  } else {
    params.max_tokens = opts.maxTokens ?? 1800;
    params.temperature = opts.temperature ?? 0.7;
  }
  return params;
}
