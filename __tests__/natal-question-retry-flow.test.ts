jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));

jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: jest.fn(async () => ({ isPremium: true })),
}));

jest.mock('../lib/personalForecastContract', () => ({
  getPersonalForecastPeriodKey: jest.fn(() => '2026-08-30'),
  normalizeForecastTimezone: jest.fn((value: string) => value || 'Europe/Moscow'),
}));

jest.mock('../lib/natalReading/apiHelper', () => ({
  ensureValidContext: jest.fn(async () => ({
    userId: 'user-1',
    ctx: {
      chartId: 7,
      chartSubjectType: 'self',
      profile: {
        language: 'ru',
        birthTimezone: 'Europe/Moscow',
      },
      chartData: { timezone: 'Europe/Moscow' },
    },
  })),
  resolveReadingContext: jest.fn(async () => ({
    profile: { birthTimezone: 'Europe/Moscow' },
    chartData: { timezone: 'Europe/Moscow' },
  })),
}));

jest.mock('../lib/natalReading/permanentApi', () => ({
  generatePermanentPremiumWithLock: jest.fn(),
  getCachedPermanentPremiumReport: jest.fn(),
  waitForPermanentPremiumReport: jest.fn(),
}));

jest.mock('../lib/natalReading/natalQuestion', () => {
  class NatalQuestionValidationError extends Error {
    validationCodes = ['test'];
    attempts = 1;
  }
  return {
    generateNatalQuestionAnswer: jest.fn(),
    moderateNatalQuestion: jest.fn(() => ({ status: 'approved' })),
    NATAL_QUESTION_IDENTITY: {
      contractVersion: 'test-contract',
      promptVersion: 'test-prompt',
      voiceVersion: 'test-voice',
    },
    NatalQuestionValidationError,
  };
});

jest.mock('../lib/personalForecastQuestionModeration', () => ({
  normalizePersonalForecastQuestionInput: jest.fn((value: unknown) => String(value || '').trim()),
}));

jest.mock('../lib/personalForecastQuestionCatalog', () => ({
  normalizePersonalForecastQuestionSearch: jest.fn((value: string) => value.toLocaleLowerCase()),
}));

jest.mock('../lib/contentGenerationLock', () => ({
  generationInProgressPayload: jest.fn((retryAfterMs: number) => ({ retryAfterMs })),
  withContentGenerationLock: jest.fn(async () => ({
    status: 'ready',
    value: {
      id: 12,
      threadId: 91,
      userId: 'user-1',
      chartId: 7,
      role: 'assistant',
      text: 'Готовый ответ.',
      payload: { generationAttempts: 1 },
      createdAt: '2026-08-30T10:01:00.000Z',
    },
    fromCache: true,
    source: 'test-thread',
  })),
}));

jest.mock('../lib/diagnosticTrace', () => ({
  diagnosticErrorCode: jest.fn((_error: unknown, fallback: string) => fallback),
}));

jest.mock('../lib/serverOperationalDiagnostics', () => ({
  startServerOperationalDiagnostic: jest.fn(() => ({
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../lib/db';
import { moderateNatalQuestion } from '../lib/natalReading/natalQuestion';
import {
  answeredNatalQuestionTexts,
  reserveNatalQuestionMessage,
  type NatalQuestionStoredMessage,
} from '../lib/natalReading/natalQuestionStore';
import * as natalQuestionStore from '../lib/natalReading/natalQuestionStore';
import handler from '../pages/api/content/natal/questions';

const pendingQuestion: NatalQuestionStoredMessage = {
  id: 11,
  threadId: 91,
  userId: 'user-1',
  chartId: 7,
  role: 'user',
  text: 'Почему я откладываю важные решения?',
  payload: {
    normalizedQuestion: 'почему я откладываю важные решения?',
    usageDate: '2026-08-30',
  },
  createdAt: '2026-08-30T10:00:00.000Z',
};

const answeredQuestion: NatalQuestionStoredMessage = {
  ...pendingQuestion,
  id: 8,
  text: 'Как я обычно принимаю решения?',
  createdAt: '2026-08-29T10:00:00.000Z',
};

const answeredMessage: NatalQuestionStoredMessage = {
  ...pendingQuestion,
  id: 9,
  role: 'assistant',
  text: 'Ты сначала собираешь факты.',
  payload: { questionMessageId: 8 },
  createdAt: '2026-08-29T10:01:00.000Z',
};

function responseHarness() {
  const result: { status?: number; body?: unknown } = {};
  const response = {
    statusCode: 200,
    status: jest.fn((status: number) => {
      result.status = status;
      response.statusCode = status;
      return response;
    }),
    json: jest.fn((body: unknown) => {
      result.body = body;
      return response;
    }),
  } as unknown as NextApiResponse;
  return { response, result };
}

describe('natal unanswered-question retry flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uses only answered questions as duplicate-moderation history', () => {
    expect(answeredNatalQuestionTexts([
      answeredQuestion,
      answeredMessage,
      pendingQuestion,
    ])).toEqual(['Как я обычно принимаю решения?']);
  });

  it('reuses the exact pending message before a full-quota check or insert', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('NOT EXISTS (')) {
          return {
            rows: [{
              id: pendingQuestion.id,
              thread_id: pendingQuestion.threadId,
              user_id: pendingQuestion.userId,
              subject_chart_id: pendingQuestion.chartId,
              role: pendingQuestion.role,
              content_text: pendingQuestion.text,
              content_payload: pendingQuestion.payload,
              created_at: pendingQuestion.createdAt,
            }],
          };
        }
        if (sql.includes('COUNT(*)::int AS used')) return { rows: [{ used: 5 }] };
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (getPool as jest.Mock).mockReturnValue({
      connect: jest.fn(async () => client),
      query: client.query,
    });

    const result = await reserveNatalQuestionMessage({
      userId: 'user-1',
      chartId: 7,
      threadId: 91,
      text: pendingQuestion.text,
      normalizedQuestion: 'почему я откладываю важные решения?',
      usageDate: '2026-08-30',
      timezone: 'Europe/Moscow',
    });

    expect(result).toMatchObject({
      created: false,
      message: { id: 11, threadId: 91 },
      usage: { used: 5, remaining: 0 },
    });
    expect(queries.some((sql) => sql.includes('INSERT INTO astrology_messages'))).toBe(false);
    expect(queries.indexOf('COMMIT')).toBeGreaterThan(
      queries.findIndex((sql) => sql.includes('NOT EXISTS (')),
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('passes a restored unanswered retry through POST without charging another slot', async () => {
    jest.spyOn(natalQuestionStore, 'listNatalQuestionMessages')
      .mockResolvedValue([answeredQuestion, answeredMessage, pendingQuestion]);
    jest.spyOn(natalQuestionStore, 'getNatalQuestionUsage').mockResolvedValue({
      usageDate: '2026-08-30',
      used: 5,
      limit: 5,
      remaining: 0,
    });
    jest.spyOn(natalQuestionStore, 'ensureNatalQuestionThread').mockResolvedValue(91);
    const reserve = jest.spyOn(natalQuestionStore, 'reserveNatalQuestionMessage')
      .mockResolvedValue({
        message: pendingQuestion,
        usage: {
          usageDate: '2026-08-30',
          used: 5,
          limit: 5,
          remaining: 0,
        },
        created: false,
      });
    const request = {
      method: 'POST',
      body: { question: pendingQuestion.text },
    } as NextApiRequest;
    const { response, result } = responseHarness();

    await handler(request, response);

    expect(result.status).toBe(200);
    expect(moderateNatalQuestion).toHaveBeenCalledWith(expect.objectContaining({
      question: pendingQuestion.text,
      existingQuestions: ['Как я обычно принимаю решения?'],
    }));
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      chartId: 7,
      threadId: 91,
      text: pendingQuestion.text,
      normalizedQuestion: 'почему я откладываю важные решения?',
    }));
  });
});
