/**
 * Daily Login Bonus and Streak - Lumia MVP
 *
 * Rules:
 * - First login of a new streak day: +3 Lumi (daily_login)
 * - Streak day 3: +10 Lumi bonus (streak_bonus)
 * - Streak day 7: +20 Lumi bonus (streak_bonus)
 * - Streak day 30: +30 Lumi bonus (streak_bonus)
 * - Miss 1 full day → streak resets to 1 on next valid login
 *
 * All date comparisons use UTC.
 */

import { db } from '../lib/db';

const log = {
  info: (msg: string, data?: any) => console.log(`[StreakService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[StreakService] ERROR: ${msg}`, err || ''),
};

const DAILY_REWARD = 3;
const STREAK_BONUSES: Record<number, number> = {
  3: 10,
  7: 20,
  30: 30,
};

export interface ProcessDailyLoginResult {
  awardedToday: boolean;
  dailyReward?: number;
  streakBonus?: number;
  streak: number;
  newBalance: number;
}

export interface StreakInfo {
  streak: number;
  lastLogin: string | null;
  nextMilestone: number | null; // e.g. 3, 7, 30
}

/**
 * Process daily login: check eligibility, award Lumi, update streak.
 * Atomic: prevents double-award for the same day.
 */
export async function processDailyLogin(userId: string): Promise<ProcessDailyLoginResult> {
  if (!userId?.trim()) throw new Error('UserId is required');

  const result = await db.users.processDailyLogin(userId);
  if (result) {
    log.info('processDailyLogin', {
      userId,
      awardedToday: result.awardedToday,
      streak: result.streak,
      newBalance: result.newBalance,
    });
  }
  return result;
}

/**
 * Get current streak info (read-only).
 */
export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  if (!userId?.trim()) throw new Error('UserId is required');

  const user = await db.users.get(userId);
  if (!user) {
    return { streak: 0, lastLogin: null, nextMilestone: 3 };
  }

  const streak = user.login_streak ?? 0;
  const lastLogin = user.last_login ? String(user.last_login) : null;

  // Next milestone: 3, 7, or 30
  const milestones = [3, 7, 30];
  const nextMilestone = milestones.find((m) => streak < m) ?? null;

  return { streak, lastLogin, nextMilestone };
}
