const create = jest.fn();
jest.mock('../lib/deepseekClient', () => ({
  getDeepSeekClient: jest.fn(() => (process.env.DEEPSEEK_API_KEY ? { chat: { completions: { create } } } : null)),
}));

import {
  buildDeepSeekContentParams,
  buildLunaStructuredResponseParams,
  createLunaStructuredResponse,
  getLunaContentProvider,
  getOpenAIResponsesClient,
  OPENAI_LUNA_MODEL,
  readLunaResponseContent,
  toLunaResponse,
  deepSeekContentEnabled,
} from '../lib/openaiResponses';

const structured = {
  instructions: 'Write the forecast.',
  input: '{"date":"2026-10-22"}',
  maxOutputTokens: 2000,
  reasoningEffort: 'medium' as const,
  verbosity: 'low' as const,
  store: false,
  schemaName: 'personal_future_forecast',
  schema: {
    type: 'object' as const,
    additionalProperties: false as const,
    required: ['text'],
    properties: { text: { type: 'string' } },
  },
};

function completion(content: string, finish = 'stop') {
  return {
    id: 'cmpl-1', model: 'deepseek-flash', object: 'chat.completion', created: 0,
    choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, prompt_cache_hit_tokens: 100 },
  } as never;
}

describe('DeepSeek content provider switch', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    create.mockReset();
  });

  it('is on by default and off only when AI_CONTENT_PROVIDER is openai', () => {
    expect(deepSeekContentEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(deepSeekContentEnabled({ AI_CONTENT_PROVIDER: 'deepseek' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(deepSeekContentEnabled({ AI_CONTENT_PROVIDER: ' OpenAI ' } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('reports the active provider, model and whether its key is set', () => {
    expect(getLunaContentProvider({ DEEPSEEK_API_KEY: 'ds' } as unknown as NodeJS.ProcessEnv))
      .toEqual({ provider: 'deepseek', model: 'deepseek-flash', keyName: 'DEEPSEEK_API_KEY', keyPresent: true });
    expect(getLunaContentProvider({ OPENAI_API_KEY: 'sk' } as unknown as NodeJS.ProcessEnv))
      .toMatchObject({ provider: 'deepseek', keyPresent: false });
    expect(getLunaContentProvider({ AI_CONTENT_PROVIDER: 'openai', OPENAI_API_KEY: 'sk' } as unknown as NodeJS.ProcessEnv))
      .toEqual({ provider: 'openai', model: OPENAI_LUNA_MODEL, keyName: 'OPENAI_API_KEY', keyPresent: true });
  });

  it('moves instructions and the strict schema into a JSON-mode chat request', () => {
    const params = buildDeepSeekContentParams(buildLunaStructuredResponseParams(structured));
    expect(params.model).toBe('deepseek-flash');
    expect(params.max_tokens).toBe(2000);
    expect(params.response_format).toEqual({ type: 'json_object' });
    expect(params.messages[0]).toEqual({
      role: 'system',
      content: expect.stringContaining(JSON.stringify(structured.schema)),
    });
    expect(String(params.messages[0].content).startsWith('Write the forecast.')).toBe(true);
    expect(params.messages[1]).toEqual({ role: 'user', content: structured.input });
  });

  it('uses DEEPSEEK_CONTENT_MODEL when it is set', () => {
    process.env.DEEPSEEK_CONTENT_MODEL = 'deepseek-v4-pro';
    expect(buildDeepSeekContentParams(buildLunaStructuredResponseParams(structured)).model).toBe('deepseek-v4-pro');
  });

  it('reads DeepSeek output like a Luna response and reports a cut answer as incomplete', () => {
    expect(readLunaResponseContent(toLunaResponse(completion('{"text":"ok"}')))).toBe('{"text":"ok"}');
    expect(() => readLunaResponseContent(toLunaResponse(completion('{"te', 'length'))))
      .toThrow('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens');
  });

  it('routes the shared client and the structured wrapper to DeepSeek by default, bypassing the OpenAI relay', async () => {
    delete process.env.AI_CONTENT_PROVIDER;
    process.env.DEEPSEEK_API_KEY = 'ds-test';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RELAY_DIRECT;
    create.mockResolvedValue(completion('{"text":"ok"}'));

    const result = await createLunaStructuredResponse(structured);
    expect(result).toMatchObject({ content: '{"text":"ok"}', inputTokens: 120, outputTokens: 30 });

    const provider = getOpenAIResponsesClient();
    expect(provider).not.toBeNull();
    const signal = AbortSignal.timeout(1000);
    await provider!.responses.create(buildLunaStructuredResponseParams(structured), { signal, maxRetries: 0 });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'deepseek-flash' }), { signal, maxRetries: 0 });
  });

  it('reports no provider when DeepSeek has no key, even with an OpenAI key', () => {
    delete process.env.AI_CONTENT_PROVIDER;
    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(getOpenAIResponsesClient()).toBeNull();
  });
});
