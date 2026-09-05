import type { ReadingContext } from '../lib/natalReading/apiHelper';
import type { NatalReportCategoryKey, NatalReportCategoryPack } from '../lib/natalReading/reportCatalog';
const mockRead = jest.fn();
const mockSave = jest.fn();
const mockGenerateCategory = jest.fn();
const mockGenerateAnswer = jest.fn();
const mockLock = jest.fn();
jest.mock('../lib/natalReading/apiHelper', () => ({ getCachedReading: (...args: unknown[]) => mockRead(...args), saveReading: (...args: unknown[]) => mockSave(...args) }));
jest.mock('../lib/natalReading/reportCatalogGeneration', () => ({ generateNatalReportCategoryPack: (...args: unknown[]) => mockGenerateCategory(...args), generateNatalReportAnswer: (...args: unknown[]) => mockGenerateAnswer(...args) }));
jest.mock('../lib/contentGenerationLock', () => ({ buildContentGenerationLockKey: (value: unknown) => JSON.stringify(value), withContentGenerationLock: (...args: unknown[]) => mockLock(...args) }));
jest.mock('../lib/natalReading/reportCatalogEvidence', () => ({
  buildNatalReportCatalogContext: () => ({}),
  resolveNatalReportCategoryEvidence: () => [{ answerKey: 'test', evidenceIds: ['sun'], requiredEvidenceIds: ['sun'] }],
  resolveNatalReportAnswerEvidence: () => ({ evidenceIds: ['sun'], requiredEvidenceIds: ['sun'] }),
}));
jest.mock('../lib/natalReading/permanentReport', () => ({ buildPermanentNatalChartFingerprint: (_profile: unknown, chart: { fingerprint: string }) => chart.fingerprint }));
jest.mock('../lib/natalReading/reportCatalog', () => ({
  ...jest.requireActual('../lib/natalReading/reportCatalog'),
  isNatalReportCategoryPack: (value: any) => typeof value?.categoryKey === 'string' && Array.isArray(value?.summary),
  isNatalReportAnswer: (value: any) => typeof value?.answerKey === 'string',
}));

import {
  generateNatalReportAnswerWithLock, generateNatalReportCategoryWithLock,
  natalReportAnswerCacheOptions, natalReportCategoryCacheOptions,
} from '../lib/natalReading/reportCatalogApi';
import { getNatalReportAnswer, NATAL_REPORT_CATALOG_CONTRACT_VERSION } from '../lib/natalReading/reportCatalog';

const context = { profile: { id: '42', language: 'ru' }, chartId: 7, chartData: { fingerprint: 'saved-v1' } } as unknown as ReadingContext;
const pack = (categoryKey: NatalReportCategoryKey): NatalReportCategoryPack => ({
  schemaVersion: 'natal-report-category-v1' as const, contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  categoryKey, title: categoryKey, summary: [{ text: `Saved ${categoryKey} narrative`, evidenceIds: ['sun'] }],
  observations: [], previews: [], freeAnswers: [],
});

describe('Premium narratives continue the persisted Free introduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const cache = new Map<string, unknown>();
    const key = (ctx: ReadingContext, options: any) => `${ctx.chartId}:${options.accessTier}:${options.cacheKey}:${options.inputHash}`;
    mockRead.mockImplementation(async (ctx, options) => cache.get(key(ctx, options)) || null);
    mockSave.mockImplementation(async (ctx, options, content) => {
      const interpretation = { content, inputHash: options.inputHash, promptVersion: options.promptVersion };
      cache.set(key(ctx, options), interpretation);
      return interpretation;
    });
    mockGenerateCategory.mockImplementation(async ({ categoryKey }) => pack(categoryKey));
    mockGenerateAnswer.mockImplementation(async ({ answerKey }) => ({ answerKey }));
    mockLock.mockImplementation(async ({ readCached, generate }) => {
      const cached = await readCached();
      return { status: 'ready', value: cached?.value || await generate(), fromCache: !!cached };
    });
  });

  it('creates and persists the Free introduction before the first Premium category without selecting a question', async () => {
    await generateNatalReportCategoryWithLock({ userId: '42', ctx: context, categoryKey: 'work' });
    expect(mockGenerateCategory.mock.calls.map(([args]) => args.categoryKey)).toEqual(['main', 'work']);
    const main = mockSave.mock.calls[0][2];
    expect(mockGenerateCategory.mock.calls[1][0].mainAnchor).toBe(main);
    expect(mockSave.mock.calls[0][1]).toMatchObject({ accessTier: 'free', modelTier: 'base' });
    expect(mockSave.mock.calls[1][1]).toMatchObject({ accessTier: 'premium', modelTier: 'premium' });
    expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockGenerateCategory.mock.invocationCallOrder[1]);
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('reuses both saved stories on repeated visits to the same chart', async () => {
    await generateNatalReportCategoryWithLock({ userId: '42', ctx: context, categoryKey: 'love' });
    await generateNatalReportCategoryWithLock({ userId: '42', ctx: context, categoryKey: 'love' });
    expect(mockGenerateCategory).toHaveBeenCalledTimes(2);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('isolates story caches by current natal snapshot and accepted main narrative', () => {
    const main = pack('main');
    const changedMain = { ...main, summary: [{ text: 'Updated accepted main story', evidenceIds: ['sun'] }] };
    const original = natalReportCategoryCacheOptions(context, 'work', main);
    expect(natalReportCategoryCacheOptions(context, 'work', changedMain).inputHash).not.toBe(original.inputHash);
    expect(natalReportCategoryCacheOptions({ ...context, chartData: { fingerprint: 'saved-v2' } as any }, 'work', main).inputHash).not.toBe(original.inputHash);
    const firstAnswer = natalReportAnswerCacheOptions(context, 'work_start_new', pack('work'), main);
    expect(natalReportAnswerCacheOptions(context, 'work_start_new', { ...pack('work'), summary: changedMain.summary }, main).inputHash).not.toBe(firstAnswer.inputHash);
  });

  it('preserves optional answers when Premium categories have no question previews or embedded samples', async () => {
    await generateNatalReportAnswerWithLock({ userId: '42', ctx: context, answerKey: 'work_start_new' });
    expect(mockGenerateAnswer).toHaveBeenCalledWith(expect.objectContaining({
      answerKey: 'work_start_new', preview: getNatalReportAnswer('work_start_new')!.title.ru,
      mainAnchor: expect.objectContaining({ categoryKey: 'main' }),
    }));
    expect(mockSave.mock.calls.at(-1)?.[1]).toMatchObject({ accessTier: 'premium' });
  });
});
