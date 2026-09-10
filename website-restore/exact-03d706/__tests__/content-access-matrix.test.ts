import {
  buildContentAccessKey,
  canAccessContent,
  getContentAccessConfig,
  getLockedBehavior,
  shouldPersistContent,
  shouldPrecalculate,
  type UserState,
} from '../lib/contentAccessMatrix';
import {
  canAccessFeature,
  hasActivePremium,
  hasNatalChart,
  listFeatureAccessMatrix,
} from '../lib/accessMatrix';

const freeUser: UserState = {
  userId: 'user-free',
  chartId: 1,
  isPremium: false,
  entitlementState: 'free',
  unlockedContent: [],
};

const premiumUser: UserState = {
  ...freeUser,
  userId: 'user-premium',
  isPremium: true,
  entitlementState: 'paid',
  entitlementEndsAt: '2099-09-01T00:00:00.000Z',
};

const giftUser: UserState = {
  ...freeUser,
  userId: 'user-gift',
  isPremium: false,
  entitlementState: undefined,
  premiumUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

    it('keeps sign compatibility free but gates chart-based synastry', () => {
      expect(canAccessFeature('zodiac_compatibility', freeUser, null).allowed).toBe(true);
      expect(canAccessContent(freeUser, 'synastry', 'brief')).toBe(false);
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

  describe('personal horoscope surfaces', () => {
    it('keeps forecast/daily free and calculation-free', () => {
      const config = getContentAccessConfig('forecast', 'daily');
      expect(config?.defaultAccessTier).toBe('free');
      expect(config?.calculationRequired).toBe(false);
      expect(canAccessContent({ ...freeUser, chartId: null }, 'forecast', 'daily')).toBe(true);
    });

    it.each(['weekly', 'monthly'] as const)('requires Premium but no chart for forecast/%s', (variant) => {
      const config = getContentAccessConfig('forecast', variant);
      expect(config?.defaultAccessTier).toBe('premium');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(config?.calculationRequired).toBe(false);
      expect(canAccessContent({ ...freeUser, chartId: null }, 'forecast', variant)).toBe(false);
      expect(canAccessContent({ ...premiumUser, chartId: null }, 'forecast', variant)).toBe(true);
    });

    it('requires premium for synastry/full', () => {
      const config = getContentAccessConfig('synastry', 'full');
      expect(config?.unlockOptions).toEqual(['premium']);
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });
  });

  describe('canAccessContent unlocks', () => {
    it('returns true for premium users on premium variants', () => {
      expect(canAccessContent(premiumUser, 'natal', 'full')).toBe(true);
    });

    it('returns true for legacy gift users with future premiumUntil on premium variants', () => {
      expect(canAccessContent(giftUser, 'natal', 'full')).toBe(true);
    });

    it('does not treat legacy unlock rows as a second Premium entitlement', () => {
      const unlockUser = userWithUnlock('synastry', 'full', 'premium', 'pair-hash');
      expect(canAccessContent(unlockUser, 'synastry', 'full', 'pair-hash')).toBe(false);
    });
  });

  describe('calculation and persistence flags', () => {
    it('does not pre-calculate AI personal horoscopes but still pre-calculates chart products', () => {
      expect(shouldPrecalculate('forecast', 'daily')).toBe(false);
      expect(shouldPrecalculate('forecast', 'weekly')).toBe(false);
      expect(shouldPrecalculate('forecast', 'monthly')).toBe(false);
      expect(shouldPrecalculate('synastry', 'full')).toBe(true);
    });

    it('returns persist flags according to matrix', () => {
      expect(shouldPersistContent('forecast', 'daily')).toBe(true);
      expect(shouldPersistContent('synastry', 'full')).toBe(true);
    });
  });

  describe('locked behavior', () => {
    it('returns unlocked behavior when access is granted', () => {
      const behavior = getLockedBehavior(premiumUser, 'natal', 'full');
      expect(behavior.showLockedCard).toBe(false);
    });

    it('returns premium-only locked behavior when access is denied', () => {
      const behavior = getLockedBehavior(freeUser, 'natal', 'full');
      expect(behavior.showLockedCard).toBe(true);
      expect(behavior.requirePremium).toBe(true);
    });
  });

  describe('registry', () => {
    it('indexes every matrix entry by surface:variant key', () => {
      expect(buildContentAccessKey('synastry', 'brief')).toBe('synastry:brief');
      expect(getContentAccessConfig('synastry', 'brief')).not.toBeNull();
    });
  });

  describe('additive premium model', () => {
    const FREE_BASELINE: Array<[UserState['unlockedContent'][number]['surface'], UserState['unlockedContent'][number]['variant']]> = [
      ['natal', 'anchor'],
      ['forecast', 'daily'],
    ];

    const PREMIUM_ONLY: Array<[UserState['unlockedContent'][number]['surface'], UserState['unlockedContent'][number]['variant']]> = [
      ['natal', 'full'],
      ['natal', 'planet_insight'],
      ['natal', 'living'],
      ['forecast', 'weekly'],
      ['forecast', 'monthly'],
      ['synastry', 'brief'],
      ['synastry', 'full'],
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
    });

    it('free users get only the free baseline layers', () => {
      expect(canAccessContent(freeUser, 'natal', 'anchor')).toBe(true);
      expect(canAccessContent(freeUser, 'forecast', 'daily')).toBe(true);

      expect(canAccessContent(freeUser, 'natal', 'full')).toBe(false);
      expect(canAccessContent(freeUser, 'natal', 'planet_insight')).toBe(false);
      expect(canAccessContent(freeUser, 'natal', 'living')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'weekly')).toBe(false);
      expect(canAccessContent(freeUser, 'forecast', 'monthly')).toBe(false);
      expect(canAccessContent(freeUser, 'synastry', 'brief')).toBe(false);
      expect(canAccessContent(freeUser, 'synastry', 'full')).toBe(false);
    });

    it('premium users get baseline plus all premium layers', () => {
      expect(canAccessContent(premiumUser, 'natal', 'anchor')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'daily')).toBe(true);
      expect(canAccessContent(premiumUser, 'synastry', 'brief')).toBe(true);

      expect(canAccessContent(premiumUser, 'natal', 'full')).toBe(true);
      expect(canAccessContent(premiumUser, 'natal', 'planet_insight')).toBe(true);
      expect(canAccessContent(premiumUser, 'natal', 'living')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'weekly')).toBe(true);
      expect(canAccessContent(premiumUser, 'forecast', 'monthly')).toBe(true);
      expect(canAccessContent(premiumUser, 'synastry', 'full')).toBe(true);
    });
  });
});

describe('feature access matrix', () => {
  const futurePremiumUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const expiredPremiumUntil = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const giftProfile = {
    id: 'gift-user',
    name: 'Gift',
    language: 'ru' as const,
    theme: 'light' as const,
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    isSetup: false,
    isPremium: false,
    premiumUntil: futurePremiumUntil,
  };
  const chartState = { primaryChartId: 7 };

  it('ignores the legacy client flag and computes access from expiry-backed entitlement or admin', () => {
    expect(hasActivePremium({ isPremium: true })).toBe(false);
    expect(hasActivePremium({ isPremium: false, premiumUntil: futurePremiumUntil })).toBe(true);
    expect(hasActivePremium({ isPremium: false, premiumUntil: expiredPremiumUntil })).toBe(false);
    expect(hasActivePremium({ isPremium: false, isAdmin: true })).toBe(true);
  });

  it('detects natal chart only from complete chart data or a persisted chart id', () => {
    expect(hasNatalChart({ isSetup: true })).toBe(false);
    expect(hasNatalChart({ isSetup: false }, chartState)).toBe(true);
    expect(hasNatalChart({ isSetup: false }, { chartData: null, primaryChartId: null })).toBe(false);
  });

  it('keeps general sign content free without a chart', () => {
    expect(canAccessFeature('daily_sign_horoscope', giftProfile, { hasChart: false })).toMatchObject({
      allowed: true,
      status: 'allowed',
    });
    expect(canAccessFeature('zodiac_compatibility', { ...giftProfile, premiumUntil: null }, { hasChart: false })).toMatchObject({
      allowed: true,
      status: 'allowed',
    });
  });

  it('keeps personal horoscopes chart-free and applies only the Premium gate', () => {
    expect(canAccessFeature('personal_daily', { ...giftProfile, premiumUntil: null }, null)).toMatchObject({
      allowed: true,
      status: 'allowed',
      hasChart: false,
    });
    expect(canAccessFeature('personal_weekly', giftProfile, null)).toMatchObject({
      allowed: true,
      status: 'allowed',
      hasPremium: true,
      hasChart: false,
    });
    expect(canAccessFeature('personal_weekly', { ...giftProfile, premiumUntil: null }, null)).toMatchObject({
      allowed: false,
      status: 'needs_premium',
      hasPremium: false,
      hasChart: false,
    });
  });

  it('shows paywall when a chart-based Premium natal feature has no active Premium', () => {
    expect(canAccessFeature('natal_love', { ...giftProfile, premiumUntil: expiredPremiumUntil }, chartState)).toMatchObject({
      allowed: false,
      status: 'needs_premium',
      hasChart: true,
    });
  });

  it('keeps basic natal chart free once chart exists', () => {
    expect(canAccessFeature('natal_basic', { ...giftProfile, premiumUntil: null }, chartState)).toMatchObject({
      allowed: true,
      status: 'allowed',
    });
  });

  it('contains every requested feature key', () => {
    expect(listFeatureAccessMatrix().map((entry) => entry.key).sort()).toEqual([
      'blind_spot',
      'daily_sign_horoscope',
      'deep_report',
      'moon_calendar',
      'natal_anger',
      'natal_basic',
      'natal_career',
      'natal_deep',
      'natal_family',
      'natal_how_others_see_you',
      'natal_love',
      'natal_money',
      'natal_questions',
      'natal_shadow',
      'natal_talents',
      'own_chart',
      'personal_daily',
      'personal_daily_full',
      'personal_monthly',
      'personal_transits',
      'personal_weekly',
      'personality_deep',
      'retrograde_tracker',
      'saved_people',
      'synastry_by_charts',
      'weekly_sign_horoscope',
      'zodiac_compatibility',
    ].sort());
  });
});
