import { createHash } from 'crypto';
import OpenAI from 'openai';
import { OPENAI_LUNA_MODEL } from './openai-models';
import { recordAiCall } from './aiLogger';
import { buildDeepSeekChatParams } from './deepseekChat';
import { getDeepSeekClient } from './deepseekClient';
import { anthropicContentModel, createAnthropicLunaResponse, getAnthropicClient } from './anthropicContent';

export { OPENAI_LUNA_MODEL } from './openai-models';

export type StrictJsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

type LunaResponseInput = {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  store?: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  verbosity?: 'low' | 'medium' | 'high';
};

type LunaStructuredResponseInput = LunaResponseInput & {
  schemaName: string;
  schema: StrictJsonSchema;
  /** Forecast-only opt-in: the caller must validate any incomplete output. */
  allowIncompleteOutput?: boolean;
};

type LunaResponseResult = {
  content: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  incompleteReason?: string;
};

type LunaStructuredRequester = (
  input: LunaStructuredResponseInput,
) => Promise<LunaResponseResult>;

type LunaResponseContent = Pick<
  OpenAI.Responses.Response,
  'status' | 'incomplete_details' | 'output' | 'output_text'
>;

const DEFAULT_OPENAI_RELAY_URL =
  'https://astrot-production.up.railway.app/api/internal/openai-responses';

function useDirectOpenAI(): boolean {
  return process.env.OPENAI_RELAY_DIRECT === '1';
}

function getOpenAIRelayAuthToken(): string {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return createHash('sha256')
    .update(`nebo-openai-relay-v1:${apiKey}`)
    .digest('hex');
}

async function createResponseViaRelay(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): Promise<OpenAI.Responses.Response> {
  const relayUrl = String(
    process.env.OPENAI_RELAY_URL || DEFAULT_OPENAI_RELAY_URL,
  ).trim();

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getOpenAIRelayAuthToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(120_000),
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = '';
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string };
      detail = typeof parsed.error === 'string'
        ? parsed.error
        : String(parsed.error?.message || '');
    } catch {
      detail = '';
    }
    throw new Error(
      `OPENAI_RELAY_HTTP_${response.status}${detail ? `:${detail.slice(0, 240)}` : ''}`,
    );
  }

  try {
    return JSON.parse(text) as OpenAI.Responses.Response;
  } catch {
    throw new Error('OPENAI_RELAY_INVALID_RESPONSE');
  }
}

export function buildLunaStructuredResponseParams(input: LunaStructuredResponseInput) {
  return {
    model: OPENAI_LUNA_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
    ...(input.store === undefined ? {} : { store: input.store }),
    ...(input.reasoningEffort === undefined ? {} : { reasoning: { effort: input.reasoningEffort } as never }),
    text: {
      ...(input.verbosity === undefined ? {} : { verbosity: input.verbosity }),
      format: {
        type: 'json_schema' as const,
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
  } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming;
}

export function buildLunaJsonResponseParams(input: LunaResponseInput) {
  return {
    model: OPENAI_LUNA_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
    ...(input.store === undefined ? {} : { store: input.store }),
    ...(input.reasoningEffort === undefined ? {} : { reasoning: { effort: input.reasoningEffort } as never }),
    text: { ...(input.verbosity === undefined ? {} : { verbosity: input.verbosity }), format: { type: 'json_object' as const } },
  } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming;
}

export function buildLunaTextResponseParams(input: LunaResponseInput) {
  return {
    model: OPENAI_LUNA_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
    ...(input.store === undefined ? {} : { store: input.store }),
    ...(input.reasoningEffort === undefined ? {} : { reasoning: { effort: input.reasoningEffort } as never }),
    ...(input.verbosity === undefined ? { } : { text: { verbosity: input.verbosity } }),
  } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming;
}

/** The part of the OpenAI client that Luna content uses. */
export type LunaResponsesClient = {
  responses: {
    create(
      params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
      options?: { signal?: AbortSignal; maxRetries?: number },
    ): Promise<OpenAI.Responses.Response>;
  };
};

export const DEFAULT_DEEPSEEK_CONTENT_MODEL = 'deepseek-flash';

export type LunaContentProviderName = 'anthropic' | 'deepseek' | 'openai';

/**
 * All Luna content goes to Claude once ANTHROPIC_API_KEY is set, and to DeepSeek
 * until then. AI_CONTENT_PROVIDER=anthropic|deepseek|openai pins one route.
 */
export function lunaContentProviderName(env: NodeJS.ProcessEnv = process.env): LunaContentProviderName {
  const pinned = String(env.AI_CONTENT_PROVIDER || '').trim().toLowerCase();
  if (pinned === 'anthropic' || pinned === 'deepseek' || pinned === 'openai') return pinned;
  return String(env.ANTHROPIC_API_KEY || '').trim() ? 'anthropic' : 'deepseek';
}

export function deepSeekContentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return lunaContentProviderName(env) === 'deepseek';
}

function deepSeekContentModel(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.DEEPSEEK_CONTENT_MODEL || '').trim() || DEFAULT_DEEPSEEK_CONTENT_MODEL;
}

/** The provider, model and key that Luna content currently runs on. */
export function getLunaContentProvider(env: NodeJS.ProcessEnv = process.env): {
  provider: LunaContentProviderName;
  model: string;
  keyName: 'ANTHROPIC_API_KEY' | 'DEEPSEEK_API_KEY' | 'OPENAI_API_KEY';
  keyPresent: boolean;
} {
  const provider = lunaContentProviderName(env);
  const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY';
  return {
    provider,
    model: provider === 'anthropic' ? anthropicContentModel(env) : provider === 'deepseek' ? deepSeekContentModel(env) : OPENAI_LUNA_MODEL,
    keyName,
    keyPresent: Boolean(String(env[keyName] || '').trim()),
  };
}

/** DeepSeek has no strict JSON Schema output, so the schema goes into the system prompt. */
export function buildDeepSeekContentParams(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const format = (params.text as { format?: { type?: string; schema?: unknown } } | undefined)?.format;
  const jsonRule = format?.type === 'json_schema'
    ? `\n\nOutput format: json. Return only one JSON object that matches this JSON Schema exactly, with every required key and no other keys:\n${JSON.stringify(format.schema)}`
    : format?.type === 'json_object' ? '\n\nOutput format: json. Return only one JSON object.' : '';
  return buildDeepSeekChatParams(deepSeekContentModel(), {
    messages: [
      { role: 'system', content: `${String(params.instructions || '')}${jsonRule}` },
      { role: 'user', content: typeof params.input === 'string' ? params.input : JSON.stringify(params.input) },
    ],
    maxTokens: params.max_output_tokens ?? undefined,
    temperature: 1,
    jsonMode: Boolean(jsonRule),
  });
}

/** Reshapes a Chat Completion into the Responses fields that readLunaResponseContent reads. */
export function toLunaResponse(completion: OpenAI.Chat.Completions.ChatCompletion): OpenAI.Responses.Response {
  const choice = completion.choices[0];
  const text = choice?.message?.content || '';
  const reason = choice?.finish_reason === 'length' ? 'max_output_tokens'
    : choice?.finish_reason === 'content_filter' ? 'content_filter' : null;
  const usage = completion.usage as (OpenAI.CompletionUsage & { prompt_cache_hit_tokens?: number }) | undefined;
  return {
    id: completion.id,
    model: completion.model,
    status: reason ? 'incomplete' : 'completed',
    incomplete_details: reason ? { reason } : null,
    output: [{
      type: 'message', id: completion.id, role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }],
    }],
    output_text: text,
    usage: {
      input_tokens: usage?.prompt_tokens || 0,
      input_tokens_details: { cached_tokens: usage?.prompt_cache_hit_tokens || 0 },
      output_tokens: usage?.completion_tokens || 0,
      output_tokens_details: { reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens || 0 },
      total_tokens: usage?.total_tokens || 0,
    },
  } as unknown as OpenAI.Responses.Response;
}

function getDeepSeekResponsesClient(): LunaResponsesClient | null {
  const deepseek = getDeepSeekClient();
  if (!deepseek) return null;
  return {
    responses: {
      create: async (params, options) => toLunaResponse(
        await deepseek.chat.completions.create(buildDeepSeekContentParams(params), options),
      ),
    },
  };
}

function getAnthropicResponsesClient(): LunaResponsesClient | null {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;
  return {
    responses: {
      create: (params, options) => createAnthropicLunaResponse(anthropic, params, options),
    },
  };
}

let client: OpenAI | null = null;

/** The Luna content client for the active provider, despite the historical name. */
export function getOpenAIResponsesClient(): LunaResponsesClient | null {
  const provider = lunaContentProviderName();
  if (provider === 'anthropic') return getAnthropicResponsesClient();
  if (provider === 'deepseek') return getDeepSeekResponsesClient();
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

export function readLunaResponseContent(
  response: LunaResponseContent,
  options: { allowIncompleteOutput?: boolean } = {},
): string {
  if (response.status === 'incomplete' && (
    !options.allowIncompleteOutput
    || response.incomplete_details?.reason !== 'max_output_tokens'
  )) {
    throw new Error(`OPENAI_RESPONSE_INCOMPLETE:${response.incomplete_details?.reason || 'unknown'}`);
  }

  const outputTexts: string[] = [];
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    const refusal = item.content.find((content) => content.type === 'refusal');
    if (refusal?.type === 'refusal') {
      throw new Error('OPENAI_RESPONSE_REFUSAL');
    }
    for (const content of item.content) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        outputTexts.push(content.text);
      }
    }
  }

  // The OpenAI Node SDK populates response.output_text client-side. Our Railway
  // relay returns the raw REST payload, so rebuild the same convenience field
  // from response.output when it is absent on Timeweb.
  const content = (
    typeof response.output_text === 'string' && response.output_text.trim()
      ? response.output_text
      : outputTexts.join('')
  ).trim();

  if (!content) throw new Error('OPENAI_RESPONSE_EMPTY');
  return content;
}

function aiScenario(params: OpenAI.Responses.ResponseCreateParamsNonStreaming): string {
  const format = (params.text as { format?: { type?: string; name?: string } } | undefined)?.format;
  return format?.type === 'json_schema' && format.name ? format.name : format?.type === 'json_object' ? 'json' : 'text';
}

async function createLunaResponse(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  options: { allowIncompleteOutput?: boolean } = {},
): Promise<LunaResponseResult> {
  const startedAt = Date.now();
  const { provider: providerName, model, keyName } = getLunaContentProvider();
  const call = {
    scenario: aiScenario(params),
    model: providerName === 'openai' ? String(params.model || '') : model,
    provider: providerName,
  };
  let response: OpenAI.Responses.Response;
  try {
    if (providerName !== 'openai' || useDirectOpenAI()) {
      const provider = getOpenAIResponsesClient();
      if (!provider) throw new Error(`${keyName} is not configured`);
      response = await provider.responses.create(params);
    } else {
      response = await createResponseViaRelay(params);
    }
    const content = readLunaResponseContent(response, options);
    recordAiCall({ ...call, durationMs: Date.now() - startedAt,
      tokensPrompt: response.usage?.input_tokens, tokensCompletion: response.usage?.output_tokens });
    return {
      content,
      responseId: response.id,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens || 0,
      ...(response.status === 'incomplete'
        ? { incompleteReason: response.incomplete_details?.reason || 'unknown' }
        : {}),
    };
  } catch (error) {
    recordAiCall({ ...call, durationMs: Date.now() - startedAt, error });
    throw error;
  }
}

export async function createLunaStructuredResponse(
  input: LunaStructuredResponseInput,
): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaStructuredResponseParams(input), {
    allowIncompleteOutput: input.allowIncompleteOutput,
  });
}

export async function callStructuredWithBudgetRetry(
  input: LunaStructuredResponseInput,
  budgets: readonly [number, number],
  onAttempt?: (event: { attempt: 1 | 2; budget: number; result?: LunaResponseResult; error?: string; latencyMs: number }) => void,
  options: {
    incompleteErrorCode?: string;
    request?: LunaStructuredRequester;
  } = {},
): Promise<{ result: LunaResponseResult; attempts: 1 | 2 }> {
  const request = options.request || createLunaStructuredResponse;
  for (const [index, budget] of budgets.entries()) {
    const startedAt = Date.now();
    try {
      const result = await request({ ...input, maxOutputTokens: budget });
      onAttempt?.({ attempt: (index + 1) as 1 | 2, budget, result, latencyMs: Date.now() - startedAt });
      return { result, attempts: (index + 1) as 1 | 2 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onAttempt?.({ attempt: (index + 1) as 1 | 2, budget, error: message, latencyMs: Date.now() - startedAt });
      if (message === 'OPENAI_RESPONSE_INCOMPLETE:max_output_tokens') {
        if (index === 0) continue;
        throw new Error(options.incompleteErrorCode || 'OPENAI_STRUCTURED_PROVIDER_INCOMPLETE');
      }
      throw error;
    }
  }
  throw new Error(options.incompleteErrorCode || 'OPENAI_STRUCTURED_PROVIDER_INCOMPLETE');
}

export async function createLunaJsonResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaJsonResponseParams(input));
}

export async function createLunaTextResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaTextResponseParams(input));
}
