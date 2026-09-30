import { natalWriterPayload } from './fixtures/natalWriterPayload';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
const mockResponse = jest.fn();
jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: (...args: unknown[]) => mockResponse(...args) }));
import { buildNatalUnifiedWriterPlan, generateNatalUnifiedReading, type NatalWriterProgress } from '../lib/natalReading/unifiedGeneration';

function fixture() {
  const chart = canonicalNatalChart();
  const interpretation = buildNatalInterpretation(chart);
  const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
  const raw = natalWriterPayload(interpretation, plan);
  const checks = [...raw.story, ...raw.topics.flatMap((topic) => topic.blocks)].map((item) => ({ id: item.id, issues: [] as { kind: string; detail: string }[] }));
  return { chart, raw, checks };
}
const reply = (value: unknown) => ({ content: JSON.stringify(value) });
describe('natal preparation preserves completed work', () => {
  beforeEach(() => { jest.resetAllMocks(); });
  it('accepts completeness notes without another writing request', async () => {
    const { chart, raw, checks } = fixture();
    checks[0].issues = [{ kind: 'missing_detail', detail: 'Не упомянуты первые реакции' }];
    mockResponse.mockResolvedValueOnce(reply(raw)).mockResolvedValueOnce(reply({ checks }));
    const result = await generateNatalUnifiedReading({ chart, tier: 'premium' });
    expect(result.story[0].text).toBe(raw.story[0].text);
    expect(mockResponse).toHaveBeenCalledTimes(2);
    expect(mockResponse.mock.calls[1][0].instructions).toContain('Не отклоняй текст за отсутствующую деталь');
  });
  it('repairs an unsupported claim in one block and keeps every other block', async () => {
    const { chart, raw, checks } = fixture();
    const failed = checks.map((item, index) => index === 0 ? { ...item, issues: [{ kind: 'unsupported_claim', detail: 'unsupported claim' }] } : item);
    const repaired = { ...raw.story[0], text: 'Обычно тебе проще выбрать способ действия, когда понятны детали и можно спокойно сравнить варианты.' };
    mockResponse.mockResolvedValueOnce(reply(raw)).mockResolvedValueOnce(reply({ checks: failed }))
      .mockResolvedValueOnce(reply({ story: [repaired], topics: [] }))
      .mockResolvedValueOnce(reply({ checks: [checks[0]] }));
    const result = await generateNatalUnifiedReading({ chart, tier: 'premium' });
    expect(result.story[0].text).toBe(repaired.text);
    expect(result.story.slice(1).map((item) => item.text)).toEqual(raw.story.slice(1).map((item) => item.text));
    expect(result.topics.map((topic) => topic.blocks.map((item) => item.text))).toEqual(raw.topics.map((topic) => topic.blocks.map((item) => item.text)));
    const repairInput = mockResponse.mock.calls[2][0].input;
    expect(repairInput).toContain(raw.story[0].id);
    expect(repairInput).not.toContain(`"id": "${raw.story[1].id}"`);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(1);
  });
  it('resumes a stored draft after a review transport failure without writing it again', async () => {
    const { chart, raw, checks } = fixture();
    let saved: NatalWriterProgress | undefined;
    const onProgress = async (progress: NatalWriterProgress) => { saved = JSON.parse(JSON.stringify(progress)); };
    mockResponse.mockResolvedValueOnce(reply(raw)).mockRejectedValueOnce(new Error('review connection closed'));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium', onProgress })).rejects.toThrow('review connection closed');
    expect(saved?.raw?.story).toHaveLength(raw.story.length);
    mockResponse.mockResolvedValueOnce(reply({ checks }));
    await generateNatalUnifiedReading({ chart, tier: 'premium', progress: saved, onProgress });
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(1);
    mockResponse.mockClear();
    await generateNatalUnifiedReading({ chart, tier: 'premium', progress: saved });
    expect(mockResponse).not.toHaveBeenCalled();
  });
  it('does not silently order another full report after an uncertain writer timeout', async () => {
    const { chart } = fixture(); let saved: NatalWriterProgress | undefined;
    mockResponse.mockRejectedValueOnce(new Error('writer timeout'));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium', onProgress: async (value) => { saved = JSON.parse(JSON.stringify(value)); } })).rejects.toThrow('writer timeout');
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium', progress: saved })).rejects.toMatchObject({ code: 'NATAL_WRITER_REJECTED' });
    expect(mockResponse).toHaveBeenCalledTimes(1);
  });
  it('repairs only a structurally invalid block instead of rewriting the report', async () => {
    const { chart, raw, checks } = fixture(); const bad = JSON.parse(JSON.stringify(raw));
    bad.story[0].text = 'Тебе нужно сохранять баланс и помнить, что любые решения лучше принимать только после паузы.';
    mockResponse.mockResolvedValueOnce(reply(bad)).mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks }));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium' })).resolves.toMatchObject({ tier: 'premium' });
    expect(mockResponse.mock.calls[1][0].schemaName).toBe('natal_unified_block_repair');
    expect(mockResponse.mock.calls[1][0].input).not.toContain(`"id": "${raw.story[1].id}"`);
  });
});
