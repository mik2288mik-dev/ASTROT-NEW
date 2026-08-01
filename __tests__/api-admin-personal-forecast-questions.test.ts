const mockRequireAdminPermission = jest.fn();
const mockRecordAdminAction = jest.fn();
const mockListQuestions = jest.fn();
const mockGetQuestion = jest.fn();
const mockModeratePending = jest.fn();
const mockCompleteAnswer = jest.fn();
const mockFailGeneration = jest.fn();
const mockResolveReadingContext = jest.fn();
const mockGetCachedForecast = jest.fn();
const mockGenerateAnswer = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));
jest.mock('../lib/admin/rbac', () => ({
  requireAdminPermission: (...args: unknown[]) =>
    mockRequireAdminPermission(...args),
}));
jest.mock('../lib/admin/audit', () => ({
  recordAdminAction: (...args: unknown[]) => mockRecordAdminAction(...args),
}));
jest.mock('../lib/natalReading/apiHelper', () => ({
  resolveReadingContext: (...args: unknown[]) =>
    mockResolveReadingContext(...args),
}));
jest.mock('../lib/personalForecastCache', () => ({
  getCachedPersonalForecast: (...args: unknown[]) =>
    mockGetCachedForecast(...args),
}));
jest.mock('../lib/personalForecastQuestionGeneration', () => ({
  PERSONAL_FORECAST_QUESTION_PROMPT_VERSION:
    'personal-forecast-question.v4.concise-answer+voice.3',
  generatePersonalForecastQuestionAnswer: (...args: unknown[]) =>
    mockGenerateAnswer(...args),
}));
jest.mock('../lib/personalForecastQuestionStore', () => ({
  claimPersonalForecastQuestionGeneration: jest.fn(),
  completePersonalForecastQuestionAnswer: (...args: unknown[]) =>
    mockCompleteAnswer(...args),
  failPersonalForecastQuestionGeneration: (...args: unknown[]) =>
    mockFailGeneration(...args),
  getPersonalForecastQuestionById: (...args: unknown[]) =>
    mockGetQuestion(...args),
  listAdminPersonalForecastQuestions: (...args: unknown[]) =>
    mockListQuestions(...args),
  moderatePendingPersonalForecastQuestion: (...args: unknown[]) =>
    mockModeratePending(...args),
}));

import detailHandler from '../pages/api/admin/v2/forecast-questions/[id]';
import listHandler from '../pages/api/admin/v2/forecast-questions';
import {
  chartFixture,
  personalForecastFixture,
} from './personal-forecast-fixture';
import type { StoredPersonalForecastQuestion } from '../lib/personalForecastQuestionStore';
import { buildPersonalForecastChartFingerprint } from '../lib/personalForecastContract';
import { AdminAuthError } from '../lib/adminAuth';
import type { NextApiRequest, NextApiResponse } from 'next';

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

function question(
  overrides: Partial<StoredPersonalForecastQuestion> = {},
): StoredPersonalForecastQuestion {
  return {
    id: 77,
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
    promptVersion: 'personal-forecast-question.v4.concise-answer+voice.3',
    voiceVersion: '3',
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

function mockRolePermissions(input: {
  role: string;
  permissions: readonly string[];
}) {
  mockRequireAdminPermission.mockImplementation(
    async (_req: NextApiRequest, permission: string) => {
      if (!input.permissions.includes(permission)) {
        throw new AdminAuthError(
          403,
          'PERMISSION_DENIED',
          `Missing permission: ${permission}`,
        );
      }
      return {
        userId: '9001',
        role: input.role,
        isOwner: false,
        permissions: [...input.permissions],
      };
    },
  );
}

describe('admin personal forecast question moderation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRolePermissions({
      role: 'admin',
      permissions: ['content.publish', 'user.pii.view'],
    });
    mockRecordAdminAction.mockResolvedValue(undefined);
    mockFailGeneration.mockResolvedValue(undefined);
    mockResolveReadingContext.mockResolvedValue({
      user: { id: '1001' },
      profile: { id: '1001', name: 'Мира', language: 'ru' },
      chartId: 7,
      chartData: chartFixture,
    });
    mockGetCachedForecast.mockResolvedValue({
      forecast: personalForecastFixture(),
      model: 'gpt-4.1',
      cacheKey: 'forecast-cache-v1',
      inputHash: 'forecast-input-v1',
    });
  });

  it.each(['analyst', 'marketing', 'read_only'])(
    'denies raw list, detail, and moderation actions to %s',
    async (role) => {
      mockRolePermissions({ role, permissions: ['content.view'] });
      mockListQuestions.mockResolvedValue({
        questions: [question()],
        total: 1,
      });
      mockGetQuestion.mockResolvedValue(question());

      const listResponse = responseMock();
      const listRequest = {
        method: 'GET',
        query: {},
        headers: {},
      } as unknown as NextApiRequest;
      await listHandler(listRequest, listResponse.res);

      expect(listResponse.status).toHaveBeenCalledWith(403);
      expect(listResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'PERMISSION_DENIED',
      }));
      expect(mockListQuestions).not.toHaveBeenCalled();

      const detailResponse = responseMock();
      const detailRequest = {
        method: 'GET',
        query: { id: '77' },
        headers: {},
      } as unknown as NextApiRequest;
      await detailHandler(detailRequest, detailResponse.res);

      expect(detailResponse.status).toHaveBeenCalledWith(403);
      expect(detailResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'PERMISSION_DENIED',
      }));

      const actionResponse = responseMock();
      const actionRequest = {
        method: 'POST',
        query: { id: '77' },
        body: { action: 'approve' },
        headers: {},
      } as unknown as NextApiRequest;
      await detailHandler(actionRequest, actionResponse.res);

      expect(actionResponse.status).toHaveBeenCalledWith(403);
      expect(actionResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'PERMISSION_DENIED',
      }));
      expect(mockGetQuestion).not.toHaveBeenCalled();
    },
  );

  it('requires the PII permission even when content publishing is allowed', async () => {
    mockRolePermissions({
      role: 'content_manager',
      permissions: ['content.publish'],
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    } as unknown as NextApiRequest;

    await listHandler(req, res);

    expect(mockRequireAdminPermission.mock.calls).toEqual([
      [req, 'content.publish'],
      [req, 'user.pii.view'],
    ]);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'PERMISSION_DENIED',
    }));
    expect(mockListQuestions).not.toHaveBeenCalled();
  });

  it('returns raw list and detail data only to an authorized moderator', async () => {
    const rawQuestion = question({
      answerText: 'A saved raw answer that remains moderator-only.',
    });
    mockListQuestions.mockResolvedValue({
      questions: [rawQuestion],
      total: 1,
    });
    mockGetQuestion.mockResolvedValue(rawQuestion);

    const listResponse = responseMock();
    const listRequest = {
      method: 'GET',
      query: {},
      headers: {},
    } as unknown as NextApiRequest;
    await listHandler(listRequest, listResponse.res);

    expect(listResponse.status).toHaveBeenCalledWith(200);
    expect(listResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      questions: [rawQuestion],
    }));

    const detailResponse = responseMock();
    const detailRequest = {
      method: 'GET',
      query: { id: '77' },
      headers: {},
    } as unknown as NextApiRequest;
    await detailHandler(detailRequest, detailResponse.res);

    expect(detailResponse.status).toHaveBeenCalledWith(200);
    expect(detailResponse.json).toHaveBeenCalledWith({
      question: rawQuestion,
    });
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      listRequest,
      'content.publish',
    );
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      listRequest,
      'user.pii.view',
    );
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      detailRequest,
      'content.publish',
    );
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      detailRequest,
      'user.pii.view',
    );
  });

  it('generates the answer and creates an unread period deep-link after approval', async () => {
    const pending = question();
    const generating = question({
      status: 'generating',
      moderationReason: 'manual_approved',
      moderatedBy: '9001',
      moderatedAt: '2026-07-27T10:01:00.000Z',
      generationStartedAt: '2026-07-27T10:01:00.000Z',
    });
    const answered = question({
      ...generating,
      status: 'answered',
      answerText: 'Проверить нужно срок и реальную цену решения.',
      answerMeta: { evidenceIds: ['e1'] },
      answeredAt: '2026-07-27T10:02:00.000Z',
      notificationUnread: true,
      notificationPayload: {
        type: 'personal_forecast_question_answer',
        questionId: 77,
        period: 'month',
        periodKey: '2026-07',
      },
    });
    mockGetQuestion.mockResolvedValue(pending);
    mockModeratePending.mockResolvedValue({
      question: generating,
      claimedForGeneration: true,
    });
    mockGenerateAnswer.mockResolvedValue({
      answer: answered.answerText,
      evidenceIds: ['e1'],
      model: 'gpt-4.1',
      promptVersion: generating.promptVersion,
      voiceVersion: '3',
      generatedAt: answered.answeredAt,
    });
    mockCompleteAnswer.mockResolvedValue(answered);
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: { id: '77' },
      body: { action: 'approve' },
      headers: {},
    } as unknown as NextApiRequest;

    await detailHandler(req, res);

    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      req,
      'content.publish',
    );
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      req,
      'user.pii.view',
    );
    expect(mockCompleteAnswer).toHaveBeenCalledWith(expect.objectContaining({
      id: 77,
      notificationUnread: true,
      notificationPayload: {
        type: 'personal_forecast_question_answer',
        questionId: 77,
        period: 'month',
        periodKey: '2026-07',
      },
    }));
    expect(mockRecordAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'content_published',
      entityType: 'personal_forecast_question',
      entityId: 77,
    }));
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      question: answered,
    });
  });
});
