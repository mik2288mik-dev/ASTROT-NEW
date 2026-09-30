export const NATAL_READING_JOBS_SCHEMA = `
CREATE TABLE IF NOT EXISTS natal_reading_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_id INTEGER NOT NULL REFERENCES natal_charts(id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ru', 'en')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'obsolete')),
  attempts INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  progress JSONB,
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chart_id, input_hash, language)
);
CREATE INDEX IF NOT EXISTS natal_reading_jobs_pending
  ON natal_reading_jobs(available_at, id) WHERE status = 'pending';
`;
