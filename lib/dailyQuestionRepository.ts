import { createHash } from 'crypto';
import type { Pool } from 'pg';
import { getPool } from './db';

export const DAILY_QUESTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS daily_question_votes (
    day_key DATE NOT NULL,
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    sign TEXT NOT NULL,
    option_index SMALLINT NOT NULL CHECK (option_index >= 0 AND option_index < 8),
    network_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_key, user_id)
  );
  CREATE INDEX IF NOT EXISTS daily_question_votes_day_idx ON daily_question_votes (day_key, sign);
  CREATE INDEX IF NOT EXISTS daily_question_votes_network_idx ON daily_question_votes (day_key, network_hash);
`;

/** Votes from one network per day; more look like ballot stuffing with throwaway accounts. */
export const VOTES_PER_NETWORK_PER_DAY = 6;

let schemaReady: Promise<void> | null = null;
export function ensureDailyQuestionSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(DAILY_QUESTION_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

/** A daily, salted hash of the client network: never stored as an address. */
export function networkHash(ip: string, dayKey: string): string {
  const salt = String(process.env.SESSION_SECRET || process.env.OPENAI_API_KEY || 'nebo-question');
  return createHash('sha256').update(`${salt}:${dayKey}:${ip}`).digest('hex').slice(0, 32);
}

export async function readMyVote(dayKey: string, userId: string, pool: Pool = getPool()): Promise<number | null> {
  await ensureDailyQuestionSchema(pool);
  const result = await pool.query('SELECT option_index FROM daily_question_votes WHERE day_key = $1 AND user_id = $2', [dayKey, userId]);
  return result.rows[0] ? Number(result.rows[0].option_index) : null;
}

export async function readCounts(dayKey: string, sign: string | null, optionCount: number, pool: Pool = getPool()): Promise<{ sign: number[]; all: number[] }> {
  await ensureDailyQuestionSchema(pool);
  const result = await pool.query(
    'SELECT sign, option_index, COUNT(*)::int AS votes FROM daily_question_votes WHERE day_key = $1 GROUP BY sign, option_index',
    [dayKey],
  );
  const signCounts = Array(optionCount).fill(0);
  const allCounts = Array(optionCount).fill(0);
  for (const row of result.rows as Array<{ sign: string; option_index: number; votes: number }>) {
    const index = Number(row.option_index);
    if (index >= optionCount) continue;
    allCounts[index] += Number(row.votes);
    if (sign && row.sign === sign) signCounts[index] += Number(row.votes);
  }
  return { sign: signCounts, all: allCounts };
}

export type VoteOutcome = 'saved' | 'already_voted' | 'network_limit';

export async function saveVote(input: { dayKey: string; userId: string; questionId: string; sign: string; optionIndex: number; network: string }, pool: Pool = getPool()): Promise<VoteOutcome> {
  await ensureDailyQuestionSchema(pool);
  const result = await pool.query(
    `INSERT INTO daily_question_votes (day_key, user_id, question_id, sign, option_index, network_hash)
     SELECT $1::date, $2, $3, $4, $5, $6
     WHERE (SELECT COUNT(*) FROM daily_question_votes WHERE day_key = $1::date AND network_hash = $6) < $7
     ON CONFLICT (day_key, user_id) DO NOTHING`,
    [input.dayKey, input.userId, input.questionId, input.sign, input.optionIndex, input.network, VOTES_PER_NETWORK_PER_DAY],
  );
  if ((result.rowCount ?? 0) > 0) return 'saved';
  return (await readMyVote(input.dayKey, input.userId, pool)) === null ? 'network_limit' : 'already_voted';
}
