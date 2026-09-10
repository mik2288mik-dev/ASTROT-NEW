import type { Pool } from 'pg';
/** Explicitly called after existing migrations, never during HTTP reads. Additive and idempotent. */
export async function migrateNeboAdminDesign(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [2026090701]);
    await client.query(`CREATE TABLE IF NOT EXISTS user_design_preferences (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferences JSONB NOT NULL DEFAULT '{"schemaVersion":1,"design":"classic","theme":"system"}'::jsonb,
      revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT user_design_preferences_object CHECK (jsonb_typeof(preferences) = 'object'),
      CONSTRAINT user_design_preferences_size CHECK (octet_length(preferences::text) <= 16384)
    )`);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}
