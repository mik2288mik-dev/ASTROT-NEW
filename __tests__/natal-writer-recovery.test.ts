import { natalWriterPayload } from './fixtures/natalWriterPayload';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
const mockResponse = jest.fn();
jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: (...args: unknown[]) => mockResponse(...args) }));
import { buildNatalUnifiedWriterPlan, generateNatalUnifiedReading, NATAL_MAX_BLOCK_REPAIRS, type NatalWriterProgress } from '../lib/natalReading/unifiedGeneration';
import { NATAL_COPY_REVISION } from '../lib/natalReading/unifiedReading';

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
    const context = JSON.parse(repairInput.split('INPUT:\n')[1].split('\n\nPREVIOUS OUTPUT')[0]).preserved_context;
    expect(context.story[0]).toEqual({ text: raw.story[1].text, meaning_ids: raw.story[1].meaning_ids });
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(1);
    expect(repairInput).toContain('rejected_candidate');
    expect(repairInput).toContain('Remove unsupported causes');
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
  it('uses the second repair when the first still fails copy validation', async () => {
    const { chart, raw, checks } = fixture();
    const bad = { ...raw.story[0], text: 'Самоподача и самовыражение могут требовать разных действий и решений.' };
    mockResponse.mockResolvedValueOnce(reply({ ...raw, story: [bad, ...raw.story.slice(1)] }))
      .mockResolvedValueOnce(reply({ story: [bad], topics: [] }))
      .mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks }));
    const result = await generateNatalUnifiedReading({ chart, tier: 'premium' });
    expect(result.story).toEqual(raw.story.map(block => ({ id: block.id, text: block.text, meaningIds: block.meaning_ids })));
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(1);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_block_repair')).toHaveLength(2);
  });
  it('uses the remaining repair for a rejected semantic repair and reviews only that block', async () => {
    const { chart, raw, checks } = fixture();
    const rejection = { ...checks[0], issues: [{ kind: 'unsupported_claim', detail: 'Не добавляй мотив результата' }] };
    mockResponse.mockResolvedValueOnce(reply(raw))
      .mockResolvedValueOnce(reply({ checks: [rejection, ...checks.slice(1)] }))
      .mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks: [rejection] }))
      .mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks: [checks[0]] }));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium' })).resolves.toMatchObject({ tier: 'premium' });
    const reviews = mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_semantic_review');
    expect(reviews.slice(1).map(([input]) => JSON.parse(input.input).blocks.map((block: { id: string }) => block.id)))
      .toEqual([[raw.story[0].id], [raw.story[0].id]]);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(1);
  });
  it('resumes a rejected stored draft within its remaining budget and stops at the limit', async () => {
    const { chart, raw, checks } = fixture();
    const rejection = { ...checks[0], issues: [{ kind: 'unsupported_claim', detail: 'Новый мотив' }] };
    const progress = { writerStarted: true, repairs: NATAL_MAX_BLOCK_REPAIRS - 1, repairRevision: NATAL_COPY_REVISION, raw };
    mockResponse.mockResolvedValueOnce(reply({ checks: [rejection, ...checks.slice(1)] }))
      .mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks: [rejection] }));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium', progress })).rejects.toMatchObject({ code: 'NATAL_WRITER_REJECTED' });
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(0);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_block_repair')).toHaveLength(1);
  });
  it('assigns an inherited draft a finite current-revision edit budget and never replenishes it on restart', async () => {
    const { chart, raw, checks } = fixture();
    const rejected = checks.map((item, index) => index === 0 ? { ...item, issues: [{ kind: 'unsupported_claim', detail: 'Added cause' }] } : item);
    let saved: NatalWriterProgress | undefined;
    const onProgress = async (progress: NatalWriterProgress) => { saved = JSON.parse(JSON.stringify(progress)); };
    mockResponse.mockResolvedValueOnce(reply({ checks: rejected })).mockRejectedValueOnce(new Error('repair connection closed'));
    await expect(generateNatalUnifiedReading({ chart, tier: 'premium', progress: { writerStarted: true, repairs: 3, raw }, onProgress })).rejects.toThrow('repair connection closed');
    expect(saved).toMatchObject({ repairRevision: NATAL_COPY_REVISION, repairs: 1 });
    mockResponse.mockResolvedValueOnce(reply({ checks: rejected }))
      .mockResolvedValueOnce(reply({ story: [raw.story[0]], topics: [] }))
      .mockResolvedValueOnce(reply({ checks: [checks[0]] }));
    await generateNatalUnifiedReading({ chart, tier: 'premium', progress: saved, onProgress });
    expect(saved?.repairs).toBe(2);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(0);
  });
  it('corrects only an outdated rest block in a saved draft and retains the story', async () => {
    const { chart, raw, checks } = fixture();
    chart.positions.sun.house = 6;
    const saved = JSON.parse(JSON.stringify(raw));
    const rest = saved.topics.find((topic: { key: string }) => topic.key === 'rest');
    rest.blocks[0].meaning_ids = ['meaning:position:sun:sign'];
    rest.blocks[0].text = 'В ежедневных делах хочется сначала разобраться и сделать работу основательно.';
    mockResponse.mockResolvedValueOnce(reply({ story: [], topics: [raw.topics.find(topic => topic.key === 'rest')] }))
      .mockResolvedValueOnce(reply({ checks }));
    const reading = await generateNatalUnifiedReading({ chart, tier: 'premium',
      progress: { writerStarted: true, repairs: 2, raw: saved } });
    expect(reading.story.map(block => block.text)).toEqual(raw.story.map(block => block.text));
    expect(mockResponse.mock.calls[0][0].schemaName).toBe('natal_unified_block_repair');
    const request = JSON.parse(mockResponse.mock.calls[0][0].input.split('INPUT:\n')[1].split('\n\nPREVIOUS OUTPUT')[0]);
    expect(request.story).toEqual([]);
    expect(request.topics.map((topic: { key: string }) => topic.key)).toEqual(['rest']);
    expect(mockResponse.mock.calls.filter(([input]) => input.schemaName === 'natal_unified_reading')).toHaveLength(0);
  });
});
