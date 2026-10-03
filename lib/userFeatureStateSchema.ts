/** Personal records of home features (used by the migration and the ensureUserFeatureStateSchema safety net). */
export const USER_FEATURE_STATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS user_feature_state (
    user_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    item_key TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, feature, item_key)
  );
`;
