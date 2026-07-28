jest.mock('../services/apiClient', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('../services/sessionService', () => ({
  getTelegramInitDataHeaders: jest.fn(() => ({})),
}));

import type { UserProfile } from '../types';
import { apiFetch } from '../services/apiClient';
import {
  answerApprovedPersonalForecastQuestion,
  clearPersonalForecastQuestionInFlight,
  markPersonalForecastQuestionAnswerRead,
  retryPersonalForecastQuestion,
  submitCustomPersonalForecastQuestion,
} from '../services/personalForecastQuestionService';

const mockedApiFetch = apiFetch as jest.Mock;
const snapshot = {
  catalog: [],
  questions: [],
  usage: {
    usageDate: '2026-07-27',
    answersUsed: 0,
    answersLimit: 20,
    customUsed: 0,
    customLimit: 3,
  },
  unreadNotifications: [],
};

function profile(language: 'ru' | 'en'): UserProfile {
  return {
    id: '42',
    name: 'Test',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    birthPlace: 'Moscow',
    isSetup: true,
    language,
    theme: 'light',
    isPremium: true,
  };
}

function context(chartId: number, language: 'ru' | 'en' = 'ru') {
  return {
    profile: profile(language),
    chartId,
    chartFingerprint: `fingerprint-${chartId}`,
    period: 'day' as const,
    periodKey: '2026-07-27',
  };
}

describe('personal forecast question client in-flight deduplication', () => {
  beforeEach(() => {
    clearPersonalForecastQuestionInFlight();
    mockedApiFetch.mockReset();
    mockedApiFetch.mockImplementation(async () => new Response(
      JSON.stringify(snapshot),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
  });

  it('deduplicates the same catalog mutation in the same full context', async () => {
    const input = { ...context(7), questionId: 'pfq_001' };

    const first = answerApprovedPersonalForecastQuestion(input);
    const second = answerApprovedPersonalForecastQuestion(input);

    expect(first).toBe(second);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    await Promise.all([first, second]);
  });

  it('does not merge catalog mutations from different charts or languages', async () => {
    await Promise.all([
      answerApprovedPersonalForecastQuestion({
        ...context(7, 'ru'),
        questionId: 'pfq_001',
      }),
      answerApprovedPersonalForecastQuestion({
        ...context(8, 'ru'),
        questionId: 'pfq_001',
      }),
      answerApprovedPersonalForecastQuestion({
        ...context(7, 'en'),
        questionId: 'pfq_001',
      }),
    ]);

    expect(mockedApiFetch).toHaveBeenCalledTimes(3);
  });

  it('does not merge requests after the same saved chart is recalculated', async () => {
    await Promise.all([
      answerApprovedPersonalForecastQuestion({
        ...context(7),
        chartFingerprint: 'chart-before-edit',
        questionId: 'pfq_001',
      }),
      answerApprovedPersonalForecastQuestion({
        ...context(7),
        chartFingerprint: 'chart-after-edit',
        questionId: 'pfq_001',
      }),
    ]);

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'custom submission',
      run: (chartId: number) => submitCustomPersonalForecastQuestion({
        ...context(chartId),
        question: 'What should I prioritize?',
      }),
    },
    {
      name: 'retry',
      run: (chartId: number) => retryPersonalForecastQuestion({
        ...context(chartId),
        questionRecordId: 101,
      }),
    },
    {
      name: 'mark-read',
      run: (chartId: number) => markPersonalForecastQuestionAnswerRead({
        ...context(chartId),
        questionRecordId: 101,
      }),
    },
  ])('keeps chart context in the $name mutation key', async ({ run }) => {
    await Promise.all([run(7), run(8)]);

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });
});
