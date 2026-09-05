import type { NextApiRequest, NextApiResponse } from 'next';

const mockEnsureContext = jest.fn();
const mockEntitlement = jest.fn();
const mockReadCategory = jest.fn();
const mockGenerateCategory = jest.fn();
const mockReadAnswer = jest.fn();
const mockGenerateAnswer = jest.fn();
const mockApiFetch = jest.fn();
jest.mock('../lib/natalReading/apiHelper', () => ({ ensureValidContext: (...args: unknown[]) => mockEnsureContext(...args) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('../lib/natalReading/reportCatalogApi', () => ({
  getCachedNatalReportCategory: (...args: unknown[]) => mockReadCategory(...args),
  generateNatalReportCategoryWithLock: (...args: unknown[]) => mockGenerateCategory(...args),
  getCachedNatalReportAnswer: (...args: unknown[]) => mockReadAnswer(...args),
  generateNatalReportAnswerWithLock: (...args: unknown[]) => mockGenerateAnswer(...args),
}));
jest.mock('../lib/contentGenerationLock', () => ({ generationInProgressPayload: (retryAfterMs: number) => ({ retryAfterMs }) }));
jest.mock('../services/apiClient', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
jest.mock('../lib/natalReading/reportCatalog', () => ({
  ...jest.requireActual('../lib/natalReading/reportCatalog'),
  isNatalReportCategoryPack: (value: any) => value?.testCategory === true,
  isNatalReportAnswer: (value: any) => value?.testAnswer === true,
}));

import categoryHandler from '../pages/api/content/natal/catalog';
import answerHandler from '../pages/api/content/natal/catalog-answer';
import {
  ensureNatalCatalogAnswer, ensureNatalCatalogCategory,
  getNatalCatalogAnswerCached, getNatalCatalogCategoryCached,
} from '../services/natalCatalogService';

async function request(handler: typeof categoryHandler, key: Record<string, string>, method = 'GET') {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn() };
  await handler({ method, query: { userId: '42', chartId: '7', ...key }, body: { userId: '42', chartId: 7, ...key } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

describe('catalog narratives enforce Free and Premium before cache access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureContext.mockResolvedValue({ userId: '42', ctx: { chartId: 7, chartSubjectType: 'saved_person', profile: { id: '42', language: 'ru' } } });
    mockEntitlement.mockResolvedValue({ isPremium: false });
    mockReadCategory.mockResolvedValue({ content: { testCategory: true, categoryKey: 'main' } });
    mockReadAnswer.mockResolvedValue({ content: { testAnswer: true } });
    mockGenerateCategory.mockResolvedValue({ status: 'ready', value: { content: { testCategory: true } } });
  });

  it('serves the complete main narrative for an authorized Free saved chart', async () => {
    const res = await request(categoryHandler, { categoryKey: 'main' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessTier: 'free' }));
    expect(mockEnsureContext).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ requireCanonicalSnapshot: true, repairCanonicalSnapshot: false }));
    expect(mockGenerateCategory).not.toHaveBeenCalled();
  });

  it.each(['GET', 'POST'])('blocks paid category %s before reading a previously cached story', async (method) => {
    const res = await request(categoryHandler, { categoryKey: 'work' }, method);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockReadCategory).not.toHaveBeenCalled();
    expect(mockGenerateCategory).not.toHaveBeenCalled();
  });

  it('generates a Premium category directly without requiring an answer selection', async () => {
    mockEntitlement.mockResolvedValue({ isPremium: true });
    mockReadCategory.mockResolvedValue(null);
    const res = await request(categoryHandler, { categoryKey: 'work' }, 'POST');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessTier: 'premium' }));
    expect(mockGenerateCategory).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: 'work', ctx: expect.objectContaining({ chartId: 7 }) }));
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('does not use an old free sample answer to bypass a paid category', async () => {
    const res = await request(answerHandler, { answerKey: 'work_start_new' }, 'POST');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockReadAnswer).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('leaves a blocked or repair-required chart to the canonical context guard', async () => {
    mockEnsureContext.mockImplementationOnce(async (_req, res) => { res.status(409).json({ code: 'CHART_REPAIR_REQUIRED' }); return null; });
    const res = await request(categoryHandler, { categoryKey: 'main' }, 'POST');
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockReadCategory).not.toHaveBeenCalled();
    expect(mockGenerateCategory).not.toHaveBeenCalled();
  });
});

describe('catalog client cache cannot expose paid content after access expires', () => {
  beforeEach(() => { mockApiFetch.mockReset(); });

  it('keeps a cached paid narrative gated while Free main remains available', async () => {
    const identity = { chartFingerprint: 'client-paid-snapshot', reportVersion: 'test' };
    const paid = { testCategory: true, categoryKey: 'work' };
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpretation: { content: paid } }) });
    await expect(ensureNatalCatalogCategory('client-paid', 'work', 7, 'ru', identity, true)).resolves.toBe(paid);
    expect(getNatalCatalogCategoryCached('client-paid', 'work', 7, 'ru', identity, false)).toBeNull();
    await expect(ensureNatalCatalogCategory('client-paid', 'work', 7, 'ru', identity, false)).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(getNatalCatalogCategoryCached('client-paid', 'work', 7, 'ru', identity, true)).toBe(paid);
    const main = { testCategory: true, categoryKey: 'main' };
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpretation: { content: main } }) });
    await expect(ensureNatalCatalogCategory('client-paid', 'main', 7, 'ru', identity)).resolves.toBe(main);
  });

  it('also locks a cached legacy free sample from a Premium category', async () => {
    const answer = { testAnswer: true };
    const identity = { chartFingerprint: 'client-answer-snapshot', reportVersion: 'test' };
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ interpretation: { content: answer } }) });
    await ensureNatalCatalogAnswer('client-answer', 'work_start_new', true, 7, 'ru', identity);
    expect(getNatalCatalogAnswerCached('client-answer', 'work_start_new', false, 7, 'ru', identity)).toBeNull();
    await expect(ensureNatalCatalogAnswer('client-answer', 'work_start_new', false, 7, 'ru', identity)).rejects.toMatchObject({ code: 'PREMIUM_REQUIRED' });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});
