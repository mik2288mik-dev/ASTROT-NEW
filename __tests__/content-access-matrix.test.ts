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
  accessTier: 'premium' = 'premium',
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
    it('requires premium for planet_insight', () => {
      const config = getContentAccessConfig('natal', 'planet_insight');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(config?.lockedBehavior.requirePremium).toBe(true);
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
        expect(canAccessContent(freeUser, 'forecast', variant)).toBe(false);
        expect(canAccessContent(premiumUser, 'forecast', variant)).toBe(true);
      }
    );

    it('requires premium for synastry/full', () => {
      const config = getContentAccessConfig('synastry', 'full');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });

    it('allows forecast daypart via premium unlock rows only', () => {
      const unlockUser = userWithUnlock('forecast', 'full', 'premium', '2026-05-29');
      expect(canAccessContent(unlockUser, 'forecast', 'morning', '2026-05-29')).toBe(true);
    });
  });

  describe('question tiers', () => {
    it('requires premium for question/full', () => {
      const config = getContentAccessConfig('question', 'full');
      expect(config?.defaultAccessTier).toBe('premium');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(canAccessContent(freeUser, 'question', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'question', 'full')).toBe(true);
    });
  });

  describe('canAccessContent unlocks', () => {
    it('returns true for premium users on premium variants', () => {
      expect(canAccessContent(premiumUser, 'forecast', 'morning')).toBe(true);
    });

    it('returns true for premium unlock rows', () => {
      const unlockUser = userWithUnlock('question', 'full', 'premium', 'question-hash');
      expect(canAccessContent(unlockUser, 'question', 'full', 'question-hash')).toBe(true);
    });
  });

  describe('calculation and persistence flags', () => {
    it('marks calculation-required surfaces for precalculation', () => {
      expect(shouldPrecalculate('forecast', 'morning')).toBe(true);
      expect(shouldPrecalculate('question', 'full')).toBe(true);
    });

    it('returns persist flags according to matrix', () => {
      expect(shouldPersistContent('forecast', 'morning')).toBe(true);
      expect(shouldPersistContent('question', 'full')).toBe(true);
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
      expect(behavior.requirePremium).toBe(true);
    });
  });

  describe('registry', () => {
    it('indexes every matrix entry by surface:variant key', () => {
      expect(buildContentAccessKey('question', 'brief')).toBe('question:brief');
      expect(getContentAccessConfig('question', 'brief')).not.toBeNull();
    });
  });

  describe('additive premium model', () => {
    const FREE_BASELINE: Array<[UserState['unlockedContent'][number]['surface'], UserState['unlockedContent'][number]['variant']]> = [
      ['natal', 'anchor'],
      ['forecast', 'daily'],
      ['synastry', 'brief'],
      ['question', 'brief'],
    ];

    const PREMIUM_ONLY: Array<[UserState['unlockedContent'][number]['surface'], UserState['unlockedContent'][number]['variant']]> = [
      ['natal', 'full'],
      ['natal', 'planet_insight'],
      ['natal', 'living'],
      ['forecast', 'morning'],
      ['forecast', 'day'],
      ['forecast', 'evening'],
      ['forecast', 'weekly'],
      ['forecast', 'monthly'],
      ['synastry', 'full'],
      ['question', 'full'],
    ];

    it('free baseline layers stay free in the matrix config', () => {
      for (const [surface, variant] of FREE_BASELINE) {
        const config = getContentAccessConfig(surface, variant);
        expect(config).not.toBeNull();
        expect(config?.defaultAccessTier).toBe('free');
        expect(config?.unlockOptions).toEqual(['free']);
        expect(config?.lockedBehavior.requirePremium).toBe(false);
      }
    });

    it('premium layers require Premium in the matrix config', () => {
      for (const [surface, variant] of PREMIUM_ONLY) {
        const config = getContentAccessConfig(surface, variant);
        expect(config).not.toBeNull();
        expect(config?.defaultAccessTier).toBe('premium');
        expect(config?.unlockOptions).toEqual(['premium']);
        expect(config?.lockedBehavior.requirePremium).toBe(true);
      }
    });

    it('premium users keep access to every free layer', () => {
      expect(canAccessContent(premiumUser, 'natal', 'anchor')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'daily')).toBe(true);
      expect(canAccessContent(premiumUser, 'synastry', 'brief')).toBe(true);
      expect(canAccessContent(premiumUser, 'question', 'brief')).toBe(true);
    });

    it('free users get only the free baseline layers', () => {
      expect(canAccessContent(freeUser, 'natal', 'anchor')).toBe(true);
      expect(canAccessContent(freeUser, 'forecast', 'daily')).toBe(true);
      expect(canAccessContent(freeUser, 'synastry', 'brief')).toBe(true);
      expect(canAccessContent(freeUser, 'question', 'brief')).toBe(true);

      expect(canAccessContent(freeUser, 'natal', 'full')).toBe(false);
      expect(canAccessContent(freeUser, 'natal', 'planet_insight')).toBe(false);
      expect(canAccessContent(freeUser, 'natal', 'living')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'morning')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'day')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'evening')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'weekly')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'monthly')).toBe(false);
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(freeUser, 'question', 'full')).toBe(false);
    });

    it('premium users get baseline plus all premium layers', () => {
      expect(canAccessContent(premiumUser, 'natal', 'anchor')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'daily')).toBe(true);
      expect(canAccessContent(premiumUser, 'synastry', 'brief')).toBe(true);
      expect(canAccessContent(premiumUser, 'question', 'brief')).toBe(true);

      expect(canAccessContent(premiumUser, 'natal', 'full')).toBe(true);
      expect(canAccessContent(premiumUser, 'natal', 'planet_insight')).toBe(true);
      expect(canAccessContent(premiumUser, 'natal', 'living')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'morning')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'day')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'evening')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'weekly')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'monthly')).toBe(true);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
      expect(canAccessContent(premiumUser, 'question', 'full')).toBe(true);
    });
  });
});
