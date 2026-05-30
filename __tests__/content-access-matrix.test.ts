import {
  buildContentAccessKey,
  canAccessContent,
  getContentAccessConfig,
  getLockedBehavior,
  shouldPersistContent,
  shouldPrecalculate,
  type UserState,
} from '../lib/contentAccessMatrix';

const freeUser: UserState = {
  userId: 'user-free',
  chartId: 1,
  isPremium: false,
  unlockedContent: [],
};

const premiumUser: UserState = {
  ...freeUser,
  userId: 'user-premium',
  isPremium: true,
};

function userWithUnlock(
  surface: UserState['unlockedContent'][number]['surface'],
  variant: UserState['unlockedContent'][number]['variant'],
  accessTier: 'stars' | 'lumi' | 'premium' = 'stars',
  cacheKey = '2026-05-29'
): UserState {
  return {
    ...freeUser,
    userId: 'user-unlocked',
    unlockedContent: [{ surface, variant, accessTier, cacheKey }],
  };
}

describe('contentAccessMatrix', () => {
  describe('free tier access', () => {
    it('allows forecast/daily for free users', () => {
      const config = getContentAccessConfig('forecast', 'daily');
      expect(config?.defaultAccessTier).toBe('free');
      expect(canAccessContent(freeUser, 'forecast', 'daily')).toBe(true);
    });

    it('allows synastry/brief for free users', () => {
      expect(canAccessContent(freeUser, 'synastry', 'brief')).toBe(true);
    });

    it('allows question/brief for free users', () => {
      expect(canAccessContent(freeUser, 'question', 'brief')).toBe(true);
    });
  });

  describe('premium-only natal surfaces', () => {
    it('requires premium for planet_insight without stars unlock option', () => {
      const config = getContentAccessConfig('natal', 'planet_insight');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(config?.lockedBehavior.allowStarsUnlock).toBe(false);
      expect(config?.starsCost).toBeNull();
    });

    it('requires premium for natal/full and natal/living', () => {
      expect(getContentAccessConfig('natal', 'full')?.unlockOptions).toEqual(['premium']);
      expect(getContentAccessConfig('natal', 'living')?.unlockOptions).toEqual(['premium']);
    });
  });

  describe('premium-only paid surfaces', () => {
    it.each(['morning', 'day', 'evening'] as const)(
      'requires premium for forecast/%s',
      (variant) => {
        const config = getContentAccessConfig('forecast', variant);
        expect(config?.defaultAccessTier).toBe('premium');
        expect(config?.unlockOptions).toEqual(['premium']);
        expect(config?.starsCost).toBeNull();
        expect(config?.lockedBehavior.allowStarsUnlock).toBe(false);
        expect(canAccessContent(freeUser, 'forecast', variant)).toBe(false);
        expect(canAccessContent(premiumUser, 'forecast', variant)).toBe(true);
      }
    );

    it('requires premium for synastry/full', () => {
      const config = getContentAccessConfig('synastry', 'full');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(config?.starsCost).toBeNull();
      expect(config?.lockedBehavior.allowStarsUnlock).toBe(false);
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });

    it('allows forecast daypart via legacy forecast/full stars unlock rows', () => {
      const unlockUser = userWithUnlock('forecast', 'full', 'stars', '2026-05-29');
      expect(canAccessContent(unlockUser, 'forecast', 'morning', '2026-05-29')).toBe(true);
    });
  });

  describe('question tiers', () => {
    it('requires premium for question/one_off without legacy unlock', () => {
      const config = getContentAccessConfig('question', 'one_off');
      expect(config?.defaultAccessTier).toBe('premium');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(config?.starsCost).toBeNull();
      expect(config?.lockedBehavior.allowStarsUnlock).toBe(false);
      expect(canAccessContent(freeUser, 'question', 'one_off')).toBe(false);
      expect(canAccessContent(premiumUser, 'question', 'full')).toBe(true);
      expect(canAccessContent(freeUser, 'question', 'full')).toBe(false);
    });
  });

  describe('canAccessContent unlocks', () => {
    it('returns true for premium users on premium variants', () => {
      expect(canAccessContent(premiumUser, 'forecast', 'morning')).toBe(true);
    });

    it('returns true for legacy one_off unlock rows', () => {
      const unlockUser = userWithUnlock('question', 'one_off', 'stars', 'question-hash');
      expect(canAccessContent(unlockUser, 'question', 'one_off', 'question-hash')).toBe(true);
    });

    it('maps legacy lumi unlock to stars access', () => {
      const unlockUser = userWithUnlock('question', 'one_off', 'lumi', 'question-hash');
      expect(canAccessContent(unlockUser, 'question', 'one_off', 'question-hash')).toBe(true);
    });
  });

  describe('calculation and persistence flags', () => {
    it('marks calculation-required surfaces for precalculation', () => {
      expect(shouldPrecalculate('forecast', 'morning')).toBe(true);
      expect(shouldPrecalculate('question', 'one_off')).toBe(true);
    });

    it('returns persist flags according to matrix', () => {
      expect(shouldPersistContent('forecast', 'morning')).toBe(true);
      expect(shouldPersistContent('question', 'one_off')).toBe(true);
    });
  });

  describe('locked behavior', () => {
    it('returns unlocked behavior when access is granted', () => {
      const behavior = getLockedBehavior(premiumUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(false);
    });

    it('returns premium-only locked behavior when access is denied', () => {
      const behavior = getLockedBehavior(freeUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(true);
      expect(behavior.allowStarsUnlock).toBe(false);
      expect(behavior.requirePremium).toBe(true);
    });
  });

  describe('registry', () => {
    it('indexes every matrix entry by surface:variant key', () => {
      expect(buildContentAccessKey('question', 'brief')).toBe('question:brief');
      expect(getContentAccessConfig('question', 'brief')).not.toBeNull();
    });
  });
});
