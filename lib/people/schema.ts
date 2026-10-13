import type { Pool } from 'pg';
import { getPool } from '../db';

/**
 * «Мои люди»: связанные аккаунты и один общий разбор на пару.
 *
 * people_invites        одноразовые приглашения по ссылке;
 * people_links          подтверждённая связь двух аккаунтов (user_low_id < user_high_id,
 *                       поэтому «Маша + Саша» и «Саша + Маша» это одна строка);
 * people_link_members   личные настройки каждого участника связи;
 * people_pair_readings  общий разбор пары: один на версию данных обоих, тип связи и язык.
 *
 * Удаление связи или аккаунта удаляет и общий разбор (ON DELETE CASCADE).
 */
export const PEOPLE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS people_links (
    id BIGSERIAL PRIMARY KEY,
    user_low_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_high_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_context TEXT NOT NULL,
    proposed_context TEXT,
    proposed_by_user_id BIGINT,
    created_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT people_links_order CHECK (user_low_id < user_high_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS people_links_pair_idx ON people_links (user_low_id, user_high_id);
  CREATE INDEX IF NOT EXISTS people_links_high_idx ON people_links (user_high_id);

  CREATE TABLE IF NOT EXISTS people_link_members (
    link_id BIGINT NOT NULL REFERENCES people_links(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_birthday BOOLEAN NOT NULL DEFAULT TRUE,
    manual_chart_id BIGINT REFERENCES natal_charts(id) ON DELETE SET NULL,
    seen_reading_key TEXT,
    PRIMARY KEY (link_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS people_link_members_user_idx ON people_link_members (user_id);

  CREATE TABLE IF NOT EXISTS people_invites (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    inviter_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_context TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    responded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    responded_at TIMESTAMPTZ,
    link_id BIGINT REFERENCES people_links(id) ON DELETE SET NULL,
    CONSTRAINT people_invites_status CHECK (status IN ('active', 'accepted', 'declined', 'revoked'))
  );
  CREATE INDEX IF NOT EXISTS people_invites_inviter_idx ON people_invites (inviter_user_id, status);

  CREATE TABLE IF NOT EXISTS people_pair_readings (
    id BIGSERIAL PRIMARY KEY,
    link_id BIGINT NOT NULL REFERENCES people_links(id) ON DELETE CASCADE,
    reading_key TEXT NOT NULL,
    language TEXT NOT NULL,
    relationship_context TEXT NOT NULL,
    calculation_level TEXT NOT NULL,
    inputs JSONB NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT people_pair_readings_key UNIQUE (link_id, reading_key)
  );
  CREATE INDEX IF NOT EXISTS people_pair_readings_latest_idx ON people_pair_readings (link_id, language, created_at DESC);
`;

let schemaReady: Promise<void> | null = null;
let avatarsTable = false;

/** Timeweb starts the container without the migration step, so the tables are created on first use too. */
export function ensurePeopleSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(PEOPLE_SCHEMA_SQL);
      const avatars = await pool.query(`SELECT to_regclass('user_chart_avatars') IS NOT NULL AS present`);
      avatarsTable = avatars.rows[0]?.present === true;
    })();
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

/** Avatars come from an optional table; a database without it shows default avatars. */
export function avatarJoin(userColumn: string, alias: string): string {
  return avatarsTable
    ? `LEFT JOIN user_chart_avatars ${alias} ON ${alias}.user_id = ${userColumn} AND ${alias}.subject_key = 'self'`
    : `LEFT JOIN (SELECT NULL::bigint AS user_id, NULL::jsonb AS avatar) ${alias} ON FALSE`;
}
