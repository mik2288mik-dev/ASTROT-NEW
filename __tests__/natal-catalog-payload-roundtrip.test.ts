import type { NatalChartData, UserProfile } from '../types';
import type { ReadingContext } from '../lib/natalReading/apiHelper';

const mockRead = jest.fn();
const mockApiFetch = jest.fn();
const mockProvider = jest.fn();
jest.mock('../lib/natalReading/apiHelper', () => ({
  getCachedReading: (...args: unknown[]) => mockRead(...args),
  saveReading: jest.fn(),
}));
jest.mock('../services/apiClient', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
jest.mock('../lib/openaiResponses', () => ({ callStructuredWithBudgetRetry: (...args: unknown[]) => mockProvider(...args) }));
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: (value: unknown) => JSON.stringify(value),
  withContentGenerationLock: async ({ readCached }: { readCached: () => Promise<{ value: unknown } | null> }) => {
    const cached = await readCached();
    if (!cached) throw new Error('Expected a reusable saved narrative');
    return { status: 'ready', value: cached.value, fromCache: true };
  },
}));

import {
  isNatalReportCategoryPack, NATAL_REPORT_CATALOG_CONTRACT_VERSION, NATAL_REPORT_CATEGORIES,
  type NatalReportCategoryKey, type NatalReportCategoryPack,
} from '../lib/natalReading/reportCatalog';
import { buildNatalReportCatalogContext } from '../lib/natalReading/reportCatalogEvidence';
import { materializeNatalReportCategoryPack } from '../lib/natalReading/reportCatalogGeneration';
import {
  generateNatalReportCategoryWithLock, getCachedNatalReportCategory, natalReportCategoryCacheOptions,
} from '../lib/natalReading/reportCatalogApi';
import { ensureNatalCatalogCategory } from '../services/natalCatalogService';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { natalEditorialCategoryPayload } from './fixtures/natalEditorialNarrative';

const profile: UserProfile = {
  id: 'roundtrip-owner', name: 'Лина', birthDate: '1990-01-01', birthTime: '08:15', birthPlace: 'Москва',
  language: 'ru', isSetup: true, theme: 'light', isPremium: true,
};
const chart = canonicalNatalChart();
const built = buildNatalReportCatalogContext(profile, chart);
const context: ReadingContext = { user: { id: profile.id }, profile, chartId: 7, chartData: chart as unknown as NatalChartData };
function materialize(categoryKey: NatalReportCategoryKey, withoutPreviews = false): NatalReportCategoryPack {
  const raw = natalEditorialCategoryPayload(built, categoryKey);
  if (withoutPreviews) raw.previews = {};
  const report = materializeNatalReportCategoryPack({ raw, built, categoryKey, language: 'ru' });
  if (!report) throw new Error(`Invalid test narrative: ${categoryKey}`);
  return report;
}
const reports = Object.fromEntries(NATAL_REPORT_CATEGORIES.map(({ key }) => [key, materialize(key)])) as Record<NatalReportCategoryKey, NatalReportCategoryPack>;
const identity = { chartFingerprint: 'roundtrip-canonical-chart', reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION };
const optionKey = (options: { cacheKey?: string; inputHash?: string }) => `${options.cacheKey}:${options.inputHash}`;

describe('materialized natal narratives survive shared validation and saved-content reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider.mockRejectedValue(new Error('The saved narrative must not trigger generation'));
    const stored = new Map(NATAL_REPORT_CATEGORIES.map(({ key }) => {
      const options = natalReportCategoryCacheOptions(context, key, key === 'main' ? null : reports.main);
      return [optionKey(options), { content: reports[key], inputHash: options.inputHash, promptVersion: options.promptVersion }];
    }));
    mockRead.mockImplementation(async (_ctx, options) => stored.get(optionKey(options)) || null);
  });

  it.each(NATAL_REPORT_CATEGORIES.map(({ key }) => [key] as const))('reuses a materialized %s narrative through API cache and client parsing', async (categoryKey) => {
    expect(isNatalReportCategoryPack(reports[categoryKey])).toBe(true);
    expect((await getCachedNatalReportCategory(context, categoryKey))?.content).toBe(reports[categoryKey]);
    const saved = await generateNatalReportCategoryWithLock({ userId: profile.id!, ctx: context, categoryKey });
    expect(saved).toMatchObject({ status: 'ready', fromCache: true, value: { content: reports[categoryKey] } });
    mockApiFetch.mockImplementation(async (_url, options) => {
      expect(options.method).toBe('GET');
      return { ok: true, status: 200, json: async () => ({ interpretation: await getCachedNatalReportCategory(context, categoryKey) }) };
    });
    const received = await ensureNatalCatalogCategory(`roundtrip-${categoryKey}`, categoryKey, 7, 'ru', identity, true);
    expect(received).toEqual(reports[categoryKey]);
    expect(await ensureNatalCatalogCategory(`roundtrip-${categoryKey}`, categoryKey, 7, 'ru', identity, true)).toBe(received);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockProvider).not.toHaveBeenCalled();
  });

  it('accepts a complete Main story when all optional continuation previews were discarded', async () => {
    const withoutPreviews = materialize('main', true);
    expect(withoutPreviews.previews).toEqual([]);
    expect(isNatalReportCategoryPack(withoutPreviews)).toBe(true);
    mockRead.mockResolvedValue({ content: withoutPreviews });
    expect((await getCachedNatalReportCategory(context, 'main'))?.content).toBe(withoutPreviews);
    mockApiFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ interpretation: { content: withoutPreviews } }) });
    expect(await ensureNatalCatalogCategory('roundtrip-without-previews', 'main', 7, 'ru', identity)).toEqual(withoutPreviews);
    expect(mockApiFetch.mock.calls.map(([, options]) => options.method)).toEqual(['GET', 'POST']);
  });

  it('accepts a valid subset of optional Main links without requiring removed question-card content', () => {
    expect(isNatalReportCategoryPack({ ...reports.main, previews: reports.main.previews.slice(0, 2) })).toBe(true);
    expect(isNatalReportCategoryPack({ ...reports.main, freeAnswers: [{}] })).toBe(false);
  });

  it.each([
    ['blank title', { title: '   ' }],
    ['old short reading', { summary: reports.main.summary.slice(0, 3) }],
    ['old observation cards', { observations: [reports.main.summary[0]] }],
    ['empty paragraphs', { summary: reports.main.summary.map((item) => ({ ...item, text: '   ' })) }],
    ['null paragraph', { summary: [null, ...reports.main.summary.slice(1)] }],
    ['missing evidence', { summary: reports.main.summary.map((item) => ({ ...item, evidenceIds: [] })) }],
    ['non-string evidence', { summary: reports.main.summary.map((item) => ({ ...item, evidenceIds: [42] })) }],
    ['blank evidence', { summary: reports.main.summary.map((item) => ({ ...item, evidenceIds: [' '] })) }],
    ['null preview', { previews: [null] }],
    ['duplicate preview', { previews: [reports.main.previews[0], reports.main.previews[0]] }],
    ['stale contract', { contractVersion: 'natal-report-catalog-v1' }],
  ])('rejects %s at both the shared validator and API cache boundary', async (_name, change) => {
    const malformed = { ...reports.main, ...change };
    expect(isNatalReportCategoryPack(malformed)).toBe(false);
    mockRead.mockResolvedValue({ content: malformed });
    expect(await getCachedNatalReportCategory(context, 'main')).toBeNull();
  });

  it('rejects question previews on paid chapters and too-short narratives on the client boundary', async () => {
    expect(isNatalReportCategoryPack({ ...reports.work, previews: reports.main.previews.slice(0, 1) })).toBe(false);
    const malformed = { ...reports.work, summary: reports.work.summary.map((item) => ({ ...item, text: 'Слово '.repeat(20) })) };
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpretation: { content: malformed } }) });
    await expect(ensureNatalCatalogCategory('roundtrip-invalid', 'work', 7, 'ru', identity, true)).rejects.toMatchObject({ code: 'NATAL_CATALOG_RESPONSE_INCOMPLETE' });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it('reloads a validated narrative from local persistence after the client module remounts', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
    try {
      mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpretation: { content: reports.work } }) });
      await ensureNatalCatalogCategory('roundtrip-reload', 'work', 7, 'ru', identity, true);
      expect(values.size).toBe(1);
      mockApiFetch.mockClear();
      let reloaded!: typeof import('../services/natalCatalogService');
      jest.isolateModules(() => { reloaded = require('../services/natalCatalogService'); });
      expect(reloaded.getNatalCatalogCategoryCached('roundtrip-reload', 'work', 7, 'ru', identity, true)).toEqual(reports.work);
      expect(await reloaded.ensureNatalCatalogCategory('roundtrip-reload', 'work', 7, 'ru', identity, true)).toEqual(reports.work);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(reloaded.getNatalCatalogCategoryCached('roundtrip-reload', 'work', 7, 'ru', identity, false)).toBeNull();
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
