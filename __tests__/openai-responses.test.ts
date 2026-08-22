import {
  buildLunaJsonResponseParams,
  buildLunaStructuredResponseParams,
  buildLunaTextResponseParams,
  callStructuredWithBudgetRetry,
  readLunaResponseContent,
  OPENAI_LUNA_MODEL,
} from '../lib/openaiResponses';

describe('OpenAI Luna structured response request', () => {
  it('uses the Responses API JSON Schema format in strict mode', () => {
    const params = buildLunaStructuredResponseParams({
      instructions: 'Return the requested forecast object.',
      input: 'Evidence: []',
      maxOutputTokens: 900,
      reasoningEffort: 'low',
      verbosity: 'low',
      store: false,
      schemaName: 'personal_forecast',
      schema: {
        type: 'object',
        properties: {
          paragraphs: { type: 'array', items: { type: 'string' } },
        },
        required: ['paragraphs'],
        additionalProperties: false,
      },
    });

    expect(params.model).toBe(OPENAI_LUNA_MODEL);
    expect(params.instructions).toBe('Return the requested forecast object.');
    expect(params.input).toBe('Evidence: []');
    expect(params.max_output_tokens).toBe(900);
    expect(params.reasoning).toEqual({ effort: 'low' });
    expect(params.store).toBe(false);
    expect(params.text).toEqual({
      verbosity: 'low',
      format: expect.objectContaining({
        type: 'json_schema',
        name: 'personal_forecast',
        strict: true,
      }),
    });
  });

  it('uses the same Responses endpoint for non-schema JSON and text surfaces', () => {
    expect(buildLunaJsonResponseParams({
      instructions: 'Return JSON.',
      input: 'Input',
      maxOutputTokens: 200,
    })).toMatchObject({
      model: OPENAI_LUNA_MODEL,
      text: { format: { type: 'json_object' } },
    });

    expect(buildLunaTextResponseParams({
      instructions: 'Return text.',
      input: 'Input',
      maxOutputTokens: 200,
    })).toMatchObject({
      model: OPENAI_LUNA_MODEL,
      instructions: 'Return text.',
      input: 'Input',
    });
  });

  it('can disable provider storage for private personal-forecast input without changing other calls', () => {
    const privateParams = buildLunaStructuredResponseParams({
      instructions: 'Return the requested forecast object.',
      input: 'Private birth profile',
      maxOutputTokens: 900,
      store: false,
      schemaName: 'personal_forecast',
      schema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
    });
    expect(privateParams.store).toBe(false);

    const ordinaryParams = buildLunaTextResponseParams({
      instructions: 'Return text.',
      input: 'Input',
      maxOutputTokens: 200,
    });
    expect(ordinaryParams).not.toHaveProperty('store');
  });

  it('keeps a provider refusal distinct from a generic empty response', () => {
    expect(() => readLunaResponseContent({
      status: 'completed',
      output_text: '',
      output: [{
        type: 'message',
        content: [{ type: 'refusal', refusal: 'Cannot provide this response.' }],
      }],
    } as never)).toThrow('OPENAI_RESPONSE_REFUSAL');
  });

  it('returns a complete strict response after one provider call', async () => {
    const request = jest.fn().mockResolvedValue({
      content: '{"ok":true}', responseId: 'resp_1', inputTokens: 12, outputTokens: 4, reasoningTokens: 1,
    });
    const result = await callStructuredWithBudgetRetry({
      instructions: 'Same instructions', input: 'Original input', maxOutputTokens: 1,
      reasoningEffort: 'low', verbosity: 'low', store: false,
      schemaName: 'test', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    }, [1600, 3200], undefined, { request });
    expect(result.attempts).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toMatchObject({ input: 'Original input', maxOutputTokens: 1600 });
  });

  it('retries only max-token incompletes with the original input and the larger budget', async () => {
    const request = jest.fn()
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce({ content: '{"ok":true}', responseId: 'resp_2', inputTokens: 12, outputTokens: 4, reasoningTokens: 0 });
    await callStructuredWithBudgetRetry({
      instructions: 'Same instructions', input: 'Original input', maxOutputTokens: 1,
      reasoningEffort: 'none', verbosity: 'low', store: false,
      schemaName: 'test', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    }, [1200, 2400], undefined, { request, incompleteErrorCode: 'WRITER_PROVIDER_INCOMPLETE' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([input]) => input.input)).toEqual(['Original input', 'Original input']);
    expect(request.mock.calls.map(([input]) => input.instructions)).toEqual(['Same instructions', 'Same instructions']);
    expect(request.mock.calls.map(([input]) => input.maxOutputTokens)).toEqual([1200, 2400]);
  });

  it('normalizes a second max-token incomplete to the stage error', async () => {
    const request = jest.fn().mockRejectedValue(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'));
    await expect(callStructuredWithBudgetRetry({
      instructions: 'Same instructions', input: 'Original input', maxOutputTokens: 1,
      schemaName: 'test', schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    }, [1600, 3200], undefined, { request, incompleteErrorCode: 'BRIEF_PROVIDER_INCOMPLETE' }))
      .rejects.toThrow('BRIEF_PROVIDER_INCOMPLETE');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry other provider errors', async () => {
    const request = jest.fn().mockRejectedValue(new Error('OPENAI_RESPONSE_REFUSAL'));
    await expect(callStructuredWithBudgetRetry({
      instructions: 'Same instructions', input: 'Original input', maxOutputTokens: 1,
      schemaName: 'test', schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    }, [1600, 3200], undefined, { request })).rejects.toThrow('OPENAI_RESPONSE_REFUSAL');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
