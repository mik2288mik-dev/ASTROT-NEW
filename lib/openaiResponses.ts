import { createHash } from 'crypto';
import OpenAI from 'openai';
import { OPENAI_LUNA_MODEL } from './openai-models';

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
};

type LunaResponseResult = {
  content: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
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

function isRailwayRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT
    || process.env.RAILWAY_ENVIRONMENT_ID
    || process.env.RAILWAY_SERVICE_ID,
  );
}

function getOpenAIRelayAuthToken(): string {
  const appSessionSecret = String(process.env.APP_SESSION_SECRET || '').trim();
  if (!appSessionSecret) throw new Error('OPENAI_RELAY_AUTH_SECRET_MISSING');
  return createHash('sha256')
    .update(`nebo-openai-relay-v1:${appSessionSecret}`)
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

let client: OpenAI | null = null;

export function getOpenAIResponsesClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

export function readLunaResponseContent(response: LunaResponseContent): string {
  if (response.status === 'incomplete') {
    throw new Error(`OPENAI_RESPONSE_INCOMPLETE:${response.incomplete_details?.reason || 'unknown'}`);
  }
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    const refusal = item.content.find((content) => content.type === 'refusal');
    if (refusal?.type === 'refusal') {
      throw new Error('OPENAI_RESPONSE_REFUSAL');
    }
  }
  const content = response.output_text.trim();
  if (!content) throw new Error('OPENAI_RESPONSE_EMPTY');

  return content;
}

async function createLunaResponse(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): Promise<LunaResponseResult> {
  let response: OpenAI.Responses.Response;

  if (isRailwayRuntime()) {
    const openai = getOpenAIResponsesClient();
    if (!openai) throw new Error('OPENAI_API_KEY is not configured');
    response = await openai.responses.create(params);
  } else {
    response = await createResponseViaRelay(params);
  }

  const content = readLunaResponseContent(response);

  return {
    content,
    responseId: response.id,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens || 0,
  };
}

export async function createLunaStructuredResponse(
  input: LunaStructuredResponseInput,
): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaStructuredResponseParams(input));
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
