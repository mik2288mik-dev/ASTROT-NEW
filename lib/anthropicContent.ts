import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import type OpenAI from 'openai';

export const DEFAULT_ANTHROPIC_CONTENT_MODEL = 'claude-haiku-5-5';

export function anthropicContentModel(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.ANTHROPIC_CONTENT_MODEL || '').trim() || DEFAULT_ANTHROPIC_CONTENT_MODEL;
}

export const DEFAULT_ANTHROPIC_RELAY_URL = 'https://astrot-production.up.railway.app/api/internal/anthropic';

let client: Anthropic | null = null;

/** Railway (OPENAI_RELAY_DIRECT=1) reaches Anthropic itself; the Russian host goes through Railway. */
export function anthropicViaRelay(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENAI_RELAY_DIRECT !== '1';
}

export function anthropicRelayAuthToken(apiKey: string): string {
  return createHash('sha256').update(`nebo-anthropic-relay-v1:${apiKey}`).digest('hex');
}

/**
 * Claude serves all Luna content (personal forecasts, natal readings,
 * compatibility, stories). The Zodiac sign horoscope stays on DeepSeek.
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!client) {
    client = anthropicViaRelay()
      ? new Anthropic({
        apiKey: null,
        authToken: anthropicRelayAuthToken(apiKey),
        baseURL: String(process.env.ANTHROPIC_RELAY_URL || DEFAULT_ANTHROPIC_RELAY_URL).trim(),
      })
      : new Anthropic({ apiKey });
  }
  return client;
}

type ResponseFormat = { type?: string; schema?: Record<string, unknown> } | undefined;

function responseFormat(params: OpenAI.Responses.ResponseCreateParamsNonStreaming): ResponseFormat {
  return (params.text as { format?: ResponseFormat } | undefined)?.format;
}

/**
 * Maps the Responses-shaped Luna request onto the Messages API. A JSON Schema
 * goes to structured outputs; `schemaInPrompt` is the fallback for a schema the
 * structured-output validator does not accept.
 */
export function buildAnthropicContentParams(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  options: { schemaInPrompt?: boolean } = {},
): Anthropic.MessageCreateParamsNonStreaming {
  const format = responseFormat(params);
  const strictSchema = format?.type === 'json_schema' && format.schema && !options.schemaInPrompt ? format.schema : null;
  const jsonRule = format?.type === 'json_schema' && !strictSchema
    ? `\n\nOutput format: json. Return only one JSON object that matches this JSON Schema exactly, with every required key and no other keys:\n${JSON.stringify(format.schema)}`
    : format?.type === 'json_object' ? '\n\nOutput format: json. Return only one JSON object, without code fences.' : '';
  return {
    model: anthropicContentModel(),
    max_tokens: params.max_output_tokens ?? 1800,
    system: [{
      type: 'text',
      text: `${String(params.instructions || '')}${jsonRule}`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: typeof params.input === 'string' ? params.input : JSON.stringify(params.input),
    }],
    // Output budgets were sized for answers without reasoning, as on DeepSeek.
    thinking: { type: 'disabled' },
    ...(strictSchema ? { output_config: { format: { type: 'json_schema', schema: strictSchema } } } : {}),
  };
}

function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : text;
}

/** Reshapes a Claude message into the Responses fields that readLunaResponseContent reads. */
export function toLunaResponseFromAnthropic(message: Anthropic.Message): OpenAI.Responses.Response {
  const text = stripCodeFence(message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join(''));
  const refused = message.stop_reason === 'refusal';
  const reason = message.stop_reason === 'max_tokens' ? 'max_output_tokens' : null;
  return {
    id: message.id,
    model: message.model,
    status: reason ? 'incomplete' : 'completed',
    incomplete_details: reason ? { reason } : null,
    output: [{
      type: 'message', id: message.id, role: 'assistant', status: 'completed',
      content: refused
        ? [{ type: 'refusal', refusal: message.stop_details?.explanation || 'refusal' }]
        : [{ type: 'output_text', text, annotations: [] }],
    }],
    output_text: refused ? '' : text,
    usage: {
      input_tokens: (message.usage.input_tokens || 0)
        + (message.usage.cache_read_input_tokens || 0)
        + (message.usage.cache_creation_input_tokens || 0),
      input_tokens_details: { cached_tokens: message.usage.cache_read_input_tokens || 0 },
      output_tokens: message.usage.output_tokens || 0,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0),
    },
  } as unknown as OpenAI.Responses.Response;
}

export async function createAnthropicLunaResponse(
  anthropic: Anthropic,
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  options?: { signal?: AbortSignal; maxRetries?: number },
): Promise<OpenAI.Responses.Response> {
  try {
    return toLunaResponseFromAnthropic(await anthropic.messages.create(buildAnthropicContentParams(params), options));
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError) || responseFormat(params)?.type !== 'json_schema') throw error;
    // The schema used a keyword that structured outputs reject: describe it in the prompt instead.
    return toLunaResponseFromAnthropic(
      await anthropic.messages.create(buildAnthropicContentParams(params, { schemaInPrompt: true }), options),
    );
  }
}
