/**
 * Gifts of a free week reading: for seven days in a row in NEBO and for a year
 * with NEBO. Conditions are checked on the server from users.login_streak and
 * users.created_at, so a gift cannot be claimed from the client by itself.
 */
import type { Pool } from 'pg';
import { getPool } from './db';

export const FORECAST_GIFTS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS forecast_gifts (
    user_id TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period = 'week'),
    period_key TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('streak', 'anniversary')),
    streak_at_claim INTEGER NOT NULL DEFAULT 0,
    claimed_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, period, period_key)
  );
  CREATE INDEX IF NOT EXISTS forecast_gifts_user_idx ON forecast_gifts (user_id, reason, claimed_on DESC);
`;

export const STREAK_GIFT_DAYS = 7;

export type GiftReason = 'streak' | 'anniversary';
export type PreviousClaim = { reason: GiftReason; claimedOn: string; streakAtClaim: number };

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/**
 * Which gift can be claimed now. A streak gift comes every seven days of the
 * same run; a broken run starts counting again, no penalty, no warnings.
 */
export function claimableGift(input: {
  today: string;
  streak: number;
  createdAt: string | null;
  claims: readonly PreviousClaim[];
}): GiftReason | null {
  const lastStreak = input.claims.filter((claim) => claim.reason === 'streak').sort((a, b) => b.claimedOn.localeCompare(a.claimedOn))[0];
  if (input.streak >= STREAK_GIFT_DAYS) {
    if (!lastStreak) return 'streak';
    const gap = daysBetween(lastStreak.claimedOn, input.today);
    const sameRun = input.streak > lastStreak.streakAtClaim && input.streak - lastStreak.streakAtClaim === gap;
    if (sameRun ? input.streak - lastStreak.streakAtClaim >= STREAK_GIFT_DAYS : gap >= 1) return 'streak';
  }
  if (input.createdAt) {
    const age = daysBetween(input.createdAt.slice(0, 10), input.today);
    const year = input.today.slice(0, 4);
    const claimedThisYear = input.claims.some((claim) => claim.reason === 'anniversary' && claim.claimedOn.slice(0, 4) === year);
    if (age >= 365 && !claimedThisYear) return 'anniversary';
  }
  return null;
}

/** Days left in the current run before the next streak gift (0 — ready). */
export function daysToStreakGift(streak: number, claims: readonly PreviousClaim[], today: string): number {
  const last = claims.filter((claim) => claim.reason === 'streak').sort((a, b) => b.claimedOn.localeCompare(a.claimedOn))[0];
  const sameRun = last && streak > last.streakAtClaim && streak - last.streakAtClaim === daysBetween(last.claimedOn, today);
  const counted = sameRun ? streak - last!.streakAtClaim : streak;
  return Math.max(0, STREAK_GIFT_DAYS - counted);
}

let schemaReady: Promise<void> | null = null;
export function ensureForecastGiftsSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(FORECAST_GIFTS_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export async function readGiftClaims(userId: string, pool: Pool = getPool()): Promise<Array<PreviousClaim & { periodKey: string }>> {
  await ensureForecastGiftsSchema(pool);
  const result = await pool.query(
    'SELECT reason, claimed_on, streak_at_claim, period_key FROM forecast_gifts WHERE user_id = $1 ORDER BY claimed_on DESC LIMIT 60',
    [userId],
  );
  return result.rows.map((row: Record<string, any>) => ({
    reason: row.reason,
    claimedOn: row.claimed_on instanceof Date ? row.claimed_on.toISOString().slice(0, 10) : String(row.claimed_on).slice(0, 10),
    streakAtClaim: Number(row.streak_at_claim) || 0,
    periodKey: row.period_key,
  }));
}

export async function hasWeekGift(userId: string, periodKey: string, pool: Pool = getPool()): Promise<boolean> {
  await ensureForecastGiftsSchema(pool);
  const result = await pool.query('SELECT 1 FROM forecast_gifts WHERE user_id = $1 AND period = $2 AND period_key = $3', [userId, 'week', periodKey]);
  return result.rows.length > 0;
}

export async function saveWeekGift(input: { userId: string; periodKey: string; reason: GiftReason; streak: number; today: string }, pool: Pool = getPool()): Promise<boolean> {
  await ensureForecastGiftsSchema(pool);
  const result = await pool.query(
    `INSERT INTO forecast_gifts (user_id, period, period_key, reason, streak_at_claim, claimed_on)
     VALUES ($1, 'week', $2, $3, $4, $5::date) ON CONFLICT DO NOTHING`,
    [input.userId, input.periodKey, input.reason, input.streak, input.today],
  );
  return (result.rowCount ?? 0) > 0;
}
