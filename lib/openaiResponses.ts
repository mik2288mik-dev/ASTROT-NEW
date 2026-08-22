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
};

type LunaResponseContent = Pick<
  OpenAI.Responses.Response,
  'status' | 'incomplete_details' | 'output' | 'output_text'
>;

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
  const openai = getOpenAIResponsesClient();
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  const response = await openai.responses.create(params);
  const content = readLunaResponseContent(response);

  return {
    content,
    responseId: response.id,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
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
): Promise<{ result: LunaResponseResult; attempts: 1 | 2 }> {
  for (const [index, budget] of budgets.entries()) {
    const startedAt = Date.now();
    try {
      const result = await createLunaStructuredResponse({ ...input, maxOutputTokens: budget });
      onAttempt?.({ attempt: (index + 1) as 1 | 2, budget, result, latencyMs: Date.now() - startedAt });
      return { result, attempts: (index + 1) as 1 | 2 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onAttempt?.({ attempt: (index + 1) as 1 | 2, budget, error: message, latencyMs: Date.now() - startedAt });
      if (index === 0 && message === 'OPENAI_RESPONSE_INCOMPLETE:max_output_tokens') continue;
      throw new Error(`OPENAI_STRUCTURED_STAGE_FAILED:${message}`);
    }
  }
  throw new Error('OPENAI_STRUCTURED_STAGE_FAILED:unknown');
}

export async function createLunaJsonResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaJsonResponseParams(input));
}

export async function createLunaTextResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaTextResponseParams(input));
}
