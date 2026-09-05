import type { NextApiRequest, NextApiResponse } from 'next';

const mockCreateLunaStructuredResponse = jest.fn();
const mockGetById = jest.fn();
const mockSynastryGet = jest.fn();
const mockSynastrySet = jest.fn();
const mockUpsertByChart = jest.fn();
const mockCalculateNatalChart = jest.fn();
const mockCreateOrReuseCanonicalChart = jest.fn();

jest.mock('../lib/rateLimit', () => ({
  RATE_LIMIT_CONFIGS: { AI_FREE: {} },
  withRateLimit: (handler: unknown) => handler,
}));

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: jest.fn().mockResolvedValue({ userId: '42', isGuest: false }),
}));

jest.mock('../lib/auth/profile', () => ({
  toPublicAppProfile: () => ({
    id: '42',
    name: 'Анна',
    birthDate: '1992-03-14',
    birthTime: '09:30',
    birthPlace: 'Москва',
    language: 'ru',
    isPremium: true,
  }),
}));

jest.mock('../lib/contentArchitecture', () => ({
  getContentLayer: jest.fn().mockResolvedValue({ interpretation: null }),
  getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: true, entitlement: null }),
}));

jest.mock('../lib/appSettings', () => ({
  getOpenAIModelForContent: jest.fn().mockResolvedValue({ model: 'luna', modelTier: 'premium' }),
}));

jest.mock('../lib/db', () => ({
  db: {
    users: { get: jest.fn().mockResolvedValue({ id: '42', language: 'ru' }) },
    natal_charts: {
      getById: (...args: unknown[]) => mockGetById(...args),
      getAll: jest.fn().mockResolvedValue([]),
      getPrimary: jest.fn().mockResolvedValue(null),
    },
    synastry: {
      get: (...args: unknown[]) => mockSynastryGet(...args),
      set: (...args: unknown[]) => mockSynastrySet(...args),
    },
    content_interpretations: {
      upsertByChart: (...args: unknown[]) => mockUpsertByChart(...args),
    },
  },
}));

jest.mock('../lib/chartAccessPolicy', () => ({
  ...jest.requireActual('../lib/chartAccessPolicy'),
  assertChartReadable: jest.fn(),
}));

jest.mock('../lib/astrologyHistoryPersistence', () => ({
  persistSavedSynastryHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/contentApiLogging', () => ({
  logContentApi: jest.fn(),
  warnContentApi: jest.fn(),
}));

jest.mock('../lib/contentPromptBuilders', () => ({
  buildSynastryPrompt: jest.fn().mockReturnValue({ system: 'system', user: 'user' }),
  parseModelJson: jest.fn((content: string) => JSON.parse(content)),
}));

jest.mock('../lib/openaiResponses', () => ({
  getOpenAIResponsesClient: jest.fn().mockReturnValue({ responses: {} }),
  createLunaStructuredResponse: (...args: unknown[]) => mockCreateLunaStructuredResponse(...args),
}));

jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockCalculateNatalChart(...args),
}));

jest.mock('../lib/natalChartPersistence', () => ({
  createOrReuseCanonicalChart: (...args: unknown[]) => mockCreateOrReuseCanonicalChart(...args),
}));

import handler from '../pages/api/content/synastry/extended';
import { ChartAccessPolicyError } from '../lib/chartAccessPolicy';
import { getPremiumEntitlementState } from '../lib/contentArchitecture';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStory } from './fixtures/compatibilityStory';
import { COMPATIBILITY_NARRATIVE_VERSION } from '../lib/synastry/compatibilityNarrative';

function chart(id?: number, birthTimeQuality: 'exact' | 'approximate' | 'unknown' = 'exact') {
  const value = canonicalNatalChart({
    birthDate: id === 2 ? '1990-08-22' : '1992-03-14',
    time: {
      mode: birthTimeQuality,
      localTime: birthTimeQuality === 'unknown' ? null : '09:30',
      uncertaintyMinutes: birthTimeQuality === 'approximate' ? 30 : null,
      rangeStart: null, rangeEnd: null,
    },
  });
  return id == null
    ? value
    : {
        id,
        user_id: '42',
        name: id === 1 ? 'Анна' : 'Максим',
        birth_date: id === 1 ? '1992-03-14' : '1990-08-22',
        birth_time: '09:30',
        birth_place: 'Москва',
        input_hash: `birth-input-${id}`,
        chart_data: value,
      };
}

function response() {
  const payloads: unknown[] = [];
  const res = {
    statusCode: 200,
    status(this: { statusCode: number }, code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      payloads.push(payload);
      return this;
    },
  } as unknown as NextApiResponse;
  return { res, payloads, status: () => (res as unknown as { statusCode: number }).statusCode };
}

async function post(body: Record<string, unknown>) {
  const req = { method: 'POST', body } as NextApiRequest;
  const out = response();
  await handler(req, out.res);
  return { status: out.status(), payload: out.payloads.at(-1) as any };
}

describe('extended synastry delivery resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateLunaStructuredResponse.mockReset();
    mockCreateLunaStructuredResponse.mockImplementation(async (request) => ({ content: JSON.stringify(compatibilityStory(JSON.parse(request.input).evidence)) }));
    mockCreateOrReuseCanonicalChart.mockReset();
    mockGetById.mockReset();
    mockSynastryGet.mockResolvedValue(null);
    mockSynastrySet.mockResolvedValue({ success: true });
    mockUpsertByChart.mockResolvedValue({ id: 9 });
    mockCalculateNatalChart.mockResolvedValue(chart());
    (getPremiumEntitlementState as jest.Mock).mockResolvedValue({ isPremium: true, entitlement: null });
    mockCreateOrReuseCanonicalChart.mockImplementation(async (input) => ({
      chart: {
        ...chart(input.name === 'Анна' ? 1 : 2),
        name: input.name,
        birth_date: input.birthDate,
        birth_time: input.birthTime,
        birth_place: input.birthPlace,
        chart_data: chart(undefined, input.birthTimeMode),
      },
      reused: false,
    }));
  });

  it('preserves both newly saved people but returns a retryable error when the writer is unavailable', async () => {
    mockCreateLunaStructuredResponse.mockRejectedValueOnce(new Error('model unavailable'));

    const result = await post({
      subjectName: 'Анна',
      subjectDate: '1992-03-14',
      subjectTime: '09:30',
      subjectPlace: 'Москва',
      partnerName: 'Максим',
      partnerDate: '1990-08-22',
      partnerTime: '18:15',
      partnerPlace: 'Казань',
      relationshipType: 'романтика',
      language: 'ru',
    });

    expect(result.status).toBe(503);
    expect(result.payload).toMatchObject({ code: 'SYNASTRY_READING_UNAVAILABLE', retryable: true });
    expect(result.payload.result).toBeUndefined();
    expect(mockSynastrySet).not.toHaveBeenCalled();
    expect(mockCreateOrReuseCanonicalChart).toHaveBeenCalledTimes(2);
    expect(mockCreateOrReuseCanonicalChart).toHaveBeenCalledWith(expect.objectContaining({ userId: '42', name: 'Анна', birthDate: '1992-03-14', birthTime: '09:30', birthPlace: 'Москва', birthTimeMode: 'exact' }));
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(result.payload).toMatchObject({ subjectChartId: 1, partnerChartId: 2 });
    expect(mockCreateOrReuseCanonicalChart.mock.invocationCallOrder[1]).toBeLessThan(mockCreateLunaStructuredResponse.mock.invocationCallOrder[0]);
  });

  it('delivers a generated reading for two saved charts even when cache persistence fails', async () => {
    mockGetById
      .mockResolvedValueOnce(chart(1))
      .mockResolvedValueOnce(chart(2));
    mockSynastrySet.mockRejectedValueOnce(new Error('cache table unavailable'));

    const result = await post({
      subjectChartId: 1,
      partnerChartId: 2,
      relationshipType: 'романтика',
      language: 'ru',
    });

    expect(result.status).toBe(200);
    expect(result.payload.result.summary).toContain('Тебе и Максиму');
    expect(result.payload.result.summary.split('\n\n')).toHaveLength(8);
    expect(result.payload.result.closing).toBeUndefined();
    expect(result.payload.result.schemaVersion).toBe('compatibility-v2');
    expect(result.payload.result.overallScore).not.toBe(1);
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('retries malformed prose once using the same saved chart evidence', async () => {
    mockGetById.mockImplementation(async (id) => chart(id));
    mockCreateLunaStructuredResponse.mockResolvedValueOnce({ content: JSON.stringify({ summary: 'Short canned text' }) });
    const result = await post({ subjectChartId: 1, partnerChartId: 2 });
    expect(result.status).toBe(200);
    expect(mockCreateLunaStructuredResponse).toHaveBeenCalledTimes(2);
    expect(mockCreateLunaStructuredResponse.mock.calls[1][0].instructions).toContain('paragraphs_missing');
    expect(mockCreateLunaStructuredResponse.mock.calls[0][0].input).toBe(mockCreateLunaStructuredResponse.mock.calls[1][0].input);
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('does not cache malformed prose after the bounded retry is exhausted', async () => {
    mockGetById.mockImplementation(async (id) => chart(id));
    mockCreateLunaStructuredResponse.mockResolvedValue({ content: JSON.stringify({ summary: 'Short canned text' }) });
    const result = await post({ subjectChartId: 1, partnerChartId: 2 });
    expect(result.status).toBe(503);
    expect(result.payload.code).toBe('SYNASTRY_READING_UNAVAILABLE');
    expect(mockCreateLunaStructuredResponse).toHaveBeenCalledTimes(2);
    expect(mockSynastrySet).not.toHaveBeenCalled();
    expect(mockUpsertByChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('replaces an obsolete narrative cache with the current story without recalculating charts', async () => {
    mockGetById.mockImplementation(async (id) => chart(id));
    mockSynastryGet.mockResolvedValue({ schemaVersion: 'compatibility-v2', engineVersion: 'compatibility-engine.v1', summary: 'An old canned reading' });
    const result = await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'ex' });
    expect(result.status).toBe(200);
    expect(result.payload.result.narrativeVersion).toBe(COMPATIBILITY_NARRATIVE_VERSION);
    expect(result.payload.result.relationshipContext).toBe('ex');
    expect(result.payload.fromCache).toBe(false);
    expect(mockCreateLunaStructuredResponse).toHaveBeenCalledTimes(1);
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('keeps zodiac signs on the free route and refuses a hybrid full comparison', async () => {
    const result = await post({
      subjectSource: 'birth',
      subjectDate: '1989-03-06',
      subjectGender: 'male',
      partnerSource: 'sign',
      partnerSign: 'leo',
      partnerGender: 'female',
      relationshipType: 'романтика',
      language: 'ru',
    });

    expect(result.status).toBe(400);
    expect(result.payload.code).toBe('USE_SIGN_COMPATIBILITY');
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(mockCreateLunaStructuredResponse).not.toHaveBeenCalled();
  });

  it('keeps unknown birth time reduced in the ordinary saved chart path', async () => {


    const result = await post({
      subjectSource: 'birth',
      subjectName: 'Анна',
      subjectDate: '1992-03-14',
      subjectPlace: 'Москва',
      subjectBirthTimeQuality: 'unknown',
      partnerSource: 'birth',
      partnerName: 'Максим',
      partnerDate: '1990-08-22',
      partnerTime: '18:15',
      partnerPlace: 'Казань',
      partnerBirthTimeQuality: 'exact',
      relationshipContext: 'relationship',
      relationshipType: 'существующие отношения в паре',
      language: 'ru',
    });

    expect(result.status).toBe(200);
    expect(result.payload.calculationLevel).toBe('reduced');
    expect(result.payload.result.calculationLevel).toBe('reduced');
    expect(mockCreateOrReuseCanonicalChart).toHaveBeenCalledWith(expect.objectContaining({ name: 'Анна', birthDate: '1992-03-14', birthTime: '', birthPlace: 'Москва', birthTimeMode: 'unknown' }));
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(result.payload.result.evidence.some((item: any) => item.type === 'house_overlay' && item.direction === 'partner_to_subject')).toBe(false);
  });

  it('uses a 30-minute uncertainty for an approximate manually entered time', async () => {


    const result = await post({
      subjectSource: 'birth',
      subjectName: 'Анна',
      subjectDate: '1992-03-14',
      subjectTime: '09:30',
      subjectPlace: 'Москва',
      subjectBirthTimeQuality: 'approximate',
      partnerSource: 'birth',
      partnerName: 'Максим',
      partnerDate: '1990-08-22',
      partnerTime: '18:15',
      partnerPlace: 'Казань',
      partnerBirthTimeQuality: 'exact',
      relationshipContext: 'relationship',
      relationshipType: 'существующие отношения в паре',
      language: 'ru',
    });

    expect(result.status).toBe(200);
    expect(result.payload.calculationLevel).toBe('reduced');
    expect(mockCreateOrReuseCanonicalChart).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Анна', birthDate: '1992-03-14', birthTime: '09:30', birthPlace: 'Москва',
      birthTimeMode: 'approximate', birthTimeUncertaintyMinutes: 30,
    }));
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('still rejects comparing the same saved chart with itself', async () => {
    mockGetById
      .mockResolvedValueOnce(chart(1))
      .mockResolvedValueOnce(chart(1));

    const result = await post({
      subjectChartId: 1,
      partnerChartId: 1,
      relationshipContext: 'friendship',
      relationshipType: 'дружба',
      language: 'ru',
    });

    expect(result.status).toBe(400);
    expect(result.payload.code).toBe('CHART_PAIR_DUPLICATE');
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('creates a new partner through My Charts before comparing with the saved subject', async () => {
    mockGetById.mockResolvedValueOnce(chart(1));
    const result = await post({
      subjectChartId: 1,
      partnerSource: 'birth', partnerName: 'Максим', partnerDate: '1990-08-22',
      partnerPlace: 'Казань', partnerTime: '18:15',
    });

    expect(result.status).toBe(200);
    expect(result.payload).toMatchObject({ subjectChartId: 1, partnerChartId: 2 });
    expect(mockCreateOrReuseCanonicalChart).toHaveBeenCalledTimes(1);
    expect(mockSynastrySet).toHaveBeenCalledWith(1, 2, 'extended', expect.any(String), expect.anything());
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('reuses the saved-pair cache without creating charts or invoking Swiss or AI', async () => {
    mockGetById.mockImplementation(async (id) => chart(id));
    const cached = { schemaVersion: 'compatibility-v2', engineVersion: 'compatibility-engine.v1', narrativeVersion: COMPATIBILITY_NARRATIVE_VERSION, summary: 'Saved result' };
    mockSynastryGet.mockResolvedValue(cached);

    const first = await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'romance' });
    const second = await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'romance' });

    expect(first.status).toBe(200);
    expect(second.payload).toMatchObject({ fromCache: true, subjectChartId: 1, partnerChartId: 2, result: cached });
    expect(mockSynastryGet.mock.calls[0][3]).toBe(mockSynastryGet.mock.calls[1][3]);
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(mockCreateLunaStructuredResponse).not.toHaveBeenCalled();
  });

  it('changes the saved-pair cache key when either input hash or the relationship context changes', async () => {
    let subjectHash = 'subject-v1';
    let partnerHash = 'partner-v1';
    mockGetById.mockImplementation(async (id) => ({ ...chart(id), input_hash: id === 1 ? subjectHash : partnerHash }));
    mockSynastryGet.mockResolvedValue({ schemaVersion: 'compatibility-v2', engineVersion: 'compatibility-engine.v1', narrativeVersion: COMPATIBILITY_NARRATIVE_VERSION });
    await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'romance' });
    subjectHash = 'subject-v2';
    await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'romance' });
    partnerHash = 'partner-v2';
    await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'romance' });
    await post({ subjectChartId: 1, partnerChartId: 2, relationshipContext: 'friendship' });

    expect(new Set(mockSynastryGet.mock.calls.map((call) => call[3])).size).toBe(4);
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('does not compare or call AI when a new person cannot be saved', async () => {
    mockGetById.mockResolvedValueOnce(chart(1));
    mockCreateOrReuseCanonicalChart.mockRejectedValueOnce(new ChartAccessPolicyError('CHART_LIMIT_REACHED', 'Chart limit reached.'));
    const result = await post({
      subjectChartId: 1, partnerSource: 'birth', partnerName: 'Максим',
      partnerDate: '1990-08-22', partnerPlace: 'Казань',
    });

    expect(result.status).toBe(403);
    expect(result.payload.code).toBe('CHART_LIMIT_REACHED');
    expect(mockSynastryGet).not.toHaveBeenCalled();
    expect(mockCreateLunaStructuredResponse).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('invalidates a pair cache after explicit repair even when the birth hash is unchanged', async () => {
    let calculatedAt = '2026-09-01T00:00:00.000Z';
    mockGetById.mockImplementation(async (id) => {
      const record = chart(id) as any;
      return { ...record, chart_data: { ...record.chart_data, calculationMetadata: { ...record.chart_data.calculationMetadata, calculatedAt: id === 1 ? calculatedAt : '2026-09-01T00:00:00.000Z' } } };
    });
    mockSynastryGet.mockResolvedValue({ schemaVersion: 'compatibility-v2', engineVersion: 'compatibility-engine.v1', narrativeVersion: COMPATIBILITY_NARRATIVE_VERSION });
    await post({ subjectChartId: 1, partnerChartId: 2 });
    calculatedAt = '2026-09-04T00:00:00.000Z';
    await post({ subjectChartId: 1, partnerChartId: 2 });

    expect(mockSynastryGet.mock.calls[0][3]).not.toBe(mockSynastryGet.mock.calls[1][3]);
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('requires birthplace before attempting to save a manual natal chart', async () => {
    const result = await post({
      subjectSource: 'birth', subjectName: 'Анна', subjectDate: '1992-03-14',
      partnerSource: 'birth', partnerName: 'Максим', partnerDate: '1990-08-22', partnerPlace: 'Казань',
    });

    expect(result.status).toBe(400);
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it('never recalculates a saved chart with missing calculation data', async () => {
    mockGetById.mockResolvedValueOnce(chart(1)).mockResolvedValueOnce({ ...chart(2), chart_data: null });
    const result = await post({ subjectChartId: 1, partnerChartId: 2 });

    expect(result.status).toBe(409);
    expect(result.payload.code).toBe('CHART_REPAIR_REQUIRED');
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });

  it.each([1, 2])('requires repair when saved chart %i has no input hash', async (missingHashId) => {
    mockGetById.mockImplementation(async (id) => ({ ...chart(id), input_hash: id === missingHashId ? null : `birth-input-${id}` }));

    const result = await post({ subjectChartId: 1, partnerChartId: 2 });

    expect(result.status).toBe(409);
    expect(result.payload.code).toBe('CHART_REPAIR_REQUIRED');
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
    expect(mockSynastryGet).not.toHaveBeenCalled();
    expect(mockCreateLunaStructuredResponse).not.toHaveBeenCalled();
  });

  it('does not create partner charts for a free account', async () => {
    (getPremiumEntitlementState as jest.Mock).mockResolvedValueOnce({ isPremium: false });
    const result = await post({ subjectChartId: 1, partnerSource: 'birth', partnerDate: '1990-08-22', partnerPlace: 'Казань' });

    expect(result.status).toBe(403);
    expect(result.payload.code).toBe('PREMIUM_REQUIRED');
    expect(mockCreateOrReuseCanonicalChart).not.toHaveBeenCalled();
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
  });
});
