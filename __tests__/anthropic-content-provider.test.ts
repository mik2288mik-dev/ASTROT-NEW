const create = jest.fn();
jest.mock('../lib/anthropicContent', () => {
  const actual = jest.requireActual('../lib/anthropicContent');
  return {
    ...actual,
    getAnthropicClient: jest.fn(() => (process.env.ANTHROPIC_API_KEY ? { messages: { create } } : null)),
  };
});

import { buildAnthropicContentParams, toLunaResponseFromAnthropic } from '../lib/anthropicContent';
import {
  buildLunaJsonResponseParams,
  buildLunaStructuredResponseParams,
  createLunaStructuredResponse,
  getLunaContentProvider,
  lunaContentProviderName,
  readLunaResponseContent,
} from '../lib/openaiResponses';

const structured = {
  instructions: 'Write the forecast.',
  input: '{"date":"2026-10-22"}',
  maxOutputTokens: 2000,
  schemaName: 'personal_future_forecast',
  schema: {
    type: 'object' as const,
    additionalProperties: false as const,
    required: ['text'],
    properties: { text: { type: 'string' } },
  },
};

function message(text: string, stop = 'end_turn', extra: Record<string, unknown> = {}) {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
    content: [{ type: 'text', text }], stop_reason: stop, stop_details: null,
    usage: { input_tokens: 20, output_tokens: 30, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 },
    ...extra,
  } as never;
}

describe('Claude content provider', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    create.mockReset();
  });

  it('takes over from DeepSeek as soon as ANTHROPIC_API_KEY is set, unless a provider is pinned', () => {
    const e = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
    expect(lunaContentProviderName(e({}))).toBe('deepseek');
    expect(lunaContentProviderName(e({ ANTHROPIC_API_KEY: 'sk-ant' }))).toBe('anthropic');
    expect(lunaContentProviderName(e({ ANTHROPIC_API_KEY: 'sk-ant', AI_CONTENT_PROVIDER: 'deepseek' }))).toBe('deepseek');
    expect(lunaContentProviderName(e({ AI_CONTENT_PROVIDER: 'anthropic' }))).toBe('anthropic');
    expect(getLunaContentProvider(e({ ANTHROPIC_API_KEY: 'sk-ant' })))
      .toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5', keyName: 'ANTHROPIC_API_KEY', keyPresent: true });
    expect(getLunaContentProvider(e({ AI_CONTENT_PROVIDER: 'anthropic' })))
      .toMatchObject({ provider: 'anthropic', keyPresent: false });
  });

  it('sends a strict schema as structured output with thinking off and no sampling parameters', () => {
    const params = buildAnthropicContentParams(buildLunaStructuredResponseParams(structured));
    expect(params).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: structured.schema } },
      messages: [{ role: 'user', content: structured.input }],
    });
    expect(params).not.toHaveProperty('temperature');
    expect((params.system as Array<{ text: string }>)[0].text).toBe('Write the forecast.');
  });

  it('describes the schema in the prompt for the fallback and asks for plain JSON in json mode', () => {
    const fallback = buildAnthropicContentParams(buildLunaStructuredResponseParams(structured), { schemaInPrompt: true });
    expect(fallback).not.toHaveProperty('output_config');
    expect((fallback.system as Array<{ text: string }>)[0].text).toContain('"required":["text"]');
    const json = buildAnthropicContentParams(buildLunaJsonResponseParams({ instructions: 'X', input: 'Y', maxOutputTokens: 300 }));
    expect((json.system as Array<{ text: string }>)[0].text).toContain('Return only one JSON object');
  });

  it('reads Claude output like a Luna response, strips code fences and flags cut or refused answers', () => {
    expect(readLunaResponseContent(toLunaResponseFromAnthropic(message('```json\n{"text":"ok"}\n```')))).toBe('{"text":"ok"}');
    expect(() => readLunaResponseContent(toLunaResponseFromAnthropic(message('{"te', 'max_tokens'))))
      .toThrow('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens');
    expect(() => readLunaResponseContent(toLunaResponseFromAnthropic(message('', 'refusal'))))
      .toThrow('OPENAI_RESPONSE_REFUSAL');
  });

  it('routes the structured wrapper to Claude once the key is set', async () => {
    delete process.env.AI_CONTENT_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    create.mockResolvedValue(message('{"text":"ok"}'));
    const result = await createLunaStructuredResponse(structured);
    expect(result).toMatchObject({ content: '{"text":"ok"}', inputTokens: 120, outputTokens: 30 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-5-5' }), undefined);
  });
});

describe('Claude relay for the Russian host', () => {
  it('goes through Railway unless this server reaches the providers directly', () => {
    const { anthropicViaRelay, anthropicRelayAuthToken } = jest.requireActual('../lib/anthropicContent');
    expect(anthropicViaRelay({} as NodeJS.ProcessEnv)).toBe(true);
    expect(anthropicViaRelay({ OPENAI_RELAY_DIRECT: '1' } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(anthropicRelayAuthToken('sk-ant')).toMatch(/^[a-f0-9]{64}$/);
    expect(anthropicRelayAuthToken('sk-ant')).not.toContain('sk-ant');
  });
});
