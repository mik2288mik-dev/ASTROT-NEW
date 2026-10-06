/**
 * Small personal records of home features (hidden «Для тебя» offers, wishes for
 * the month, test results, mood check-ins…): one JSON value per user, feature
 * and key. Kept on the server so the same account sees them in the Android
 * app, the Telegram mini app and on the web.
 */
import type { Pool } from 'pg';
import { getPool } from './db';
import { USER_FEATURE_STATE_SCHEMA_SQL } from './userFeatureStateSchema';

/** Features that may store records; anything else is rejected. */
export const USER_FEATURES = ['for_you', 'wishes', 'month_review', 'tests', 'mood_week', 'stories', 'daily_task', 'home_people', 'antistress'] as const;
export type UserFeature = typeof USER_FEATURES[number];

export const USER_FEATURE_VALUE_MAX_BYTES = 8_192;
export const USER_FEATURE_KEYS_MAX = 200;
const KEY_PATTERN = /^[A-Za-z0-9:_.-]{1,64}$/;

export function isUserFeature(value: unknown): value is UserFeature {
  return typeof value === 'string' && (USER_FEATURES as readonly string[]).includes(value);
}

export function isUserFeatureKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

let schemaReady: Promise<void> | null = null;
/** Creates the table on first use: deploys do not always run `npm run migrate`. */
export function ensureUserFeatureStateSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(USER_FEATURE_STATE_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export async function readUserFeatureState(userId: string, feature: UserFeature): Promise<Record<string, unknown>> {
  const pool = getPool();
  await ensureUserFeatureStateSchema(pool);
  const result = await pool.query(
    `SELECT item_key, value FROM user_feature_state WHERE user_id = $1 AND feature = $2
     ORDER BY updated_at DESC LIMIT ${USER_FEATURE_KEYS_MAX}`,
    [userId, feature],
  );
  return Object.fromEntries(result.rows.map((row: { item_key: string; value: unknown }) => [row.item_key, row.value]));
}

export async function writeUserFeatureState(userId: string, feature: UserFeature, key: string, value: unknown): Promise<void> {
  const pool = getPool();
  await ensureUserFeatureStateSchema(pool);
  if (value === null) {
    await pool.query('DELETE FROM user_feature_state WHERE user_id = $1 AND feature = $2 AND item_key = $3', [userId, feature, key]);
    return;
  }
  await pool.query(
    `INSERT INTO user_feature_state (user_id, feature, item_key, value) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (user_id, feature, item_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [userId, feature, key, JSON.stringify(value)],
  );
}
