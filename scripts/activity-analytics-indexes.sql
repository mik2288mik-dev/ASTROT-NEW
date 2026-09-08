-- Optional local rollout preparation. Run explicitly against the intended database;
-- this file is not executed by the application or any automatic migration.
-- CONCURRENTLY must run outside a transaction on existing production tables.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_app_events_activity_time
  ON user_app_events (occurred_at DESC, event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_app_events_activity_visit
  ON user_app_events (user_id, (payload_json->>'session_id'), occurred_at DESC, id DESC)
  WHERE event_type = 'activity_heartbeat';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_started
  ON user_sessions (started_at DESC);
