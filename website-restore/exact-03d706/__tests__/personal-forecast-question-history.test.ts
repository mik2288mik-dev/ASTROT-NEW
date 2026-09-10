const mockPoolQuery = jest.fn();
const mockCreateThread = jest.fn();
const mockAppendMessage = jest.fn();
const mockGetHistoryContext = jest.fn();
const mockAppendArtifact = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockPoolQuery(...args) }),
}));

jest.mock('../lib/astrologyHistoryStore', () => ({
  appendAstrologyMessage: (...args: unknown[]) => mockAppendMessage(...args),
  appendGeneratedArtifact: (...args: unknown[]) => mockAppendArtifact(...args),
  createAstrologyThread: (...args: unknown[]) => mockCreateThread(...args),
  getAstrologyHistoryContext: (...args: unknown[]) =>
    mockGetHistoryContext(...args),
}));

jest.mock('../lib/appSettings', () => ({
  getUnifiedContentModel: jest.fn(async () => 'gpt-4.1'),
}));

import {
  appendPersonalForecastQuestionAnswerHistory,
  preparePersonalForecastQuestionHistory,
  type PersonalForecastQuestionAnswer,
} from '../lib/personalForecastQuestionGeneration';
import type { AstrologyHistoryContext } from '../lib/astrologyHistoryStore';

const emptyHistory = {
  calculations: [],
  explicitFacts: [],
  userMessages: [],
  artifactContinuity: [],
} as AstrologyHistoryContext;

const generated: PersonalForecastQuestionAnswer = {
  answer: 'A compact validated answer for display.',
  semanticFactIds: ['fact:communication'],
  evidenceIds: ['e1'],
  atomIds: ['details_require_review'],
  domainKeys: ['communication_decisions'],
  personalizationFactKeys: [],
  userMessageIds: ['501'],
  semanticFingerprints: ['semantic:communication'],
  model: 'gpt-4.1',
  promptVersion: 'personal-forecast-question.v6.responses-strict-schema+voice.8',
  voiceVersion: '3',
  generationAttempts: 1,
  generatedAt: '2026-08-02T10:00:00.000Z',
};

describe('personal forecast question durable history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendMessage.mockResolvedValue({ id: 501 });
    mockGetHistoryContext.mockResolvedValue(emptyHistory);
  });

  it('reuses the question thread and appends the user message only once', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 81 }] })
      .mockResolvedValueOnce({ rows: [] });

    const session = await preparePersonalForecastQuestionHistory({
      userId: '1001',
      chartId: 7,
      questionRecordId: 51,
      question: 'What should I verify?',
      period: 'day',
      periodKey: '2026-08-02',
      source: 'custom',
    });

    expect(session.threadId).toBe(81);
    expect(mockCreateThread).not.toHaveBeenCalled();
    expect(mockAppendMessage).toHaveBeenCalledWith(expect.objectContaining({
      userId: '1001',
      threadId: 81,
      role: 'user',
      contentText: 'What should I verify?',
      provenance: expect.objectContaining({
        questionRecordId: 51,
        userAuthored: true,
      }),
    }));
    expect(mockGetHistoryContext).toHaveBeenCalledWith(expect.objectContaining({
      userId: '1001',
      subjectChartId: 7,
      messageLimit: 10,
    }));

    jest.clearAllMocks();
    mockGetHistoryContext.mockResolvedValue(emptyHistory);
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: 81 }] })
      .mockResolvedValueOnce({ rows: [{ id: 501 }] });
    await preparePersonalForecastQuestionHistory({
      userId: '1001',
      chartId: 7,
      questionRecordId: 51,
      question: 'What should I verify?',
      period: 'day',
      periodKey: '2026-08-02',
      source: 'custom',
    });
    expect(mockAppendMessage).not.toHaveBeenCalled();
  });

  it('stores answer prose only as a display artifact and links it to the calculation and assistant message', async () => {
    const history = {
      ...emptyHistory,
      calculations: [{
        id: 301,
        surface: 'forecast',
        period: 'day',
        periodKey: '2026-08-02',
        inputHash: 'forecast-input-v4',
      }],
    } as unknown as AstrologyHistoryContext;
    mockAppendArtifact.mockResolvedValue({ id: 401 });
    mockAppendMessage.mockResolvedValue({ id: 502 });

    const result = await appendPersonalForecastQuestionAnswerHistory({
      userId: '1001',
      chartId: 7,
      questionRecordId: 51,
      source: 'catalog',
      period: 'day',
      periodKey: '2026-08-02',
      forecastInputHash: 'forecast-input-v4',
      language: 'en',
      session: { threadId: 81, historyContext: history },
      generated,
    });

    expect(mockAppendArtifact).toHaveBeenCalledWith(expect.objectContaining({
      subjectChartId: 7,
      calculationSnapshotId: 301,
      surface: 'question',
      validationStatus: 'valid',
      generationAttempts: 1,
      semanticFingerprints: ['semantic:communication'],
      provenance: expect.objectContaining({
        displayOnly: true,
        isFactualEvidence: false,
      }),
    }));
    expect(mockAppendMessage).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 81,
      role: 'assistant',
      generatedArtifactId: 401,
      contentText: generated.answer,
      provenance: expect.objectContaining({
        displayOnly: true,
        isFactualEvidence: false,
      }),
    }));
    expect(result).toEqual({ generatedArtifactId: 401, threadId: 81 });
  });
});
