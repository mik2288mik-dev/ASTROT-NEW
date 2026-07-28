const mockEnsureValidContext = jest.fn();
const mockResolveReadingContext = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockListQuestions = jest.fn();
const mockGetUsage = jest.fn();
const mockListUnread = jest.fn();
const mockListExistingCustom = jest.fn();
const mockReserveQuestion = jest.fn();
const mockCompleteAnswer = jest.fn();
const mockGetCachedForecast = jest.fn();
const mockGenerateAnswer = jest.fn();
const mockClaimGeneration = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));
jest.mock('../lib/natalReading/apiHelper', () => ({
  ensureValidContext: (...args: unknown[]) => mockEnsureValidContext(...args),
  resolveReadingContext: (...args: unknown[]) =>
    mockResolveReadingContext(...args),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: (...args: unknown[]) =>
    mockGetPremiumEntitlementState(...args),
}));
jest.mock('../lib/personalForecastCache', () => ({
  getCachedPersonalForecast: (...args: unknown[]) =>
    mockGetCachedForecast(...args),
}));
jest.mock('../lib/personalForecastQuestionGeneration', () => ({
  PERSONAL_FORECAST_QUESTION_PROMPT_VERSION:
    'personal-forecast-question.v4.concise-answer+voice.1',
  generatePersonalForecastQuestionAnswer: (...args: unknown[]) =>
    mockGenerateAnswer(...args),
}));
jest.mock('../lib/personalForecastQuestionStore', () => {
  const actual = jest.requireActual('../lib/personalForecastQuestionStore');
  return {
    ...actual,
    claimPersonalForecastQuestionGeneration: (...args: unknown[]) =>
      mockClaimGeneration(...args),
    completePersonalForecastQuestionAnswer: (...args: unknown[]) =>
      mockCompleteAnswer(...args),
    failPersonalForecastQuestionGeneration: jest.fn(async () => undefined),
    getPersonalForecastQuestionById: jest.fn(),
    getPersonalForecastQuestionUsage: (...args: unknown[]) =>
      mockGetUsage(...args),
    listExistingCustomQuestionTexts: (...args: unknown[]) =>
      mockListExistingCustom(...args),
    listPersonalForecastQuestions: (...args: unknown[]) =>
      mockListQuestions(...args),
    listUnreadPersonalForecastQuestionNotifications: (...args: unknown[]) =>
      mockListUnread(...args),
    markPersonalForecastQuestionRead: jest.fn(),
    reservePersonalForecastQuestion: (...args: unknown[]) =>
      mockReserveQuestion(...args),
  };
});

import handler, {
  parsePersonalForecastQuestionAction,
  parsePersonalForecastQuestionPeriod,
  serializePersonalForecastQuestion,
} from '../pages/api/content/forecast/questions';
import {
  chartFixture,
  personalForecastFixture,
} from './personal-forecast-fixture';
import type { StoredPersonalForecastQuestion } from '../lib/personalForecastQuestionStore';
import { buildPersonalForecastChartFingerprint } from '../lib/personalForecastContract';
import type { NextApiRequest, NextApiResponse } from 'next';

function questionRow(
  overrides: Partial<StoredPersonalForecastQuestion> = {},
): StoredPersonalForecastQuestion {
  return {
    id: 51,
    userId: '1001',
    chartId: 7,
    chartFingerprint: buildPersonalForecastChartFingerprint(chartFixture),
    forecastInputHash: 'forecast-input-v1',
    period: 'month',
    periodKey: '2026-07',
    usageDate: '2026-07-27',
    language: 'ru',
    source: 'custom',
    catalogQuestionId: null,
    questionText: 'Что стоит проверить в этой ситуации?',
    normalizedQuestion: 'что стоит проверить в этой ситуации',
    status: 'pending',
    moderationReason: 'needs_manual_review',
    moderationSuggestions: [],
    answerText: null,
    answerMeta: null,
    modelId: null,
    promptVersion: 'personal-forecast-question.v4.concise-answer+voice.1',
    voiceVersion: '1',
    generationStartedAt: null,
    answeredAt: null,
    moderatedBy: null,
    moderatedAt: null,
    notificationUnread: false,
    notificationPayload: null,
    readAt: null,
    lastError: null,
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    ...overrides,
  };
}

function responseMock(): {
  res: NextApiResponse;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn();
  const res = { status, json } as unknown as NextApiResponse;
  status.mockImplementation(() => res);
  return { res, status, json };
}

function context() {
  return {
    userId: '1001',
    ctx: {
      user: { id: '1001' },
      profile: {
        id: '1001',
        name: 'Мира',
        language: 'ru',
        birthTimezone: 'Europe/Moscow',
      },
      chartId: 7,
      chartData: chartFixture,
    },
  };
}

const usage = {
  usageDate: '2026-07-27',
  answersUsed: 1,
  answersRemaining: 19,
  answerLimit: 20,
  customUsed: 1,
  customRemaining: 2,
  customLimit: 3,
};

describe('personal forecast questions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureValidContext.mockResolvedValue(context());
    mockResolveReadingContext.mockResolvedValue(context().ctx);
    mockClaimGeneration.mockResolvedValue(null);
    mockGetPremiumEntitlementState.mockResolvedValue({
      isPremium: true,
      entitlement: null,
    });
    mockListQuestions.mockResolvedValue([]);
    mockGetUsage.mockResolvedValue(usage);
    mockListUnread.mockResolvedValue([]);
    mockListExistingCustom.mockResolvedValue([]);
    mockGetCachedForecast.mockResolvedValue({
      forecast: personalForecastFixture(),
      model: 'gpt-4.1',
      cacheKey: 'forecast-cache-v1',
      inputHash: 'forecast-input-v1',
    });
  });

  it('parses only the documented periods and actions', () => {
    expect(parsePersonalForecastQuestionPeriod('month')).toBe('month');
    expect(parsePersonalForecastQuestionPeriod('quarter')).toBeNull();
    expect(parsePersonalForecastQuestionAction('submit_custom'))
      .toBe('submit_custom');
    expect(parsePersonalForecastQuestionAction('chat')).toBeNull();
  });

  it('exposes retry only after a generating lease becomes stale', () => {
    const fresh = questionRow({
      status: 'generating',
      generationStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const stale = questionRow({
      status: 'generating',
      generationStartedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    });

    expect(serializePersonalForecastQuestion(fresh).canRetry).toBe(false);
    expect(serializePersonalForecastQuestion(stale).canRetry).toBe(true);
  });

  it('reads quota usage in the primary chart timezone, not the selected chart timezone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-28T02:00:00.000Z'));
    try {
      const selected = context();
      selected.ctx.chartData = {
        ...chartFixture,
        timezone: 'Asia/Tokyo',
      };
      mockEnsureValidContext.mockResolvedValue(selected);
      mockResolveReadingContext.mockResolvedValue({
        ...selected.ctx,
        profile: {
          ...selected.ctx.profile,
          birthTimezone: undefined,
        },
        chartData: {
          ...chartFixture,
          timezone: 'America/New_York',
        },
      });
      const { res } = responseMock();
      const req = {
        method: 'GET',
        query: {
          userId: '1001',
          period: 'month',
          periodKey: '2026-07',
        },
        headers: {},
      } as unknown as NextApiRequest;

      await handler(req, res);

      expect(mockResolveReadingContext).toHaveBeenCalledWith('1001', null);
      expect(mockGetUsage).toHaveBeenCalledWith('1001', '2026-07-27');
    } finally {
      jest.useRealTimers();
    }
  });

  it('loads period questions and notifications with the current full identity', async () => {
    const current = questionRow({
      status: 'answered',
      answerText: 'Current answer.',
      answeredAt: '2026-07-27T10:01:00.000Z',
      notificationUnread: true,
    });
    const stale = questionRow({
      id: 52,
      forecastInputHash: 'forecast-input-old',
      status: 'answered',
      answerText: 'Stale answer.',
      answeredAt: '2026-07-27T10:01:00.000Z',
      notificationUnread: true,
    });
    mockListQuestions.mockResolvedValue([current]);
    mockListUnread.mockResolvedValue([current, stale]);
    const { res, json } = responseMock();
    const req = {
      method: 'GET',
      query: {
        userId: '1001',
        period: 'month',
        periodKey: '2026-07',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(mockListQuestions).toHaveBeenCalledWith(expect.objectContaining({
      userId: '1001',
      period: 'month',
      periodKey: '2026-07',
      identity: expect.objectContaining({
        chartFingerprint: buildPersonalForecastChartFingerprint(chartFixture),
        forecastInputHash: 'forecast-input-v1',
        language: 'ru',
        promptVersion: 'personal-forecast-question.v4.concise-answer+voice.1',
        voiceVersion: '1',
      }),
    }));
    expect(mockListUnread).toHaveBeenCalledWith(expect.objectContaining({
      identity: expect.objectContaining({
        chartFingerprint: buildPersonalForecastChartFingerprint(chartFixture),
        language: 'ru',
        promptVersion: 'personal-forecast-question.v4.concise-answer+voice.1',
        voiceVersion: '1',
      }),
    }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      unreadNotifications: [
        expect.objectContaining({ questionId: current.id }),
      ],
    }));
  });

  it('enforces Premium before reading question history', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({
      isPremium: false,
      entitlement: null,
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET',
      query: {
        userId: '1001',
        period: 'day',
        periodKey: '2026-07-27',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
    }));
    expect(mockListQuestions).not.toHaveBeenCalled();
  });

  it('keeps a doubtful custom question pending and returns 202 with suggestions', async () => {
    const pending = questionRow();
    mockReserveQuestion.mockResolvedValue({
      question: pending,
      created: true,
      usage,
    });
    mockListQuestions.mockResolvedValue([pending]);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: '1001',
        chartId: 7,
        period: 'month',
        periodKey: '2026-07',
        action: 'submit_custom',
        question: 'Что стоит проверить в этой ситуации?',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(202);
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      question: expect.objectContaining({ status: 'pending' }),
      moderation: expect.objectContaining({
        status: 'pending',
        reason: 'needs_manual_review',
      }),
    }));
  });

  it('does not reserve or generate a new question for an arbitrary period key', async () => {
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: '1001',
        chartId: 7,
        period: 'month',
        periodKey: '2099-01',
        action: 'submit_custom',
        question: 'What should I review in this situation?',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PERSONAL_FORECAST_QUESTION_PERIOD_KEY_INVALID',
    }));
    expect(mockReserveQuestion).not.toHaveBeenCalled();
    expect(mockGenerateAnswer).not.toHaveBeenCalled();
  });

  it('generates and saves an obviously relevant custom question immediately', async () => {
    const generating = questionRow({
      questionText:
        'Как удалённый формат влияет на мою результативность в этом месяце?',
      normalizedQuestion:
        'как удаленный формат влияет на мою результативность в этом месяце',
      status: 'generating',
      moderationReason: 'relevant',
      generationStartedAt: '2026-07-27T10:00:00.000Z',
    });
    const answered = questionRow({
      ...generating,
      status: 'answered',
      answerText:
        'Удалённый формат подходит для задач с измеримым результатом.',
      answerMeta: { evidenceIds: ['e1'] },
      answeredAt: '2026-07-27T10:01:00.000Z',
    });
    mockReserveQuestion.mockResolvedValue({
      question: generating,
      created: true,
      usage,
    });
    mockGetCachedForecast.mockResolvedValue({
      forecast: personalForecastFixture(),
      model: 'gpt-4.1',
      cacheKey: 'forecast-cache-v1',
      inputHash: 'forecast-input-v1',
    });
    mockGenerateAnswer.mockResolvedValue({
      answer: answered.answerText,
      evidenceIds: ['e1'],
      model: 'gpt-4.1',
      promptVersion: generating.promptVersion,
      voiceVersion: '1',
      generatedAt: answered.answeredAt,
    });
    mockCompleteAnswer.mockResolvedValue(answered);
    mockListQuestions.mockResolvedValue([answered]);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: '1001',
        chartId: 7,
        period: 'month',
        periodKey: '2026-07',
        action: 'submit_custom',
        question:
          'Как удалённый формат влияет на мою результативность в этом месяце?',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
    expect(mockCompleteAnswer).toHaveBeenCalledWith(expect.objectContaining({
      id: generating.id,
      notificationUnread: false,
    }));
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      question: expect.objectContaining({
        status: 'answered',
        answer: answered.answerText,
      }),
    }));
  });

  it('reclaims a stale generating catalog question instead of leaving it stuck', async () => {
    const generating = questionRow({
      source: 'catalog',
      catalogQuestionId: 'pfq_029_work_priority',
      questionText: 'What matters most in my work right now?',
      normalizedQuestion: 'what matters most in my work right now',
      status: 'generating',
      generationStartedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      moderationReason: 'catalog_approved',
    });
    const answered = questionRow({
      ...generating,
      status: 'answered',
      answerText: 'The saved evidence supports one clear work priority now.',
      answerMeta: { evidenceIds: ['e1'] },
      answeredAt: new Date().toISOString(),
    });
    mockReserveQuestion.mockResolvedValue({
      question: generating,
      created: false,
      usage,
    });
    mockClaimGeneration.mockResolvedValue(generating);
    mockGenerateAnswer.mockResolvedValue({
      answer: answered.answerText,
      evidenceIds: ['e1'],
      model: 'gpt-4.1',
      promptVersion: generating.promptVersion,
      voiceVersion: generating.voiceVersion,
      generatedAt: answered.answeredAt,
    });
    mockCompleteAnswer.mockResolvedValue(answered);
    mockListQuestions.mockResolvedValue([answered]);
    const { res, status } = responseMock();
    const req = {
      method: 'POST',
      query: {},
      body: {
        userId: '1001',
        chartId: 7,
        period: 'month',
        periodKey: '2026-07',
        action: 'answer_catalog',
        questionId: 'pfq_029_work_priority',
      },
      headers: {},
    } as unknown as NextApiRequest;

    await handler(req, res);

    expect(mockClaimGeneration).toHaveBeenCalledWith({
      id: generating.id,
      userId: '1001',
    });
    expect(mockGenerateAnswer).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(200);
  });
});
