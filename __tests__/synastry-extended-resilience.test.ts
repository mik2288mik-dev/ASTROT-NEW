import type { NextApiRequest, NextApiResponse } from 'next';

const mockCreateLunaStructuredResponse = jest.fn();
const mockCalculateNatalChart = jest.fn();
const mockGetById = jest.fn();
const mockSynastryGet = jest.fn();
const mockSynastrySet = jest.fn();
const mockUpsertByChart = jest.fn();

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

jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockCalculateNatalChart(...args),
}));

jest.mock('../lib/db', () => ({
  db: {
    users: { get: jest.fn().mockResolvedValue({ id: '42', language: 'ru' }) },
    natal_charts: {
      getById: (...args: unknown[]) => mockGetById(...args),
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
  assertChartReadable: jest.fn(),
  ChartAccessPolicyError: class ChartAccessPolicyError extends Error {},
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

jest.mock('../lib/synastry/synastryAspects', () => ({
  computeSynastryAspects: jest.fn().mockReturnValue([
    { a: 'Луна', b: 'Венера', aspect: 'трин', orb: 1.2 },
  ]),
}));

import handler from '../pages/api/content/synastry/extended';

function chart(id?: number) {
  const value = {
    sun: { longitude: 10, sign: 'Aries' },
    moon: { longitude: 42, sign: 'Taurus' },
    mercury: { longitude: 70, sign: 'Gemini' },
    venus: { longitude: 100, sign: 'Cancer' },
    mars: { longitude: 130, sign: 'Leo' },
    jupiter: { longitude: 160, sign: 'Virgo' },
    saturn: { longitude: 190, sign: 'Libra' },
  };
  return id == null
    ? value
    : {
        id,
        user_id: '42',
        name: id === 1 ? 'Анна' : 'Максим',
        birth_date: id === 1 ? '1992-03-14' : '1990-08-22',
        birth_time: '09:30',
        birth_place: 'Москва',
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
    mockCalculateNatalChart.mockResolvedValue(chart());
    mockSynastryGet.mockResolvedValue(null);
    mockSynastrySet.mockResolvedValue({ success: true });
    mockUpsertByChart.mockResolvedValue({ id: 9 });
  });

  it('returns a chart-grounded reading for two manually entered people when the model is unavailable', async () => {
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

    expect(result.status).toBe(200);
    expect(result.payload).toMatchObject({
      fromCache: false,
      result: {
        summary: expect.any(String),
        fullAnalysis: {
          attraction: expect.any(String),
          difficulties: expect.any(String),
          recommendations: expect.any(Array),
          potential: expect.any(String),
        },
      },
    });
    expect(result.payload.result.summary).toContain('Анна');
    expect(result.payload.result.summary).toContain('Максим');
  });

  it('delivers a generated reading for two saved charts even when cache persistence fails', async () => {
    mockGetById
      .mockResolvedValueOnce(chart(1))
      .mockResolvedValueOnce(chart(2));
    mockCreateLunaStructuredResponse.mockResolvedValueOnce({
      content: JSON.stringify({
        summary: 'Живой союз с понятной точкой роста.',
        generalTheme: 'Общий ритм.',
        attraction: 'Есть интерес.',
        difficulties: 'Темп решений отличается.',
        recommendations: ['Говорить прямо.', 'Не торопить ответ.', 'Сверять планы.'],
        potential: 'Можно выстроить устойчивую связь.',
        compatibilityScore: 74,
      }),
    });
    mockSynastrySet.mockRejectedValueOnce(new Error('cache table unavailable'));

    const result = await post({
      subjectChartId: 1,
      partnerChartId: 2,
      relationshipType: 'романтика',
      language: 'ru',
    });

    expect(result.status).toBe(200);
    expect(result.payload.result.summary).toBe('Живой союз с понятной точкой роста.');
  });

  it('builds a premium hybrid from a date-only person and a zodiac-sign person', async () => {
    mockCreateLunaStructuredResponse.mockRejectedValueOnce(new Error('model unavailable'));

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

    expect(result.status).toBe(200);
    expect(result.payload).toMatchObject({
      calculationLevel: 'hybrid_sign',
      result: {
        summary: expect.any(String),
        fullAnalysis: {
          attraction: expect.any(String),
          difficulties: expect.any(String),
        },
      },
    });
    expect(mockCalculateNatalChart).toHaveBeenCalledTimes(1);
    expect(mockCalculateNatalChart).toHaveBeenCalledWith(
      expect.any(String),
      '1989-03-06',
      '',
      expect.any(String),
      expect.objectContaining({
        birthTimeMode: 'unknown',
        coordinates: { lat: 0, lon: 0, timezone: 'UTC' },
      }),
    );
  });
});
