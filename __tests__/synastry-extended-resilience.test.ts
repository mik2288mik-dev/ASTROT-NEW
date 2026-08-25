import type { NextApiRequest, NextApiResponse } from 'next';

const mockCreateLunaStructuredResponse = jest.fn();
const mockGetById = jest.fn();
const mockSynastryGet = jest.fn();
const mockSynastrySet = jest.fn();
const mockUpsertByChart = jest.fn();
const mockCalculateNatalChart = jest.fn();

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

jest.mock('../lib/swisseph-calculator', () => ({
  calculateNatalChart: (...args: unknown[]) => mockCalculateNatalChart(...args),
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
    mockSynastryGet.mockResolvedValue(null);
    mockSynastrySet.mockResolvedValue({ success: true });
    mockUpsertByChart.mockResolvedValue({ id: 9 });
    mockCalculateNatalChart.mockResolvedValue(chart());
  });

  it('returns a data-grounded reading for two manually entered people when the model is unavailable', async () => {
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
    expect(mockCalculateNatalChart).toHaveBeenCalledTimes(2);
    expect(mockCalculateNatalChart).toHaveBeenCalledWith('Анна', '1992-03-14', '09:30', 'Москва', expect.objectContaining({ birthTimeMode: 'exact' }));
  });

  it('delivers a generated reading for two saved charts even when cache persistence fails', async () => {
    mockGetById
      .mockResolvedValueOnce(chart(1))
      .mockResolvedValueOnce(chart(2));
    mockCreateLunaStructuredResponse.mockResolvedValueOnce({
      content: JSON.stringify({
        summary: 'Анна и Максим быстро находят общий ритм, когда решают один конкретный вопрос. Но под давлением один ускоряется, а второму нужна пауза; связь удерживает ясная договорённость о следующем шаге.',
        sections: [{ id: 'between_you', text: 'Один быстрее задаёт направление, второй проверяет, не потерялись ли важные детали. Такой обмен помогает двигаться без суеты, пока решение не выдают за уже согласованное.' }],
        closing: {
          strength: 'Они соединяют инициативу одного и внимательность другого к важным деталям.',
          risk: 'Разный темп решения превращает уточнение в торможение, а инициативу — в давление.',
          action: 'Называть момент, когда обсуждение действительно стало общим решением.',
        },
        compatibilityScore: 1,
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
    expect(result.payload.result.summary).toContain('Анна и Максим');
    expect(result.payload.result.closing.action).toContain('общим решением');
    expect(result.payload.result.schemaVersion).toBe('compatibility-v2');
    expect(result.payload.result.overallScore).not.toBe(1);
    expect(mockCalculateNatalChart).not.toHaveBeenCalled();
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
  });

  it('keeps manual unknown birth time reduced and passes unknown mode to Swiss calculation', async () => {
    mockCreateLunaStructuredResponse.mockRejectedValueOnce(new Error('model unavailable'));

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
    expect(mockCalculateNatalChart).toHaveBeenCalledWith('Анна', '1992-03-14', '', 'Москва', expect.objectContaining({ birthTimeMode: 'unknown' }));
    expect(result.payload.result.evidence.some((item: any) => item.type === 'house_overlay')).toBe(false);
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
});
