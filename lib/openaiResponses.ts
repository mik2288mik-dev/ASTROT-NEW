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
};

type LunaStructuredResponseInput = LunaResponseInput & {
  schemaName: string;
  schema: StrictJsonSchema;
};

type LunaResponseResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
};

export function buildLunaStructuredResponseParams(input: LunaStructuredResponseInput) {
  return {
    model: OPENAI_LUNA_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
    text: {
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
    text: { format: { type: 'json_object' as const } },
  } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming;
}

export function buildLunaTextResponseParams(input: LunaResponseInput) {
  return {
    model: OPENAI_LUNA_MODEL,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
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

async function createLunaResponse(
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): Promise<LunaResponseResult> {
  const openai = getOpenAIResponsesClient();
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  const response = await openai.responses.create(params);
  if (response.status === 'incomplete') {
    throw new Error(`OPENAI_RESPONSE_INCOMPLETE:${response.incomplete_details?.reason || 'unknown'}`);
  }
  const content = response.output_text.trim();
  if (!content) throw new Error('OPENAI_RESPONSE_EMPTY');

  return {
    content,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };
}

export async function createLunaStructuredResponse(
  input: LunaStructuredResponseInput,
): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaStructuredResponseParams(input));
}

export async function createLunaJsonResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaJsonResponseParams(input));
}

export async function createLunaTextResponse(input: LunaResponseInput): Promise<LunaResponseResult> {
  return createLunaResponse(buildLunaTextResponseParams(input));
}
