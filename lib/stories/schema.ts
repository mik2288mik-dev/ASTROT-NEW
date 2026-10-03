/** Daily story series: episodes and free unlocks (migration and ensureStorySchema). */
export const STORY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS story_episodes (
    series_id TEXT NOT NULL,
    number INTEGER NOT NULL CHECK (number > 0),
    release_date DATE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    summary TEXT NOT NULL,
    facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    hook TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('ready', 'needs_review', 'approved', 'hold')),
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviewed_by_human BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (series_id, number)
  );
  CREATE INDEX IF NOT EXISTS story_episodes_release_idx ON story_episodes (series_id, release_date);
  CREATE TABLE IF NOT EXISTS story_unlocks (
    user_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    unlocked_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, series_id, number)
  );
  CREATE INDEX IF NOT EXISTS story_unlocks_day_idx ON story_unlocks (user_id, series_id, unlocked_on);
`;
