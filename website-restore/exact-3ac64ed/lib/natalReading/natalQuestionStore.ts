import { getPool } from '../db';

export const NATAL_QUESTION_THREAD_KIND = 'natal-question-v1';
export const NATAL_QUESTION_THREAD_SCHEMA_VERSION = 'natal-question-thread-v1';
export const NATAL_QUESTION_MESSAGE_SCHEMA_VERSION = 'natal-question-message-v1';
export const NATAL_QUESTION_DAILY_LIMIT = 5;

export type NatalQuestionAccess = 'free' | 'premium';

export type NatalQuestionStoredMessage = {
  id: number;
  threadId: number;
  userId: string;
  chartId: number;
  role: 'user' | 'assistant';
  text: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type NatalQuestionUsage = {
  usageDate: string;
  used: number;
  limit: number;
  remaining: number;
};

export type NatalFreeQuestionUsage = {
  used: boolean;
  remaining: 0 | 1;
};

export function answeredNatalQuestionTexts(
  messages: readonly NatalQuestionStoredMessage[],
): string[] {
  const answeredQuestionIds = new Set<number>();
  messages.forEach((message) => {
    if (message.role !== 'assistant') return;
    const questionMessageId = Number(message.payload?.questionMessageId);
    if (Number.isSafeInteger(questionMessageId) && questionMessageId > 0) {
      answeredQuestionIds.add(questionMessageId);
    }
  });
  return messages
    .filter((message) => message.role === 'user' && answeredQuestionIds.has(message.id))
    .map((message) => message.text);
}

export class NatalQuestionLimitError extends Error {
  readonly code = 'NATAL_QUESTION_DAILY_LIMIT';
  readonly usage: NatalQuestionUsage;

  constructor(usage: NatalQuestionUsage) {
    super('NATAL_QUESTION_DAILY_LIMIT');
    this.name = 'NatalQuestionLimitError';
    this.usage = usage;
  }
}

export class FreeNatalQuestionUsedError extends Error {
  readonly code = 'FREE_NATAL_QUESTION_USED';

  constructor() {
    super('FREE_NATAL_QUESTION_USED');
    this.name = 'FreeNatalQuestionUsedError';
  }
}

type QueryResultLike = { rows: any[] };
type QueryClientLike = {
  query: (sql: string, values?: readonly unknown[]) => Promise<QueryResultLike>;
  release: () => void;
};
type DatabaseLike = {
  query: (sql: string, values?: readonly unknown[]) => Promise<QueryResultLike>;
  connect: () => Promise<QueryClientLike>;
};

function database(): DatabaseLike {
  return getPool() as unknown as DatabaseLike;
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return jsonObject(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function mapMessage(row: any): NatalQuestionStoredMessage {
  return {
    id: Number(row.id),
    threadId: Number(row.thread_id),
    userId: String(row.user_id),
    chartId: Number(row.subject_chart_id),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    text: String(row.content_text || ''),
    payload: jsonObject(row.content_payload),
    createdAt: iso(row.created_at),
  };
}

export async function ensureNatalQuestionThread(input: {
  userId: string;
  chartId: number;
}): Promise<number> {
  const db = database();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `natal-question-thread:${input.userId}:${input.chartId}`,
    ]);
    const existing = await client.query(
      `SELECT thread.id
       FROM astrology_threads AS thread
       JOIN natal_charts AS chart ON chart.id = thread.subject_chart_id
       WHERE thread.user_id = $1
         AND thread.subject_chart_id = $2
         AND thread.counterpart_chart_id IS NULL
         AND thread.thread_kind = $3
         AND chart.user_id = $1
         AND chart.archived_at IS NULL
       ORDER BY thread.id ASC
       LIMIT 1`,
      [input.userId, input.chartId, NATAL_QUESTION_THREAD_KIND],
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return Number(existing.rows[0].id);
    }
    const inserted = await client.query(
      `INSERT INTO astrology_threads (
         user_id, subject_chart_id, counterpart_chart_id, thread_kind, title,
         provenance, schema_version
       )
       SELECT $1, chart.id, NULL, $3, NULL, $4::jsonb, $5
       FROM natal_charts AS chart
       WHERE chart.id = $2
         AND chart.user_id = $1
         AND chart.archived_at IS NULL
       RETURNING id`,
      [
        input.userId,
        input.chartId,
        NATAL_QUESTION_THREAD_KIND,
        JSON.stringify({ surface: 'natal', persistent: true }),
        NATAL_QUESTION_THREAD_SCHEMA_VERSION,
      ],
    );
    if (!inserted.rows[0]) throw new Error('NATAL_QUESTION_CHART_NOT_FOUND');
    await client.query('COMMIT');
    return Number(inserted.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listNatalQuestionMessages(input: {
  userId: string;
  chartId: number;
  pairLimit?: number;
}): Promise<NatalQuestionStoredMessage[]> {
  const pairLimit = Math.max(1, Math.min(Number(input.pairLimit) || 8, 8));
  const result = await database().query(
    `WITH recent_pairs AS (
       SELECT question.id AS question_id, answer.id AS answer_id,
              question.created_at AS question_created_at
       FROM astrology_messages AS question
       JOIN astrology_threads AS thread ON thread.id = question.thread_id
       LEFT JOIN LATERAL (
         SELECT candidate.id
         FROM astrology_messages AS candidate
         WHERE candidate.thread_id = question.thread_id
           AND candidate.user_id = question.user_id
           AND candidate.subject_chart_id = question.subject_chart_id
           AND candidate.role = 'assistant'
           AND candidate.content_payload ->> 'questionMessageId' = question.id::text
         ORDER BY candidate.created_at DESC, candidate.id DESC
         LIMIT 1
       ) AS answer ON TRUE
       WHERE question.user_id = $1
         AND question.subject_chart_id = $2
         AND question.counterpart_chart_id IS NULL
         AND question.role = 'user'
         AND thread.user_id = $1
         AND thread.subject_chart_id = $2
         AND thread.thread_kind = $3
       ORDER BY question.created_at DESC, question.id DESC
       LIMIT $4
     ), recent_messages AS (
       SELECT message.*
       FROM astrology_messages AS message
       JOIN recent_pairs AS pair
         ON message.id = pair.question_id OR message.id = pair.answer_id
     )
     SELECT * FROM recent_messages ORDER BY created_at ASC, id ASC`,
    [input.userId, input.chartId, NATAL_QUESTION_THREAD_KIND, pairLimit],
  );
  return result.rows.map(mapMessage);
}

export async function appendNatalQuestionMessage(input: {
  userId: string;
  chartId: number;
  threadId: number;
  role: 'user' | 'assistant';
  text: string;
  payload?: Record<string, unknown> | null;
}): Promise<NatalQuestionStoredMessage> {
  const result = await database().query(
    `INSERT INTO astrology_messages (
       thread_id, user_id, subject_chart_id, counterpart_chart_id, role,
       content_text, content_payload, provenance, schema_version
     )
     SELECT
       thread.id, thread.user_id, thread.subject_chart_id, NULL, $4,
       $5, $6::jsonb, $7::jsonb, $8
     FROM astrology_threads AS thread
     JOIN natal_charts AS chart ON chart.id = thread.subject_chart_id
     WHERE thread.id = $3
       AND thread.user_id = $1
       AND thread.subject_chart_id = $2
       AND thread.counterpart_chart_id IS NULL
       AND thread.thread_kind = $9
       AND chart.user_id = $1
       AND chart.archived_at IS NULL
     RETURNING astrology_messages.*`,
    [
      input.userId,
      input.chartId,
      input.threadId,
      input.role,
      input.text.trim(),
      JSON.stringify(input.payload || null),
      JSON.stringify({ surface: 'natal', chartId: input.chartId }),
      NATAL_QUESTION_MESSAGE_SCHEMA_VERSION,
      NATAL_QUESTION_THREAD_KIND,
    ],
  );
  if (!result.rows[0]) throw new Error('NATAL_QUESTION_THREAD_SCOPE_MISMATCH');
  return mapMessage(result.rows[0]);
}

async function questionUsageWith(
  queryable: Pick<DatabaseLike, 'query'>,
  input: {
    userId: string;
    usageDate: string;
    timezone: string;
  },
): Promise<NatalQuestionUsage> {
  const result = await queryable.query(
    `SELECT COUNT(*)::int AS used
     FROM astrology_messages AS message
     JOIN astrology_threads AS thread ON thread.id = message.thread_id
     WHERE message.user_id = $1
       AND message.role = 'user'
       AND thread.thread_kind = $2
       AND COALESCE(message.content_payload ->> 'questionAccess', 'premium') <> 'free'
       AND COALESCE(
         NULLIF(message.content_payload ->> 'usageDate', ''),
         (message.created_at AT TIME ZONE $4)::date::text
       ) = $3`,
    [input.userId, NATAL_QUESTION_THREAD_KIND, input.usageDate, input.timezone],
  );
  const used = Math.max(0, Number(result.rows[0]?.used || 0));
  return {
    usageDate: input.usageDate,
    used,
    limit: NATAL_QUESTION_DAILY_LIMIT,
    remaining: Math.max(0, NATAL_QUESTION_DAILY_LIMIT - used),
  };
}

async function freeQuestionUsageWith(
  queryable: Pick<DatabaseLike, 'query'>,
  input: { userId: string },
): Promise<NatalFreeQuestionUsage> {
  const result = await queryable.query(
    `SELECT EXISTS (
       SELECT 1
       FROM astrology_messages AS message
       JOIN astrology_threads AS thread ON thread.id = message.thread_id
       WHERE message.user_id = $1
         AND message.role = 'user'
         AND thread.thread_kind = $2
         AND message.content_payload ->> 'questionAccess' = 'free'
     ) AS used`,
    [input.userId, NATAL_QUESTION_THREAD_KIND],
  );
  const used = result.rows[0]?.used === true || result.rows[0]?.used === 't';
  return { used, remaining: used ? 0 : 1 };
}

export async function getNatalQuestionUsage(input: {
  userId: string;
  usageDate: string;
  timezone: string;
}): Promise<NatalQuestionUsage> {
  return questionUsageWith(database(), input);
}

export async function getFreeNatalQuestionUsage(input: {
  userId: string;
}): Promise<NatalFreeQuestionUsage> {
  return freeQuestionUsageWith(database(), input);
}

export async function reserveNatalQuestionMessage(input: {
  userId: string;
  chartId: number;
  threadId: number;
  text: string;
  normalizedQuestion: string;
  usageDate: string;
  timezone: string;
  access: NatalQuestionAccess;
}): Promise<{ message: NatalQuestionStoredMessage; usage: NatalQuestionUsage; created: boolean }> {
  const db = database();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      input.access === 'free'
        ? `natal-question:${input.userId}:free-lifetime`
        : `natal-question:${input.userId}:${input.usageDate}`,
    ]);
    const existing = await client.query(
      `SELECT message.*
       FROM astrology_messages AS message
       JOIN astrology_threads AS thread ON thread.id = message.thread_id
       WHERE message.user_id = $1
         AND message.subject_chart_id = $2
         AND message.thread_id = $3
         AND message.role = 'user'
         AND thread.thread_kind = $4
         AND message.content_payload ->> 'normalizedQuestion' = $5
         AND ($6 = 'premium' OR message.content_payload ->> 'questionAccess' = 'free')
         AND NOT EXISTS (
           SELECT 1
           FROM astrology_messages AS answer
           WHERE answer.thread_id = message.thread_id
             AND answer.role = 'assistant'
             AND answer.content_payload ->> 'questionMessageId' = message.id::text
         )
       ORDER BY message.created_at DESC, message.id DESC
       LIMIT 1`,
      [
        input.userId,
        input.chartId,
        input.threadId,
        NATAL_QUESTION_THREAD_KIND,
        input.normalizedQuestion,
        input.access,
      ],
    );
    if (existing.rows[0]) {
      const usage = await questionUsageWith(client as unknown as DatabaseLike, input);
      await client.query('COMMIT');
      return { message: mapMessage(existing.rows[0]), usage, created: false };
    }
    const before = await questionUsageWith(client as unknown as DatabaseLike, input);
    if (input.access === 'free') {
      const freeUsage = await freeQuestionUsageWith(client as unknown as DatabaseLike, input);
      if (freeUsage.used) throw new FreeNatalQuestionUsedError();
    } else if (before.remaining <= 0) {
      throw new NatalQuestionLimitError(before);
    }
    const inserted = await client.query(
      `INSERT INTO astrology_messages (
         thread_id, user_id, subject_chart_id, counterpart_chart_id, role,
         content_text, content_payload, provenance, schema_version
       )
       SELECT
         thread.id, thread.user_id, thread.subject_chart_id, NULL, 'user',
         $4, $5::jsonb, $6::jsonb, $7
       FROM astrology_threads AS thread
       JOIN natal_charts AS chart ON chart.id = thread.subject_chart_id
       WHERE thread.id = $3
         AND thread.user_id = $1
         AND thread.subject_chart_id = $2
         AND thread.counterpart_chart_id IS NULL
         AND thread.thread_kind = $8
         AND chart.user_id = $1
         AND chart.archived_at IS NULL
       RETURNING astrology_messages.*`,
      [
        input.userId,
        input.chartId,
        input.threadId,
        input.text.trim(),
        JSON.stringify({
          normalizedQuestion: input.normalizedQuestion,
          usageDate: input.usageDate,
          questionAccess: input.access,
        }),
        JSON.stringify({ surface: 'natal', chartId: input.chartId }),
        NATAL_QUESTION_MESSAGE_SCHEMA_VERSION,
        NATAL_QUESTION_THREAD_KIND,
      ],
    );
    if (!inserted.rows[0]) throw new Error('NATAL_QUESTION_THREAD_SCOPE_MISMATCH');
    const usage = await questionUsageWith(client as unknown as DatabaseLike, input);
    await client.query('COMMIT');
    return { message: mapMessage(inserted.rows[0]), usage, created: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function findNatalQuestionAnswer(input: {
  userId: string;
  chartId: number;
  questionMessageId: number;
}): Promise<NatalQuestionStoredMessage | null> {
  const result = await database().query(
    `SELECT answer.*
     FROM astrology_messages AS answer
     JOIN astrology_threads AS thread ON thread.id = answer.thread_id
     WHERE answer.user_id = $1
       AND answer.subject_chart_id = $2
       AND answer.role = 'assistant'
       AND thread.thread_kind = $3
       AND answer.content_payload ->> 'questionMessageId' = $4
     ORDER BY answer.created_at DESC, answer.id DESC
     LIMIT 1`,
    [input.userId, input.chartId, NATAL_QUESTION_THREAD_KIND, String(input.questionMessageId)],
  );
  return result.rows[0] ? mapMessage(result.rows[0]) : null;
}
