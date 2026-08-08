jest.mock('../lib/db', () => ({
  getPool: jest.fn(),
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PersonalForecastQuestionLimitError,
  assertPersonalForecastQuestionQuota,
  buildPersonalForecastQuestionUsage,
  isPersonalForecastQuestionGenerationStale,
  listPersonalForecastQuestions,
  listUnreadPersonalForecastQuestionNotifications,
  mapPersonalForecastQuestionRow,
  reservePersonalForecastQuestion,
  type PersonalForecastQuestionDatabase,
} from '../lib/personalForecastQuestionStore';
import {
  PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT,
  PERSONAL_FORECAST_QUESTION_DAILY_LIMIT,
} from '../lib/personalForecastQuestionModeration';

function databaseWith(
  responder: (sql: string, values?: readonly unknown[]) => { rows: any[] },
) {
  const queries: string[] = [];
  const client = {
    query: jest.fn(async (sql: string, values?: readonly unknown[]) => {
      queries.push(sql);
      return responder(sql, values);
    }),
    release: jest.fn(),
  };
  const database = {
    query: client.query,
    connect: jest.fn(async () => client),
  } as unknown as PersonalForecastQuestionDatabase;
  return { database, client, queries };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    user_id: '1001',
    chart_id: 7,
    chart_fingerprint: 'chart-v1',
    forecast_input_hash: 'forecast-input-v1',
    period: 'day',
    period_key: '2026-07-27',
    usage_date: '2026-07-27',
    language: 'ru',
    source: 'catalog',
    catalog_question_id: 'pfq_001_day_focus',
    question_text: 'На чём мне лучше сосредоточиться сегодня?',
    normalized_question: 'на чем мне лучше сосредоточиться сегодня',
    status: 'generating',
    moderation_reason: 'catalog_approved',
    moderation_suggestions: [],
    answer_text: null,
    answer_meta: null,
    model_id: null,
    prompt_version: 'question-v1',
    voice_version: '1',
    generation_started_at: '2026-07-27T10:00:00.000Z',
    answered_at: null,
    moderated_by: null,
    moderated_at: null,
    notification_unread: false,
    notification_payload: null,
    read_at: null,
    last_error: null,
    created_at: '2026-07-27T10:00:00.000Z',
    updated_at: '2026-07-27T10:00:00.000Z',
    ...overrides,
  };
}

const reserveInput = {
  userId: '1001',
  chartId: 7,
  chartFingerprint: 'chart-v1',
  forecastInputHash: 'forecast-input-v1',
  period: 'day' as const,
  periodKey: '2026-07-27',
  usageDate: '2026-07-27',
  language: 'ru' as const,
  source: 'catalog' as const,
  catalogQuestionId: 'pfq_001_day_focus',
  questionText: 'На чём мне лучше сосредоточиться сегодня?',
  normalizedQuestion: 'на чем мне лучше сосредоточиться сегодня',
  status: 'generating' as const,
  moderationReason: 'catalog_approved',
  promptVersion: 'question-v1',
  voiceVersion: '1',
};

describe('personal forecast question store', () => {
  it('calculates the exact 20 answer and 3 custom daily limits', () => {
    const usage = buildPersonalForecastQuestionUsage({
      usageDate: '2026-07-27',
      answersUsed: 19,
      customUsed: 2,
    });

    expect(usage).toEqual({
      usageDate: '2026-07-27',
      answersUsed: 19,
      answersRemaining: 1,
      answerLimit: PERSONAL_FORECAST_QUESTION_DAILY_LIMIT,
      customUsed: 2,
      customRemaining: 1,
      customLimit: PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT,
    });
  });

  it('rejects the 21st answer and the 4th custom submission', () => {
    const answerUsage = buildPersonalForecastQuestionUsage({
      usageDate: '2026-07-27',
      answersUsed: 20,
      customUsed: 2,
    });
    const customUsage = buildPersonalForecastQuestionUsage({
      usageDate: '2026-07-27',
      answersUsed: 10,
      customUsed: 3,
    });

    expect(() => assertPersonalForecastQuestionQuota({
      usage: answerUsage,
      source: 'catalog',
      countsTowardAnswer: true,
    })).toThrow(
      expect.objectContaining({
        code: 'PERSONAL_FORECAST_ANSWER_DAILY_LIMIT',
      }),
    );
    expect(() => assertPersonalForecastQuestionQuota({
      usage: customUsage,
      source: 'custom',
      countsTowardAnswer: true,
    })).toThrow(
      expect.objectContaining({
        code: 'PERSONAL_FORECAST_CUSTOM_DAILY_LIMIT',
      }),
    );
  });

  it('reserves a quota slot under a per-user/day transaction lock', async () => {
    let usageCalls = 0;
    const mock = databaseWith((sql) => {
      if (sql.includes('FROM personal_forecast_questions') && sql.includes('LIMIT 1')) {
        return { rows: [] };
      }
      if (sql.includes('COUNT(*) FILTER')) {
        usageCalls += 1;
        return {
          rows: [{
            answers_used: usageCalls === 1 ? 19 : 20,
            custom_used: 0,
          }],
        };
      }
      if (sql.includes('INSERT INTO personal_forecast_questions')) {
        return { rows: [storedRow()] };
      }
      return { rows: [] };
    });

    const result = await reservePersonalForecastQuestion(
      reserveInput,
      mock.database,
    );

    expect(result.created).toBe(true);
    expect(result.question.id).toBe(41);
    expect(result.usage.answersRemaining).toBe(0);
    expect(
      mock.queries.some((sql) => sql.includes('pg_advisory_xact_lock')),
    ).toBe(true);
    expect(mock.client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['personal-forecast-question:1001:2026-07-27'],
    );
    expect(
      mock.queries.some((sql) => sql.includes("thread.thread_kind = 'natal-question-v1'")),
    ).toBe(true);
    expect(mock.queries).toContain('COMMIT');
    expect(mock.client.release).toHaveBeenCalledTimes(1);
  });

  it('reuses the saved question before checking a full daily quota', async () => {
    const answered = storedRow({
      status: 'answered',
      answer_text: 'Сохранённый ответ остаётся доступен.',
      answered_at: '2026-07-27T10:01:00.000Z',
    });
    const mock = databaseWith((sql) => {
      if (sql.includes('FROM personal_forecast_questions') && sql.includes('LIMIT 1')) {
        return { rows: [answered] };
      }
      if (sql.includes('COUNT(*) FILTER')) {
        return { rows: [{ answers_used: 20, custom_used: 3 }] };
      }
      return { rows: [] };
    });

    const result = await reservePersonalForecastQuestion(
      reserveInput,
      mock.database,
    );

    expect(result.created).toBe(false);
    expect(result.question.status).toBe('answered');
    expect(result.question.answerText).toBe('Сохранённый ответ остаётся доступен.');
    expect(
      mock.queries.some((sql) => sql.includes('INSERT INTO personal_forecast_questions')),
    ).toBe(false);
  });

  it('deduplicates custom questions by forecast and period identity, not usage date', async () => {
    const answered = storedRow({
      source: 'custom',
      catalog_question_id: null,
      status: 'answered',
      answer_text: 'Saved answer.',
      answered_at: '2026-07-27T10:01:00.000Z',
    });
    const mock = databaseWith((sql) => {
      if (sql.includes('FROM personal_forecast_questions') && sql.includes('LIMIT 1')) {
        return { rows: [answered] };
      }
      if (sql.includes('COUNT(*) FILTER')) {
        return { rows: [{ answers_used: 0, custom_used: 0 }] };
      }
      return { rows: [] };
    });

    await reservePersonalForecastQuestion(
      {
        ...reserveInput,
        source: 'custom',
        catalogQuestionId: null,
      },
      mock.database,
    );

    const duplicateQuery = mock.queries.find((sql) => sql.includes('LIMIT 1')) || '';
    expect(duplicateQuery).toContain('forecast_input_hash');
    expect(duplicateQuery).toContain('period_key');
    expect(duplicateQuery).toContain('normalized_question');
    expect(duplicateQuery).not.toContain('usage_date');
  });

  it('maps notification and answer metadata without losing stable IDs', () => {
    const mapped = mapPersonalForecastQuestionRow(storedRow({
      status: 'answered',
      answer_text: 'Готовый ответ.',
      answer_meta: { evidenceIds: ['e1'] },
      answered_at: '2026-07-27T10:01:00.000Z',
      notification_unread: true,
      notification_payload: {
        questionId: 41,
        period: 'day',
        periodKey: '2026-07-27',
      },
    }));

    expect(mapped).toMatchObject({
      id: 41,
      catalogQuestionId: 'pfq_001_day_focus',
      status: 'answered',
      answerMeta: { evidenceIds: ['e1'] },
      notificationUnread: true,
      notificationPayload: {
        questionId: 41,
        period: 'day',
        periodKey: '2026-07-27',
      },
    });
  });

  it('recognizes only expired generating leases as stale', () => {
    const now = new Date('2026-07-27T10:10:00.000Z');
    expect(isPersonalForecastQuestionGenerationStale(
      mapPersonalForecastQuestionRow(storedRow({
        generation_started_at: '2026-07-27T10:04:59.000Z',
      })),
      now,
    )).toBe(true);
    expect(isPersonalForecastQuestionGenerationStale(
      mapPersonalForecastQuestionRow(storedRow({
        generation_started_at: '2026-07-27T10:06:00.000Z',
      })),
      now,
    )).toBe(false);
  });

  it('filters period snapshots and unread rows by their persisted identity', async () => {
    const mock = databaseWith(() => ({ rows: [] }));
    const identity = {
      chartFingerprint: 'chart-v1',
      forecastInputHash: 'forecast-input-v1',
      language: 'ru' as const,
      promptVersion: 'question-v1',
      voiceVersion: '1',
    };

    await listPersonalForecastQuestions({
      userId: '1001',
      period: 'day',
      periodKey: '2026-07-27',
      identity,
      database: mock.database,
    });
    await listUnreadPersonalForecastQuestionNotifications({
      userId: '1001',
      identity,
      database: mock.database,
    });

    const periodQuery = mock.queries[0];
    const unreadQuery = mock.queries[1];
    for (const field of [
      'chart_fingerprint',
      'forecast_input_hash',
      'language',
      'prompt_version',
      'voice_version',
    ]) {
      expect(periodQuery).toContain(field);
    }
    for (const field of [
      'chart_fingerprint',
      'language',
      'prompt_version',
      'voice_version',
    ]) {
      expect(unreadQuery).toContain(field);
    }
    expect(unreadQuery).not.toContain('forecast_input_hash');
  });

  it('preserves quota rows when a natal chart is deleted', () => {
    const migrations = readFileSync(
      join(process.cwd(), 'lib/migrations.ts'),
      'utf8',
    );
    const store = readFileSync(
      join(process.cwd(), 'lib/personalForecastQuestionStore.ts'),
      'utf8',
    );
    expect(migrations).toContain(
      'chart_id BIGINT REFERENCES natal_charts(id) ON DELETE SET NULL',
    );
    expect(store).toContain(
      'WHERE user_id = $1 AND usage_date = $2::date',
    );
    expect(store).not.toContain(
      'WHERE user_id = $1 AND chart_id IS NOT DISTINCT FROM',
    );
  });
});

describe('PersonalForecastQuestionLimitError', () => {
  it('preserves usage data for a 429 API response', () => {
    const usage = buildPersonalForecastQuestionUsage({
      usageDate: '2026-07-27',
      answersUsed: 20,
      customUsed: 3,
    });
    const error = new PersonalForecastQuestionLimitError(
      'PERSONAL_FORECAST_ANSWER_DAILY_LIMIT',
      usage,
    );
    expect(error.usage.answersRemaining).toBe(0);
    expect(error.name).toBe('PersonalForecastQuestionLimitError');
  });
});
