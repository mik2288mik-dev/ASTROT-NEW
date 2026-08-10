import type OpenAI from 'openai';

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * The legacy Chat Completions transport is deliberately reserved for Zodiac's
 * DeepSeek API compatibility route. All OpenAI content uses Responses API.
 */
export function buildDeepSeekChatParams(
  model: string,
  opts: {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  },
): CreateParams {
  const params: CreateParams = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1800,
    temperature: opts.temperature ?? 1.1,
  };
  if (opts.jsonMode) params.response_format = { type: 'json_object' };
  (params as unknown as Record<string, unknown>).thinking = { type: 'disabled' };
  return params;
}
