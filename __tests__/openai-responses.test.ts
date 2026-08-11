import {
  buildLunaJsonResponseParams,
  buildLunaStructuredResponseParams,
  buildLunaTextResponseParams,
  readLunaResponseContent,
  OPENAI_LUNA_MODEL,
} from '../lib/openaiResponses';

describe('OpenAI Luna structured response request', () => {
  it('uses the Responses API JSON Schema format in strict mode', () => {
    const params = buildLunaStructuredResponseParams({
      instructions: 'Return the requested forecast object.',
      input: 'Evidence: []',
      maxOutputTokens: 900,
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
    expect(params.text).toEqual({
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
});
