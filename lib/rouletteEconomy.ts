import { randomInt } from 'crypto';

/**
 * Variable reward curve (mobile retention best practice):
 * mostly small positive reinforcement, rare "jackpot" moments.
 */
export type RouletteTier = 'spark' | 'glow' | 'beam' | 'aurora';
export const ROULETTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function pickDailyRouletteReward(): { amount: number; tier: RouletteTier } {
  const r = randomInt(0, 100);
  if (r < 3) {
    return { amount: randomInt(55, 81), tier: 'aurora' };
  }
  if (r < 15) {
    return { amount: randomInt(28, 46), tier: 'beam' };
  }
  if (r < 50) {
    return { amount: randomInt(15, 26), tier: 'glow' };
  }
  return { amount: randomInt(5, 13), tier: 'spark' };
}

export function getRouletteTierForAmount(amount: number): RouletteTier {
  if (amount >= 55) return 'aurora';
  if (amount >= 28) return 'beam';
  if (amount >= 15) return 'glow';
  return 'spark';
}
