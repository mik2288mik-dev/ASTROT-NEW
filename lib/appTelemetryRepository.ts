import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getPool } from './db';
import { AdminAuthError } from './adminAuth';
import type { AppTraceEvent } from './appTelemetry';
import { activityId } from './productActivity';

export const APP_TELEMETRY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS product_trace_visits (
  id UUID PRIMARY KEY, token_hash TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS product_trace_events (
  id UUID PRIMARY KEY, visit_id UUID NOT NULL REFERENCES product_trace_visits(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence>=0), event_type TEXT NOT NULL, screen TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_trace_visits_user_time ON product_trace_visits(user_id,started_at);
CREATE INDEX IF NOT EXISTS idx_product_trace_events_visit_time ON product_trace_events(visit_id,occurred_at,sequence);
CREATE INDEX IF NOT EXISTS idx_product_trace_events_time ON product_trace_events(occurred_at);
`;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
export async function recordAppTrace(input: { token?: string | null; userId: string | null;
  events: AppTraceEvent[]; metadata: Record<string, unknown> }): Promise<string> {
  const client = await getPool().connect();
  let token = input.token || null;
  try {
    await client.query('BEGIN');
    let visitId: string;
    if (!token) {
      visitId = randomUUID(); const secret = randomBytes(32).toString('hex'); token = `${visitId}.${secret}`;
      const firstAt=Math.min(Date.now(),...input.events.map(event=>event.at));
      await client.query(`INSERT INTO product_trace_visits(id,token_hash,user_id,metadata,started_at) VALUES($1,$2,$3,$4::jsonb,to_timestamp($5/1000.0))`,
        [visitId, hash(secret), input.userId, JSON.stringify(input.metadata),firstAt]);
    } else {
      const match = /^([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(token);
      if (!match || !activityId(match[1])) throw new AdminAuthError(410, 'TRACE_EXPIRED', 'Visit expired');
      visitId = match[1];
      const found = await client.query('SELECT token_hash,user_id,last_at FROM product_trace_visits WHERE id=$1 FOR UPDATE', [visitId]);
      const visit = found.rows[0];
      const actual = Buffer.from(hash(match[2]), 'hex');
      const expected = Buffer.from(visit?.token_hash || '', 'hex');
      if (!visit || actual.length !== expected.length || !timingSafeEqual(actual, expected)
        || Date.now() - new Date(visit.last_at).getTime() > 7 * 86_400_000) throw new AdminAuthError(410, 'TRACE_EXPIRED', 'Visit expired');
      if (visit.user_id != null && String(visit.user_id) !== input.userId) throw new AdminAuthError(409, 'TRACE_ACCOUNT_CHANGED', 'Account changed');
      await client.query(`UPDATE product_trace_visits SET user_id=COALESCE(user_id,$2),last_at=NOW(),
        metadata=metadata || $3::jsonb WHERE id=$1`, [visitId, input.userId, JSON.stringify(input.metadata)]);
    }
    if (input.events.length) await client.query(`INSERT INTO product_trace_events(id,visit_id,sequence,event_type,screen,payload_json,occurred_at)
      SELECT x.id::uuid,$1,x.sequence,x.type,x.screen,x.payload,to_timestamp(x.at/1000.0)
      FROM jsonb_to_recordset($2::jsonb) AS x(id text,sequence integer,type text,screen text,payload jsonb,at bigint)
      ON CONFLICT(id) DO NOTHING`, [visitId, JSON.stringify(input.events)]);
    await client.query('COMMIT'); return token;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}
