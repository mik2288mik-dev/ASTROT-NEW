import { getPool } from './db';
import {
  PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT,
  PERSONAL_FORECAST_QUESTION_DAILY_LIMIT,
} from './personalForecastQuestionModeration';
import type {
  PersonalForecastQuestionLanguage,
  PersonalForecastQuestionPeriod,
} from './personalForecastQuestionCatalog';

export type PersonalForecastQuestionSource = 'catalog' | 'custom';
export type PersonalForecastQuestionStatus =
  | 'pending'
  | 'approved'
  | 'generating'
  | 'answered'
  | 'rejected';

export type StoredPersonalForecastQuestion = {
  id: number;
  userId: string;
  chartId: number | null;
  chartFingerprint: string;
  forecastInputHash: string;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  usageDate: string;
  language: PersonalForecastQuestionLanguage;
  source: PersonalForecastQuestionSource;
  catalogQuestionId: string | null;
  questionText: string;
  normalizedQuestion: string;
  status: PersonalForecastQuestionStatus;
  moderationReason: string | null;
  moderationSuggestions: unknown[];
  answerText: string | null;
  answerMeta: Record<string, unknown> | null;
  modelId: string | null;
  promptVersion: string;
  voiceVersion: string;
  generationStartedAt: string | null;
  answeredAt: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  notificationUnread: boolean;
  notificationPayload: Record<string, unknown> | null;
  readAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonalForecastQuestionUsage = {
  usageDate: string;
  answersUsed: number;
  answersRemaining: number;
  answerLimit: number;
  customUsed: number;
  customRemaining: number;
  customLimit: number;
};

export const PERSONAL_FORECAST_QUESTION_GENERATION_STALE_MINUTES = 5;

export type PersonalForecastQuestionSnapshotIdentity = {
  chartFingerprint: string;
  forecastInputHash: string;
  language: PersonalForecastQuestionLanguage;
  promptVersion: string;
  voiceVersion: string;
};

export type PersonalForecastQuestionNotificationIdentity = Omit<
  PersonalForecastQuestionSnapshotIdentity,
  'forecastInputHash'
>;

type QueryResultLike = { rows: any[] };
type QuestionStoreClient = {
  query: (text: string, values?: readonly unknown[]) => Promise<QueryResultLike>;
  release: () => void;
};
export type PersonalForecastQuestionDatabase = {
  query: (text: string, values?: readonly unknown[]) => Promise<QueryResultLike>;
  connect: () => Promise<QuestionStoreClient>;
};

export class PersonalForecastQuestionLimitError extends Error {
  readonly code:
    | 'PERSONAL_FORECAST_ANSWER_DAILY_LIMIT'
    | 'PERSONAL_FORECAST_CUSTOM_DAILY_LIMIT';
  readonly usage: PersonalForecastQuestionUsage;

  constructor(
    code: PersonalForecastQuestionLimitError['code'],
    usage: PersonalForecastQuestionUsage,
  ) {
    super(code);
    this.name = 'PersonalForecastQuestionLimitError';
    this.code = code;
    this.usage = usage;
  }
}

function database(
  override?: PersonalForecastQuestionDatabase,
): PersonalForecastQuestionDatabase {
  return override || (getPool() as unknown as PersonalForecastQuestionDatabase);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mapPersonalForecastQuestionRow(
  row: any,
): StoredPersonalForecastQuestion {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    chartId: row.chart_id == null ? null : Number(row.chart_id),
    chartFingerprint: String(row.chart_fingerprint || ''),
    forecastInputHash: String(row.forecast_input_hash || ''),
    period: row.period as PersonalForecastQuestionPeriod,
    periodKey: String(row.period_key || ''),
    usageDate: dateOnly(row.usage_date),
    language: row.language === 'en' ? 'en' : 'ru',
    source: row.source === 'custom' ? 'custom' : 'catalog',
    catalogQuestionId: row.catalog_question_id
      ? String(row.catalog_question_id)
      : null,
    questionText: String(row.question_text || ''),
    normalizedQuestion: String(row.normalized_question || ''),
    status: row.status as PersonalForecastQuestionStatus,
    moderationReason: row.moderation_reason
      ? String(row.moderation_reason)
      : null,
    moderationSuggestions: jsonArray(row.moderation_suggestions),
    answerText: row.answer_text ? String(row.answer_text) : null,
    answerMeta: jsonObject(row.answer_meta),
    modelId: row.model_id ? String(row.model_id) : null,
    promptVersion: String(row.prompt_version || ''),
    voiceVersion: String(row.voice_version || ''),
    generationStartedAt: iso(row.generation_started_at),
    answeredAt: iso(row.answered_at),
    moderatedBy: row.moderated_by == null ? null : String(row.moderated_by),
    moderatedAt: iso(row.moderated_at),
    notificationUnread: row.notification_unread === true,
    notificationPayload: jsonObject(row.notification_payload),
    readAt: iso(row.read_at),
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: iso(row.created_at) || new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) || new Date(0).toISOString(),
  };
}

export function isPersonalForecastQuestionGenerationStale(
  question: Pick<
    StoredPersonalForecastQuestion,
    'status' | 'generationStartedAt'
  >,
  now: Date = new Date(),
  staleAfterMinutes = PERSONAL_FORECAST_QUESTION_GENERATION_STALE_MINUTES,
): boolean {
  if (question.status !== 'generating' || !question.generationStartedAt) {
    return false;
  }
  const startedAt = new Date(question.generationStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return true;
  const thresholdMinutes = Math.max(
    1,
    Math.min(Number(staleAfterMinutes) || PERSONAL_FORECAST_QUESTION_GENERATION_STALE_MINUTES, 60),
  );
  return startedAt < now.getTime() - thresholdMinutes * 60_000;
}

export function buildPersonalForecastQuestionUsage(input: {
  usageDate: string;
  answersUsed: number;
  customUsed: number;
}): PersonalForecastQuestionUsage {
  const answersUsed = Math.max(0, Number(input.answersUsed) || 0);
  const customUsed = Math.max(0, Number(input.customUsed) || 0);
  return {
    usageDate: input.usageDate,
    answersUsed,
    answersRemaining: Math.max(
      0,
      PERSONAL_FORECAST_QUESTION_DAILY_LIMIT - answersUsed,
    ),
    answerLimit: PERSONAL_FORECAST_QUESTION_DAILY_LIMIT,
    customUsed,
    customRemaining: Math.max(
      0,
      PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT - customUsed,
    ),
    customLimit: PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT,
  };
}

export function assertPersonalForecastQuestionQuota(input: {
  usage: PersonalForecastQuestionUsage;
  source: PersonalForecastQuestionSource;
  countsTowardAnswer: boolean;
}): void {
  if (
    input.source === 'custom'
    && input.usage.customUsed
      >= PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT
  ) {
    throw new PersonalForecastQuestionLimitError(
      'PERSONAL_FORECAST_CUSTOM_DAILY_LIMIT',
      input.usage,
    );
  }
  if (
    input.countsTowardAnswer
    && input.usage.answersUsed >= PERSONAL_FORECAST_QUESTION_DAILY_LIMIT
  ) {
    throw new PersonalForecastQuestionLimitError(
      'PERSONAL_FORECAST_ANSWER_DAILY_LIMIT',
      input.usage,
    );
  }
}

async function usageWith(
  queryable: Pick<PersonalForecastQuestionDatabase, 'query'>,
  userId: string,
  usageDate: string,
): Promise<PersonalForecastQuestionUsage> {
  const result = await queryable.query(
    `SELECT
       (
         SELECT COUNT(*) FILTER (WHERE status <> 'rejected')::int
         FROM personal_forecast_questions
         WHERE user_id = $1 AND usage_date = $2::date
       ) AS answers_used,
       (
         SELECT COUNT(*) FILTER (
           WHERE source = 'custom' AND status <> 'rejected'
         )::int
         FROM personal_forecast_questions
         WHERE user_id = $1 AND usage_date = $2::date
       ) + (
         SELECT COUNT(*)::int
         FROM astrology_messages AS message
         JOIN astrology_threads AS thread ON thread.id = message.thread_id
         WHERE message.user_id = $1
           AND message.role = 'user'
           AND thread.thread_kind = 'natal-question-v1'
           AND message.content_payload ->> 'usageDate' = $2
       ) AS custom_used`,
    [userId, usageDate],
  );
  return buildPersonalForecastQuestionUsage({
    usageDate,
    answersUsed: Number(result.rows[0]?.answers_used || 0),
    customUsed: Number(result.rows[0]?.custom_used || 0),
  });
}

export async function getPersonalForecastQuestionUsage(
  userId: string,
  usageDate: string,
  override?: PersonalForecastQuestionDatabase,
): Promise<PersonalForecastQuestionUsage> {
  return usageWith(database(override), userId, usageDate);
}

async function findDuplicateWith(
  queryable: Pick<PersonalForecastQuestionDatabase, 'query'>,
  input: ReservePersonalForecastQuestionInput,
): Promise<StoredPersonalForecastQuestion | null> {
  const result = input.source === 'catalog'
    ? await queryable.query(
        `SELECT *
         FROM personal_forecast_questions
         WHERE user_id = $1
           AND chart_fingerprint = $2
           AND forecast_input_hash = $3
           AND period = $4
           AND period_key = $5
           AND language = $6
           AND source = 'catalog'
           AND catalog_question_id = $7
           AND normalized_question = $8
           AND prompt_version = $9
           AND voice_version = $10
         LIMIT 1`,
        [
          input.userId,
          input.chartFingerprint,
          input.forecastInputHash,
          input.period,
          input.periodKey,
          input.language,
          input.catalogQuestionId,
          input.normalizedQuestion,
          input.promptVersion,
          input.voiceVersion,
        ],
      )
    : await queryable.query(
        `SELECT *
         FROM personal_forecast_questions
         WHERE user_id = $1
           AND chart_fingerprint = $2
           AND forecast_input_hash = $3
           AND period = $4
           AND period_key = $5
           AND language = $6
           AND source = 'custom'
           AND normalized_question = $7
           AND prompt_version = $8
           AND voice_version = $9
         LIMIT 1`,
        [
          input.userId,
          input.chartFingerprint,
          input.forecastInputHash,
          input.period,
          input.periodKey,
          input.language,
          input.normalizedQuestion,
          input.promptVersion,
          input.voiceVersion,
        ],
      );
  return result.rows[0] ? mapPersonalForecastQuestionRow(result.rows[0]) : null;
}

export type ReservePersonalForecastQuestionInput = {
  userId: string;
  chartId: number | null;
  chartFingerprint: string;
  forecastInputHash: string;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  usageDate: string;
  language: PersonalForecastQuestionLanguage;
  source: PersonalForecastQuestionSource;
  catalogQuestionId: string | null;
  questionText: string;
  normalizedQuestion: string;
  status: Extract<
    PersonalForecastQuestionStatus,
    'pending' | 'generating' | 'rejected'
  >;
  moderationReason: string | null;
  moderationSuggestions?: readonly unknown[];
  promptVersion: string;
  voiceVersion: string;
};

export type ReservePersonalForecastQuestionResult = {
  question: StoredPersonalForecastQuestion;
  created: boolean;
  usage: PersonalForecastQuestionUsage;
};

export async function reservePersonalForecastQuestion(
  input: ReservePersonalForecastQuestionInput,
  override?: PersonalForecastQuestionDatabase,
): Promise<ReservePersonalForecastQuestionResult> {
  const pool = database(override);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`personal-forecast-question:${input.userId}:${input.usageDate}`],
    );

    const existing = await findDuplicateWith(client, input);
    if (existing) {
      const usage = await usageWith(client, input.userId, input.usageDate);
      await client.query('COMMIT');
      return { question: existing, created: false, usage };
    }

    const before = await usageWith(client, input.userId, input.usageDate);
    assertPersonalForecastQuestionQuota({
      usage: before,
      source: input.source,
      countsTowardAnswer: input.status !== 'rejected',
    });

    const inserted = await client.query(
      `INSERT INTO personal_forecast_questions (
         user_id,
         chart_id,
         chart_fingerprint,
         forecast_input_hash,
         period,
         period_key,
         usage_date,
         language,
         source,
         catalog_question_id,
         question_text,
         normalized_question,
         status,
         moderation_reason,
         moderation_suggestions,
         prompt_version,
         voice_version,
         generation_started_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13, $14,
         $15::jsonb, $16, $17,
         CASE WHEN $13 = 'generating' THEN CURRENT_TIMESTAMP ELSE NULL END
       )
       RETURNING *`,
      [
        input.userId,
        input.chartId,
        input.chartFingerprint,
        input.forecastInputHash,
        input.period,
        input.periodKey,
        input.usageDate,
        input.language,
        input.source,
        input.catalogQuestionId,
        input.questionText,
        input.normalizedQuestion,
        input.status,
        input.moderationReason,
        JSON.stringify(input.moderationSuggestions || []),
        input.promptVersion,
        input.voiceVersion,
      ],
    );
    const usage = await usageWith(client, input.userId, input.usageDate);
    await client.query('COMMIT');
    return {
      question: mapPersonalForecastQuestionRow(inserted.rows[0]),
      created: true,
      usage,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPersonalForecastQuestions(input: {
  userId: string;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  identity: PersonalForecastQuestionSnapshotIdentity;
  limit?: number;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion[]> {
  const limit = Math.max(1, Math.min(Number(input.limit) || 100, 200));
  const result = await database(input.database).query(
    `SELECT *
     FROM personal_forecast_questions
     WHERE user_id = $1
       AND period = $2
       AND period_key = $3
       AND chart_fingerprint = $4
       AND forecast_input_hash = $5
       AND language = $6
       AND prompt_version = $7
       AND voice_version = $8
     ORDER BY created_at DESC, id DESC
     LIMIT ${limit}`,
    [
      input.userId,
      input.period,
      input.periodKey,
      input.identity.chartFingerprint,
      input.identity.forecastInputHash,
      input.identity.language,
      input.identity.promptVersion,
      input.identity.voiceVersion,
    ],
  );
  return result.rows.map(mapPersonalForecastQuestionRow);
}

export async function listExistingCustomQuestionTexts(input: {
  userId: string;
  usageDate: string;
  database?: PersonalForecastQuestionDatabase;
}): Promise<string[]> {
  const result = await database(input.database).query(
    `SELECT question_text
     FROM personal_forecast_questions
     WHERE user_id = $1
       AND usage_date = $2::date
       AND source = 'custom'
     ORDER BY id DESC`,
    [input.userId, input.usageDate],
  );
  return result.rows.map((row) => String(row.question_text || '')).filter(Boolean);
}

export async function getPersonalForecastQuestionById(input: {
  id: number;
  userId?: string;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion | null> {
  const values: unknown[] = [input.id];
  const ownerClause = input.userId ? 'AND user_id = $2' : '';
  if (input.userId) values.push(input.userId);
  const result = await database(input.database).query(
    `SELECT *
     FROM personal_forecast_questions
     WHERE id = $1 ${ownerClause}
     LIMIT 1`,
    values,
  );
  return result.rows[0] ? mapPersonalForecastQuestionRow(result.rows[0]) : null;
}

export async function claimPersonalForecastQuestionGeneration(input: {
  id: number;
  userId?: string;
  staleAfterMinutes?: number;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion | null> {
  const staleMinutes = Math.max(
    1,
    Math.min(
      Number(input.staleAfterMinutes)
        || PERSONAL_FORECAST_QUESTION_GENERATION_STALE_MINUTES,
      60,
    ),
  );
  const values: unknown[] = [input.id, staleMinutes];
  const ownerClause = input.userId ? 'AND user_id = $3' : '';
  if (input.userId) values.push(input.userId);
  const result = await database(input.database).query(
    `UPDATE personal_forecast_questions
     SET status = 'generating',
         generation_started_at = CURRENT_TIMESTAMP,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       ${ownerClause}
       AND (
         status = 'approved'
         OR (
           status = 'generating'
           AND generation_started_at
             < CURRENT_TIMESTAMP - ($2::int * INTERVAL '1 minute')
         )
       )
     RETURNING *`,
    values,
  );
  return result.rows[0] ? mapPersonalForecastQuestionRow(result.rows[0]) : null;
}

export async function completePersonalForecastQuestionAnswer(input: {
  id: number;
  answerText: string;
  answerMeta: Record<string, unknown>;
  modelId: string;
  notificationUnread: boolean;
  notificationPayload?: Record<string, unknown> | null;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion | null> {
  const result = await database(input.database).query(
    `UPDATE personal_forecast_questions
     SET status = 'answered',
         answer_text = $2,
         answer_meta = $3::jsonb,
         model_id = $4,
         answered_at = CURRENT_TIMESTAMP,
         notification_unread = $5,
         notification_payload = $6::jsonb,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('generating', 'approved')
     RETURNING *`,
    [
      input.id,
      input.answerText,
      JSON.stringify(input.answerMeta),
      input.modelId,
      input.notificationUnread,
      JSON.stringify(input.notificationPayload || null),
    ],
  );
  return result.rows[0] ? mapPersonalForecastQuestionRow(result.rows[0]) : null;
}

export async function failPersonalForecastQuestionGeneration(input: {
  id: number;
  error: string;
  retryable?: boolean;
  database?: PersonalForecastQuestionDatabase;
}): Promise<void> {
  const retryable = input.retryable !== false;
  await database(input.database).query(
    `UPDATE personal_forecast_questions
     SET status = CASE WHEN $3::boolean THEN 'approved' ELSE 'rejected' END,
         moderation_reason = CASE
           WHEN $3::boolean THEN moderation_reason
           ELSE 'content_identity_changed'
         END,
         generation_started_at = NULL,
         last_error = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'generating'`,
    [
      input.id,
      String(input.error || 'generation_failed').slice(0, 1000),
      retryable,
    ],
  );
}

export async function moderatePendingPersonalForecastQuestion(input: {
  id: number;
  moderatorId: string;
  decision: 'approve' | 'reject';
  reason?: string | null;
  database?: PersonalForecastQuestionDatabase;
}): Promise<{
  question: StoredPersonalForecastQuestion | null;
  claimedForGeneration: boolean;
}> {
  const nextStatus = input.decision === 'approve' ? 'generating' : 'rejected';
  const result = await database(input.database).query(
    `UPDATE personal_forecast_questions
     SET status = $2,
         moderation_reason = $3,
         moderated_by = $4,
         moderated_at = CURRENT_TIMESTAMP,
         generation_started_at = CASE
           WHEN $2 = 'generating' THEN CURRENT_TIMESTAMP
           ELSE generation_started_at
         END,
         notification_unread = FALSE,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND source = 'custom'
       AND status = 'pending'
     RETURNING *`,
    [
      input.id,
      nextStatus,
      input.reason
        || (input.decision === 'approve'
          ? 'manual_approved'
          : 'manual_rejected'),
      input.moderatorId,
    ],
  );
  if (result.rows[0]) {
    return {
      question: mapPersonalForecastQuestionRow(result.rows[0]),
      claimedForGeneration: input.decision === 'approve',
    };
  }
  return {
    question: await getPersonalForecastQuestionById({
      id: input.id,
      database: input.database,
    }),
    claimedForGeneration: false,
  };
}

export async function listUnreadPersonalForecastQuestionNotifications(input: {
  userId: string;
  identity: PersonalForecastQuestionNotificationIdentity;
  limit?: number;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion[]> {
  const limit = Math.max(1, Math.min(Number(input.limit) || 20, 100));
  const result = await database(input.database).query(
    `SELECT *
     FROM personal_forecast_questions
     WHERE user_id = $1
       AND status = 'answered'
       AND notification_unread = TRUE
       AND chart_fingerprint = $2
       AND language = $3
       AND prompt_version = $4
       AND voice_version = $5
     ORDER BY answered_at DESC NULLS LAST, id DESC
     LIMIT ${limit}`,
    [
      input.userId,
      input.identity.chartFingerprint,
      input.identity.language,
      input.identity.promptVersion,
      input.identity.voiceVersion,
    ],
  );
  return result.rows.map(mapPersonalForecastQuestionRow);
}

export async function markPersonalForecastQuestionRead(input: {
  id: number;
  userId: string;
  database?: PersonalForecastQuestionDatabase;
}): Promise<StoredPersonalForecastQuestion | null> {
  const result = await database(input.database).query(
    `UPDATE personal_forecast_questions
     SET notification_unread = FALSE,
         read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND user_id = $2
       AND status = 'answered'
     RETURNING *`,
    [input.id, input.userId],
  );
  return result.rows[0] ? mapPersonalForecastQuestionRow(result.rows[0]) : null;
}

export async function listAdminPersonalForecastQuestions(input: {
  status?: PersonalForecastQuestionStatus | null;
  period?: PersonalForecastQuestionPeriod | null;
  source?: PersonalForecastQuestionSource | null;
  query?: string | null;
  limit?: number;
  offset?: number;
  database?: PersonalForecastQuestionDatabase;
}): Promise<{ questions: StoredPersonalForecastQuestion[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (input.status) {
    values.push(input.status);
    where.push(`q.status = $${values.length}`);
  }
  if (input.period) {
    values.push(input.period);
    where.push(`q.period = $${values.length}`);
  }
  if (input.source) {
    values.push(input.source);
    where.push(`q.source = $${values.length}`);
  }
  if (input.query?.trim()) {
    values.push(`%${input.query.trim()}%`);
    where.push(
      `(q.question_text ILIKE $${values.length} OR q.answer_text ILIKE $${values.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(Number(input.limit) || 100, 200));
  const offset = Math.max(0, Number(input.offset) || 0);
  const db = database(input.database);
  const [count, rows] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total
       FROM personal_forecast_questions q
       ${whereSql}`,
      values,
    ),
    db.query(
      `SELECT q.*
       FROM personal_forecast_questions q
       ${whereSql}
       ORDER BY
         CASE WHEN q.status = 'pending' THEN 0 ELSE 1 END,
         q.created_at DESC,
         q.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    ),
  ]);
  return {
    questions: rows.rows.map(mapPersonalForecastQuestionRow),
    total: Number(count.rows[0]?.total || 0),
  };
}
