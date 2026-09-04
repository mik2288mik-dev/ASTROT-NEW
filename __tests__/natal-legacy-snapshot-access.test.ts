import type { NextApiRequest, NextApiResponse } from 'next';
const mockUser = { id: '42', name: 'Owner', birth_date: '1980-01-01', birth_place: 'Owner city', language: 'ru' };
const mockChartData = { complete: true, birth: {
  localDate: '1990-05-01', place: 'Saved city', timezone: 'Europe/Moscow', latitude: 55.7, longitude: 37.6,
  time: { mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null },
}, calculationMetadata: { calculatedAt: '2026-09-04T10:00:00Z' }, calculationVersion: 'version' };
let mockChart: Record<string, any>;
const mockGetContentLayer = jest.fn();
const mockReadChart = jest.fn();
const mockGenerate = jest.fn();
jest.mock('../lib/db', () => ({ db: { users: { get: async () => mockUser } } }));
jest.mock('../lib/natalChartRead', () => ({ getCanonicalNatalChart: (...args: unknown[]) => mockReadChart(...args) }));
jest.mock('../lib/contentArchitecture', () => ({ getPremiumEntitlementState: async () => ({ isPremium: true }), getContentLayer: (...args: unknown[]) => mockGetContentLayer(...args) }));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: async () => ({ userId: '42' }) }));
jest.mock('../lib/adminAuth', () => ({ AdminAuthError: class extends Error {}, handleAdminError: jest.fn() }));
jest.mock('../lib/appSettings', () => ({ getOpenAIModelForContent: jest.fn() }));
jest.mock('../lib/natalContent', () => ({ generateNatalFullReading: (...args: unknown[]) => mockGenerate(...args), generateNatalAnchorReading: (...args: unknown[]) => mockGenerate(...args), generateNatalLivingReading: (...args: unknown[]) => mockGenerate(...args) }));
jest.mock('../lib/natalReadings', () => ({
  NATAL_FULL_CACHE_KEY: 'full', NATAL_ANCHOR_CACHE_KEY: 'anchor',
  NATAL_FULL_PROMPT_VERSION: 'version', NATAL_ANCHOR_PROMPT_VERSION: 'version', NATAL_LIVING_PROMPT_VERSION: 'version',
  coerceNatalFullReading: (value: unknown) => value, coerceNatalAnchorReading: (value: unknown) => value, coerceNatalLivingReading: (value: unknown) => value,
  getCurrentNatalPeriodKey: () => '2026-09-04', buildNatalLivingCacheKey: (period: string) => `living:${period}`,
}));
jest.mock('../lib/planetInsights', () => ({ PLANET_INSIGHT_PROMPT_VERSION: 'version', generatePlanetInsight: (...args: unknown[]) => mockGenerate(...args), resolvePlanetInsightRequest: () => ({ planetId: 'sun', cacheKey: 'planet:sun' }) }));
jest.mock('../lib/planetInsightContent', () => ({ buildPlanetInsight: () => ({}) }));
jest.mock('../lib/natal/canonicalReport', () => ({ isNatalChartDataV2: () => false, buildCanonicalNatalReport: jest.fn() }));
jest.mock('../lib/astrologyHistoryPersistence', () => ({ persistNatalReadingHistory: jest.fn() }));
jest.mock('../lib/contentGenerationLock', () => ({ buildContentGenerationLockKey: jest.fn(), generationInProgressPayload: jest.fn(), withContentGenerationLock: jest.fn() }));

import full from '../pages/api/content/natal/full';
import anchor from '../pages/api/content/natal/anchor';
import living from '../pages/api/content/natal/living';
import planet from '../pages/api/content/natal/planet-insight';
import { resolveNatalContentChartContext } from '../lib/natalContentChartContext';

const handlers = { full, anchor, living, planet };
async function request(handler: typeof full) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  await handler({ method: 'POST', query: {}, body: { userId: '42', chartId: 7, planetId: 'sun', profile: { name: 'Forged', birthPlace: 'Forged place' }, chartData: { forged: true } } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

describe('legacy natal content only reads the selected saved snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChart = { id: 7, user_id: '42', subject_type: 'saved_person', name: 'Saved person', birth_time: null, input_hash: 'birth-hash', chart_data: mockChartData };
    mockReadChart.mockImplementation(async () => mockChart);
    mockGetContentLayer.mockResolvedValue({ interpretation: { promptVersion: 'version', content: {} }, chartId: 7, source: 'cache' });
  });

  it('uses saved-person identity, birth data and precision even when client profile supplies different values', async () => {
    const context = await resolveNatalContentChartContext('42', 7, { name: 'Forged', birthDate: '2000-01-01', birthPlace: 'Forged', language: 'en' });
    expect(context?.profile).toMatchObject({ name: 'Saved person', birthDate: '1990-05-01', birthPlace: 'Saved city', birthTimeMode: 'unknown', birthTime: '', language: 'en' });
    expect(context?.chartData).toBe(mockChartData);
  });

  it.each(Object.entries(handlers))('%s scopes caches to the immutable saved revision and ignores client chartData', async (_name, handler) => {
    const first = await request(handler);
    expect(first.status).toHaveBeenCalledWith(200);
    expect(mockReadChart).toHaveBeenCalledWith('42', 7);
    const firstKey = mockGetContentLayer.mock.calls[0][0].cacheKey;
    expect(firstKey).toContain(':natal:birth-hash:2026-09-04T10:00:00Z');
    mockChart = { ...mockChart, input_hash: 'changed-birth-hash' };
    await request(handler);
    expect(mockGetContentLayer.mock.calls[1][0].cacheKey).not.toBe(firstKey);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it.each(Object.entries(handlers))('%s propagates locked or incomplete saved-chart errors before reading any content', async (_name, handler) => {
    for (const [code, status] of [['PREMIUM_REQUIRED', 403], ['CHART_NOT_FOUND', 404], ['CHART_REPAIR_REQUIRED', 409]] as const) {
      mockReadChart.mockRejectedValueOnce(Object.assign(new Error(code), { code, status }));
      const res = await request(handler);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code }));
    }
    expect(mockGetContentLayer).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
