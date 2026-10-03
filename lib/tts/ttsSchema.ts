/** Synthesized audio, one row per text + voice (used by the migration and ensureTtsSchema). */
export const TTS_AUDIO_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tts_audio (
    id TEXT PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
    voice TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BYTEA NOT NULL,
    byte_size INTEGER NOT NULL,
    duration_sec INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS tts_audio_expires_idx ON tts_audio (expires_at) WHERE expires_at IS NOT NULL;
`;
