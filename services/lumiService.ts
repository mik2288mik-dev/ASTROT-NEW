/**
 * Lumi Economy Core - Lumia MVP
 *
 * Handles:
 * - read user balance
 * - add Lumi
 * - spend Lumi
 * - log every transaction
 * - enforce insufficient balance protection
 */

import { db } from '../lib/db';

const log = {
  info: (msg: string, data?: any) => console.log(`[LumiService] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[LumiService] ERROR: ${msg}`, err || ''),
};

/** Explicit reason strings - do not use vague or pattern-based reasons */
export const LUMI_REASONS = {
  daily_login: 'daily_login',
  streak_bonus: 'streak_bonus',
  referral_bonus: 'referral_bonus',
  roulette_win: 'roulette_win',
  deep_dive: 'deep_dive',
  synastry: 'synastry',
  question: 'question',
  daily_card: 'daily_card',
  chart_slot: 'chart_slot',
  admin_lumi_add: 'admin_lumi_add',
  admin_lumi_subtract: 'admin_lumi_subtract',
  regenerate_natal: 'regenerate_natal',
  regenerate_deep_dive: 'regenerate_deep_dive',
  regenerate_synastry: 'regenerate_synastry',
  premium_bonus: 'premium_bonus',
  refund: 'refund',
} as const;

export type LumiReason = (typeof LUMI_REASONS)[keyof typeof LUMI_REASONS];

function validateAmount(amount: number): void {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer');
  }
}

function validateReason(reason: string): void {
  // Allow any string; log if not in predefined list
  if (!Object.values(LUMI_REASONS).includes(reason as LumiReason)) {
    log.info(`Reason "${reason}" used (not in LUMI_REASONS)`);
  }
}

/**
 * Get current Lumi balance for user
 */
export async function getBalance(userId: string): Promise<number> {
  if (!userId?.trim()) throw new Error('UserId is required');
  return db.lumi_transactions.getBalance(userId);
}

/**
 * Add Lumi to user balance.
 * Transactional: updates users.lumi_balance and inserts lumi_transactions row atomically.
 */
export async function addLumi(
  userId: string,
  amount: number,
  reason: string
): Promise<{ balance: number; success: true }> {
  if (!userId?.trim()) throw new Error('UserId is required');
  validateAmount(amount);
  validateReason(reason);

  const result = await db.lumi_transactions.addTransactional(userId, amount, reason);
  log.info('addLumi', { userId, amount, reason, newBalance: result.newBalance });
  return { balance: result.newBalance, success: true };
}

/**
 * Spend Lumi from user balance.
 * Fails if insufficient balance.
 * Transactional: updates users.lumi_balance and inserts lumi_transactions row atomically.
 */
export async function spendLumi(
  userId: string,
  amount: number,
  reason: string
): Promise<{ balance: number; success: true }> {
  if (!userId?.trim()) throw new Error('UserId is required');
  validateAmount(amount);
  validateReason(reason);

  const currentBalance = await db.lumi_transactions.getBalance(userId);
  if (currentBalance < amount) {
    throw new Error(`Insufficient Lumi balance. Required: ${amount}, available: ${currentBalance}`);
  }

  const result = await db.lumi_transactions.deductTransactional(userId, amount, reason);
  log.info('spendLumi', { userId, amount, reason, newBalance: result.newBalance });
  return { balance: result.newBalance, success: true };
}

/**
 * Get transaction history for user
 */
export async function getHistory(
  userId: string,
  limit = 50
): Promise<{ amount: number; reason: string; created_at: string }[]> {
  if (!userId?.trim()) throw new Error('UserId is required');
  return db.lumi_transactions.getHistory(userId, limit);
}
