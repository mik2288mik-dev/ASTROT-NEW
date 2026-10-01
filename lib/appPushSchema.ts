/** Схема рассылок в Android-приложение (используется миграцией и страховочным ensureAppPushSchema). */
export const APP_PUSH_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS app_push_devices (
    token TEXT PRIMARY KEY CHECK (token ~ '^[a-f0-9]{48}$'),
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    language TEXT NOT NULL DEFAULT 'ru',
    sign TEXT,
    start_cursor BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS app_push_devices_user_idx ON app_push_devices (user_id);
  CREATE TABLE IF NOT EXISTS app_push_messages (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    route TEXT NOT NULL DEFAULT 'today',
    audience TEXT NOT NULL CHECK (audience IN ('all', 'user', 'sign')),
    target TEXT,
    send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS app_push_deliveries (
    message_id BIGINT NOT NULL REFERENCES app_push_messages(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, device_token)
  );
`;
