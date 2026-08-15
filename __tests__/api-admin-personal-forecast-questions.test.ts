const mockRequireAdminPermission = jest.fn();
const mockRecordAdminAction = jest.fn();
const mockListQuestions = jest.fn();
const mockGetQuestion = jest.fn();
const mockModeratePending = jest.fn();

jest.mock('../lib/admin/rbac', () => ({
  requireAdminPermission: (...args: unknown[]) =>
    mockRequireAdminPermission(...args),
}));
jest.mock('../lib/admin/audit', () => ({
  recordAdminAction: (...args: unknown[]) => mockRecordAdminAction(...args),
}));
jest.mock('../lib/personalForecastQuestionStore', () => ({
  getPersonalForecastQuestionById: (...args: unknown[]) =>
    mockGetQuestion(...args),
  listAdminPersonalForecastQuestions: (...args: unknown[]) =>
    mockListQuestions(...args),
  moderatePendingPersonalForecastQuestion: (...args: unknown[]) =>
    mockModeratePending(...args),
}));

import detailHandler from '../pages/api/admin/v2/forecast-questions/[id]';
import listHandler from '../pages/api/admin/v2/forecast-questions';
import type { StoredPersonalForecastQuestion } from '../lib/personalForecastQuestionStore';
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
    chartFingerprint: 'legacy-chart',
    forecastInputHash: 'legacy-forecast',
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
    promptVersion: 'legacy-question-prompt',
    voiceVersion: '8',
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

describe('admin retired personal forecast question moderation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRolePermissions({
      role: 'admin',
      permissions: ['content.publish', 'user.pii.view'],
    });
    mockRecordAdminAction.mockResolvedValue(undefined);
  });

  it.each(['analyst', 'marketing', 'read_only'])(
    'denies raw list, detail, and actions to %s',
    async (role) => {
      mockRolePermissions({ role, permissions: ['content.view'] });
      mockListQuestions.mockResolvedValue({ questions: [question()], total: 1 });
      mockGetQuestion.mockResolvedValue(question());

      const listResponse = responseMock();
      const listRequest = {
        method: 'GET',
        query: {},
        headers: {},
      } as unknown as NextApiRequest;
      await listHandler(listRequest, listResponse.res);
      expect(listResponse.status).toHaveBeenCalledWith(403);

      const detailResponse = responseMock();
      const detailRequest = {
        method: 'GET',
        query: { id: '77' },
        headers: {},
      } as unknown as NextApiRequest;
      await detailHandler(detailRequest, detailResponse.res);
      expect(detailResponse.status).toHaveBeenCalledWith(403);

      const actionResponse = responseMock();
      const actionRequest = {
        method: 'POST',
        query: { id: '77' },
        body: { action: 'approve' },
        headers: {},
      } as unknown as NextApiRequest;
      await detailHandler(actionRequest, actionResponse.res);
      expect(actionResponse.status).toHaveBeenCalledWith(403);
    },
  );

  it('returns raw list and detail data only to an authorized moderator', async () => {
    const rawQuestion = question({ answerText: 'Legacy saved answer.' });
    mockListQuestions.mockResolvedValue({ questions: [rawQuestion], total: 1 });
    mockGetQuestion.mockResolvedValue(rawQuestion);

    const listResponse = responseMock();
    const listRequest = {
      method: 'GET',
      query: {},
      headers: {},
    } as unknown as NextApiRequest;
    await listHandler(listRequest, listResponse.res);
    expect(listResponse.status).toHaveBeenCalledWith(200);

    const detailResponse = responseMock();
    const detailRequest = {
      method: 'GET',
      query: { id: '77' },
      headers: {},
    } as unknown as NextApiRequest;
    await detailHandler(detailRequest, detailResponse.res);
    expect(detailResponse.status).toHaveBeenCalledWith(200);
    expect(detailResponse.json).toHaveBeenCalledWith({ question: rawQuestion });
  });

  it.each(['approve', 'retry'])(
    'does not run the removed legacy generator for %s',
    async (action) => {
      mockGetQuestion.mockResolvedValue(question());
      const { res, status, json } = responseMock();
      const req = {
        method: 'POST',
        query: { id: '77' },
        body: { action },
        headers: {},
      } as unknown as NextApiRequest;

      await detailHandler(req, res);

      expect(status).toHaveBeenCalledWith(410);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'PERSONAL_FORECAST_DIALOGUE_RETIRED',
      }));
      expect(mockModeratePending).not.toHaveBeenCalled();
    },
  );

  it('still lets a moderator reject an old pending custom question', async () => {
    const pending = question();
    const rejected = question({ status: 'rejected' });
    mockGetQuestion.mockResolvedValue(pending);
    mockModeratePending.mockResolvedValue({
      question: rejected,
      claimedForGeneration: false,
    });
    const { res, status, json } = responseMock();
    const req = {
      method: 'POST',
      query: { id: '77' },
      body: { action: 'reject' },
      headers: {},
    } as unknown as NextApiRequest;

    await detailHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, question: rejected });
    expect(mockRecordAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'content_reverted',
      entityType: 'personal_forecast_question',
      entityId: 77,
    }));
  });
});
