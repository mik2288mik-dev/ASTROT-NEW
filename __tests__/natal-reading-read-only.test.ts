import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartData } from '../types';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import { buildNatalUnifiedWriterPlan, materializeNatalUnifiedReading } from '../lib/natalReading/unifiedGeneration';
import type { NatalUnifiedReading } from '../lib/natalReading/unifiedReading';

const mockCached = jest.fn();
const mockGenerate = jest.fn();
const mockEntitlement = jest.fn();
const mockFetch = jest.fn();
const mockFailed = jest.fn();
jest.mock('../lib/natalReading/unifiedApi', () => ({ getCachedNatalUnifiedReading: (...args: unknown[]) => mockCached(...args), generateNatalUnifiedReadingWithLock: (...args: unknown[]) => mockGenerate(...args) }));
jest.mock('../lib/natalReading/apiHelper', () => ({ ensureValidContext: async () => ({ userId: '42', ctx: {} }) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('../lib/natalReading/preparation', () => ({ hasFailedNatalReadingPreparation: (...args: unknown[]) => mockFailed(...args) }));
jest.mock('../services/apiClient', () => ({ apiFetch: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
import handler from '../pages/api/content/natal/reading';
import { loadUnifiedReadingForLegacyEndpoint } from '../lib/natalReading/legacyCompatibilityApi';
import { clearNatalUnifiedReadingCache, ensureNatalUnifiedReading, waitForPreparedNatalReading } from '../services/natalUnifiedReadingService';

function reading(): NatalUnifiedReading {
  const interpretation = buildNatalInterpretation(canonicalNatalChart());
  const plan = buildNatalUnifiedWriterPlan(interpretation, 'premium');
  const block = (item: { id: string; meaningIds: string[] }) => ({ id: item.id, meaning_ids: item.meaningIds,
    text: 'Обычно ты сначала разбираешься в деталях, а потом выбираешь понятный способ действовать без лишней суеты.' });
  return materializeNatalUnifiedReading({ interpretation, plan, tier: 'premium', raw: {
    story: plan.story.map(block), topics: plan.topics.map((topic) => ({ ...topic, blocks: topic.blocks.map(block) })),
  } }).reading!;
}
async function request(method: string, tier: string) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
  await handler({ method, query: { tier }, body: { tier } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}
describe('natal visits only read saved content', () => {
  beforeEach(() => { jest.clearAllMocks(); clearNatalUnifiedReadingCache(); mockEntitlement.mockResolvedValue({ isPremium: true }); mockFailed.mockResolvedValue(false); });
  it.each(['GET', 'POST'])('returns the same saved report for %s without writing', async (method) => {
    const full = reading(); mockCached.mockResolvedValue({ content: full });
    const free = await request(method, 'free'); const premium = await request(method, 'premium');
    expect(free.json.mock.calls[0][0].interpretation.content.story).toEqual(full.story.slice(0, free.json.mock.calls[0][0].interpretation.content.story.length));
    expect(free.json.mock.calls[0][0].interpretation.content.topics).toEqual([]);
    expect(premium.json.mock.calls[0][0].interpretation.content).toBe(full);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST'])('does not generate on a missing saved report via %s', async (method) => {
    mockCached.mockResolvedValue(null);
    expect((await request(method, 'free')).status).toHaveBeenCalledWith(404);
    expect((await loadUnifiedReadingForLegacyEndpoint({ userId: '42', ctx: {} as never, method: method as 'GET' | 'POST' })).status).toBe('not_found');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it('retains Premium entitlement checks', async () => {
    mockEntitlement.mockResolvedValue({ isPremium: false });
    expect((await request('POST', 'premium')).status).toHaveBeenCalledWith(403);
    expect(mockCached).not.toHaveBeenCalled(); expect(mockGenerate).not.toHaveBeenCalled();
  });
  it('stops first-create waiting on a failed server job', async () => {
    mockCached.mockResolvedValue(null); mockFailed.mockResolvedValue(true);
    expect((await request('GET', 'free')).json).toHaveBeenCalledWith({ error: 'NATAL_PREPARATION_FAILED', code: 'NATAL_PREPARATION_FAILED' });
  });
  it('repeated client opens and retry never POST or poll on a cache miss', async () => {
    mockFetch.mockResolvedValue({ status: 404, ok: false });
    const input = { userId: '42', chartData: canonicalNatalChart() as unknown as NatalChartData, tier: 'free' as const };
    for (let i = 0; i < 3; i++) await expect(ensureNatalUnifiedReading(input)).rejects.toMatchObject({ code: 'NATAL_UNIFIED_READING_NOT_READY' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });
  it('waits for server preparation only during creation, using GET', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValueOnce({ status: 404, ok: false }).mockResolvedValue({ status: 200, ok: true, json: async () => ({ interpretation: { content: reading() } }) });
    const pending = waitForPreparedNatalReading({ userId: '42', chartData: canonicalNatalChart() as unknown as NatalChartData, tier: 'free' });
    await jest.advanceTimersByTimeAsync(1500);
    await expect(pending).resolves.toMatchObject({ tier: 'premium' });
    expect(mockFetch.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
    jest.useRealTimers();
  });
});
