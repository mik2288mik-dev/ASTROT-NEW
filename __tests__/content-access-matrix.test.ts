import {
  buildContentAccessKey,
  canAccessContent,
  getContentAccessConfig,
  getLockedBehavior,
  shouldPersistContent,
  shouldPrecalculate,
  type UserState,
} from '../lib/contentAccessMatrix';
import { ASK_LUMIA_LUMI_COST } from '../lib/questionContent';
import { FORECAST_FULL_DAY_LUMI_COST } from '../lib/forecastFullDay';

const freeUser: UserState = {
  userId: 'user-free',
  chartId: 1,
  isPremium: false,
  lumiBalance: 0,
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
  accessTier: 'lumi' | 'premium' = 'lumi',
  cacheKey = '2026-05-29'
): UserState {
  return {
    ...freeUser,
    userId: 'user-unlocked',
    lumiBalance: 500,
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
      const config = getContentAccessConfig('synastry', 'brief');
      expect(config?.defaultAccessTier).toBe('free');
      expect(canAccessContent(freeUser, 'synastry', 'brief')).toBe(true);
    });

    it('allows question/brief for free users', () => {
      const config = getContentAccessConfig('question', 'brief');
      expect(config?.defaultAccessTier).toBe('free');
      expect(canAccessContent(freeUser, 'question', 'brief')).toBe(true);
    });
  });

  describe('premium or lumi required', () => {
    it.each(['morning', 'day', 'evening'] as const)(
      'requires premium or lumi for forecast/%s',
      (variant) => {
        const config = getContentAccessConfig('forecast', variant);
        expect(config?.defaultAccessTier).toBe('premium');
        expect(config?.unlockOptions).toEqual(expect.arrayContaining(['premium', 'lumi']));
        expect(canAccessContent(freeUser, 'forecast', variant)).toBe(false);
        expect(canAccessContent(premiumUser, 'forecast', variant)).toBe(true);
      }
    );

    it('requires premium or lumi for synastry/full', () => {
      const config = getContentAccessConfig('synastry', 'full');
      expect(config?.defaultAccessTier).toBe('premium');
      expect(config?.unlockOptions).toEqual(expect.arrayContaining(['premium', 'lumi']));
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });

    it('allows forecast daypart via legacy forecast/full lumi unlock', () => {
      const unlockUser = userWithUnlock('forecast', 'full', 'lumi', '2026-05-29');
      expect(canAccessContent(unlockUser, 'forecast', 'morning', '2026-05-29')).toBe(true);
    });
  });

  describe('question tiers', () => {
    it('requires lumi for question/one_off without unlock', () => {
      const config = getContentAccessConfig('question', 'one_off');
      expect(config?.defaultAccessTier).toBe('lumi');
      expect(config?.unlockOptions).toEqual(['lumi']);
      expect(config?.lumiCost).toBe(ASK_LUMIA_LUMI_COST);
      expect(canAccessContent(freeUser, 'question', 'one_off')).toBe(false);
      expect(canAccessContent(premiumUser, 'question', 'one_off')).toBe(false);
    });

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
      expect(canAccessContent(premiumUser, 'question', 'full')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'morning')).toBe(true);
      expect(canAccessContent(premiumUser, 'natal', 'full')).toBe(true);
    });

    it('returns true for lumi variant when an active unlock exists', () => {
      const unlockUser = userWithUnlock('question', 'one_off', 'lumi', 'question-hash');
      expect(canAccessContent(unlockUser, 'question', 'one_off', 'question-hash')).toBe(true);
    });
  });

  describe('calculation and persistence flags', () => {
    it('marks calculation-required surfaces for precalculation', () => {
      expect(shouldPrecalculate('forecast', 'daily')).toBe(true);
      expect(shouldPrecalculate('forecast', 'morning')).toBe(true);
      expect(shouldPrecalculate('question', 'one_off')).toBe(true);
      expect(shouldPrecalculate('unknown' as any, 'daily')).toBe(false);
    });

    it('returns persist flags according to matrix', () => {
      expect(shouldPersistContent('natal', 'anchor')).toBe(true);
      expect(shouldPersistContent('forecast', 'daily')).toBe(true);
      expect(shouldPersistContent('forecast', 'morning')).toBe(true);
      expect(shouldPersistContent('question', 'one_off')).toBe(true);
    });

    it('uses expected lumi costs from existing economy constants', () => {
      expect(getContentAccessConfig('forecast', 'morning')?.lumiCost).toBe(FORECAST_FULL_DAY_LUMI_COST);
      expect(getContentAccessConfig('question', 'one_off')?.lumiCost).toBe(ASK_LUMIA_LUMI_COST);
    });
  });

  describe('locked behavior', () => {
    it('returns unlocked behavior when access is granted', () => {
      const behavior = getLockedBehavior(premiumUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(false);
      expect(behavior.requirePremium).toBe(false);
    });

    it('returns matrix locked behavior when access is denied', () => {
      const behavior = getLockedBehavior(freeUser, 'forecast', 'morning');
      expect(behavior.showLockedCard).toBe(true);
      expect(behavior.requirePremium).toBe(true);
      expect(behavior.allowLumiUnlock).toBe(true);
    });
  });

  describe('registry', () => {
    it('indexes every matrix entry by surface:variant key', () => {
      expect(buildContentAccessKey('question', 'brief')).toBe('question:brief');
      expect(getContentAccessConfig('question', 'brief')).not.toBeNull();
    });
  });
});
