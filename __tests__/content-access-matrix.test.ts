import {
  buildContentAccessKey,
  canAccessContent,
  getContentAccessConfig,
  getLockedBehavior,
  shouldPersistContent,
  shouldPrecalculate,
  type UserState,
} from '../lib/contentAccessMatrix';
import { ASK_LUMIA_STARS_COST } from '../lib/questionContent';
import { FORECAST_FULL_DAY_STARS_COST } from '../lib/forecastFullDay';

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

  describe('premium or stars required', () => {
    it.each(['morning', 'day', 'evening'] as const)(
      'requires premium or stars for forecast/%s',
      (variant) => {
        const config = getContentAccessConfig('forecast', variant);
        expect(config?.defaultAccessTier).toBe('premium');
        expect(config?.unlockOptions).toEqual(expect.arrayContaining(['premium', 'stars']));
        expect(canAccessContent(freeUser, 'forecast', variant)).toBe(false);
        expect(canAccessContent(premiumUser, 'forecast', variant)).toBe(true);
      }
    );

    it('requires premium or stars for synastry/full', () => {
      const config = getContentAccessConfig('synastry', 'full');
      expect(config?.unlockOptions).toEqual(expect.arrayContaining(['premium', 'stars']));
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });

    it('allows forecast daypart via legacy forecast/full lumi unlock mapped as stars', () => {
      const unlockUser = userWithUnlock('forecast', 'full', 'lumi', '2026-05-29');
      expect(canAccessContent(unlockUser, 'forecast', 'morning', '2026-05-29')).toBe(true);
    });

    it('allows forecast daypart via stars unlock', () => {
      const unlockUser = userWithUnlock('forecast', 'full', 'stars', '2026-05-29');
      expect(canAccessContent(unlockUser, 'forecast', 'evening', '2026-05-29')).toBe(true);
    });
  });

  describe('question tiers', () => {
    it('requires stars payment/unlock for question/one_off without unlock', () => {
      const config = getContentAccessConfig('question', 'one_off');
      expect(config?.defaultAccessTier).toBe('stars');
      expect(config?.unlockOptions).toEqual(['stars']);
      expect(config?.starsCost).toBe(ASK_LUMIA_STARS_COST);
      expect(canAccessContent(freeUser, 'question', 'one_off')).toBe(false);
      expect(canAccessContent(premiumUser, 'question', 'one_off')).toBe(false);
    });

    it('requires premium for question/full', () => {
      expect(canAccessContent(premiumUser, 'question', 'full')).toBe(true);
      expect(canAccessContent(freeUser, 'question', 'full')).toBe(false);
    });
  });

  describe('canAccessContent unlocks', () => {
    it('returns true for premium users on premium variants', () => {
      expect(canAccessContent(premiumUser, 'forecast', 'morning')).toBe(true);
    });

    it('returns true for stars variant when an active unlock exists', () => {
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

    it('uses expected stars costs from legacy pricing constants', () => {
      expect(getContentAccessConfig('forecast', 'morning')?.starsCost).toBe(FORECAST_FULL_DAY_STARS_COST);
      expect(getContentAccessConfig('question', 'one_off')?.starsCost).toBe(ASK_LUMIA_STARS_COST);
    });
  });

  describe('locked behavior', () => {
    it('returns unlocked behavior when access is granted', () => {
      const behavior = getLockedBehavior(premiumUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(false);
    });

    it('returns matrix locked behavior when access is denied', () => {
      const behavior = getLockedBehavior(freeUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(true);
      expect(behavior.allowStarsUnlock).toBe(true);
    });
  });

  describe('registry', () => {
    it('indexes every matrix entry by surface:variant key', () => {
      expect(buildContentAccessKey('question', 'brief')).toBe('question:brief');
      expect(getContentAccessConfig('question', 'brief')).not.toBeNull();
    });
  });
});
