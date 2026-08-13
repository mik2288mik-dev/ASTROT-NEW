import {
  CANONICAL_ACCESS_CONTRACT,
  ENTITLEMENT_STATES,
  canAccessFeature,
  hasActivePremium,
  resolveEntitlementState,
} from '../lib/accessMatrix';
import {
  canAccessContent,
  getContentAccessConfig,
  type UserState,
} from '../lib/contentAccessMatrix';
import {
  buildFreePrewarmPlan,
  buildPremiumPrewarmPlan,
  getStartupRequiredTaskIds,
} from '../lib/contentPrewarm';

const NOW = Date.parse('2026-08-13T10:00:00.000Z');
const FUTURE = '2026-09-13T10:00:00.000Z';
const PAST = '2026-07-13T10:00:00.000Z';
const chartState = { primaryChartId: 7 };

describe('canonical Free/Premium entitlement contract', () => {
  it('publishes every supported entitlement state explicitly', () => {
    expect(ENTITLEMENT_STATES).toEqual([
      'free',
      'gift',
      'store_trial',
      'paid',
      'grace',
      'cancelled_active',
      'expired',
    ]);
  });

  it('does not grant access from a perpetual client isPremium flag', () => {
    expect(hasActivePremium({ isPremium: true }, NOW)).toBe(false);
    expect(resolveEntitlementState({ isPremium: true }, NOW)).toBe('free');
  });

  it('reads the dated premiumEntitlement snapshot without trusting its boolean alone', () => {
    expect(hasActivePremium({
      premiumEntitlement: {
        state: 'paid',
        isPremium: true,
        source: 'rustore',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: FUTURE,
        autoRenew: true,
        productId: 'premium.3m',
        period: 'P3M',
      },
    }, NOW)).toBe(true);
    expect(hasActivePremium({
      premiumEntitlement: {
        state: 'paid',
        isPremium: true,
        source: 'rustore',
        startsAt: '2026-07-01T00:00:00.000Z',
        endsAt: PAST,
        autoRenew: false,
        productId: 'premium.3m',
        period: 'P3M',
      },
    }, NOW)).toBe(false);
    expect(hasActivePremium({
      premiumEntitlement: {
        state: 'free',
        isPremium: true,
        source: null,
        startsAt: null,
        endsAt: null,
        autoRenew: null,
        productId: null,
        period: null,
      },
    }, NOW)).toBe(false);
  });

  it('keeps the explicit admin override separate from subscription expiry', () => {
    const profile = {
      isAdmin: true,
      premiumEntitlement: {
        state: 'gift' as const,
        isPremium: true,
        source: 'admin',
        startsAt: null,
        endsAt: null,
        autoRenew: null,
        productId: null,
        period: null,
      },
    };
    expect(resolveEntitlementState(profile, NOW)).toBe('gift');
    expect(hasActivePremium(profile, NOW)).toBe(true);
  });

  it('classifies a legacy future premiumUntil as gift, never store trial', () => {
    expect(resolveEntitlementState({
      isPremium: false,
      premiumUntil: FUTURE,
      trialStartedAt: '2026-08-01T00:00:00.000Z',
    }, NOW)).toBe('gift');
  });

  it.each([
    ['gift', true],
    ['store_trial', true],
    ['paid', true],
    ['grace', true],
    ['cancelled_active', true],
    ['free', false],
    ['expired', false],
  ] as const)('keeps %s distinct and resolves its access state', (state, active) => {
    const profile = { entitlementState: state, entitlementEndsAt: FUTURE };
    expect(resolveEntitlementState(profile, NOW)).toBe(state);
    expect(hasActivePremium(profile, NOW)).toBe(active);
  });

  it('expires cancelled-active access only at the paid period end', () => {
    expect(hasActivePremium({
      entitlementState: 'cancelled_active',
      entitlementEndsAt: FUTURE,
    }, NOW)).toBe(true);
    expect(resolveEntitlementState({
      entitlementState: 'cancelled_active',
      entitlementEndsAt: PAST,
    }, NOW)).toBe('expired');
  });

  it('defines the promised product limits and product-level features in one contract', () => {
    expect(CANONICAL_ACCESS_CONTRACT.free).toMatchObject({
      ownChartLimit: 1,
      additionalSavedPeopleLimit: 0,
      todayOpenFragmentCount: { min: 1, max: 2 },
    });
    expect(CANONICAL_ACCESS_CONTRACT.premium).toMatchObject({
      ownChartLimit: 1,
      additionalSavedPeopleLimit: 5,
    });
    expect(CANONICAL_ACCESS_CONTRACT.free.featureKeys).toEqual(expect.arrayContaining([
      'natal_basic',
      'personal_daily',
      'daily_sign_horoscope',
      'zodiac_compatibility',
      'own_chart',
    ]));
    expect(CANONICAL_ACCESS_CONTRACT.premium.featureKeys).toEqual(expect.arrayContaining([
      'personal_daily_full',
      'personal_weekly',
      'personal_monthly',
      'natal_deep',
      'personality_deep',
      'natal_questions',
      'synastry_by_charts',
      'saved_people',
    ]));
  });

  it('keeps Today free and gates Week and Month before premium', () => {
    expect(canAccessFeature('personal_daily', null, chartState).allowed).toBe(true);
    expect(canAccessFeature('personal_weekly', null, chartState).status).toBe('needs_premium');
    expect(canAccessFeature('personal_monthly', null, chartState).status).toBe('needs_premium');
  });
});

describe('legacy surface adapter derives access from the canonical contract', () => {
  const freeUser: UserState = {
    userId: 'free-user',
    chartId: 7,
    entitlementState: 'free',
    unlockedContent: [],
  };
  const paidUser: UserState = {
    ...freeUser,
    userId: 'paid-user',
    entitlementState: 'paid',
    entitlementEndsAt: FUTURE,
  };

  it.each(['weekly', 'monthly'] as const)('maps forecast/%s to Premium', (variant) => {
    expect(getContentAccessConfig('forecast', variant)).toMatchObject({
      defaultAccessTier: 'premium',
      unlockOptions: ['premium'],
      lockedBehavior: { requirePremium: true },
    });
    expect(canAccessContent(freeUser, 'forecast', variant, undefined, NOW)).toBe(false);
    expect(canAccessContent(paidUser, 'forecast', variant, undefined, NOW)).toBe(true);
  });

  it('does not let a legacy unlock row become a second entitlement truth', () => {
    const legacyUnlockUser: UserState = {
      ...freeUser,
      unlockedContent: [{
        surface: 'synastry',
        variant: 'full',
        accessTier: 'premium',
        cacheKey: 'pair-hash',
      }],
    };
    expect(canAccessContent(legacyUnlockUser, 'synastry', 'full', 'pair-hash', NOW)).toBe(false);
  });
});

describe('personal forecast prewarm respects entitlement', () => {
  const periodKeys = {
    day: '2026-08-13',
    week: '2026-W33',
    month: '2026-08',
  };

  it('prewarms only Today for Free', () => {
    expect(buildFreePrewarmPlan(periodKeys).map((item) => item.id)).toEqual([
      'personal_forecast_day',
    ]);
    expect(getStartupRequiredTaskIds(false)).toEqual(['personal_forecast_day']);
  });

  it('prewarms Today, Week, and Month for Premium', () => {
    expect(buildPremiumPrewarmPlan(periodKeys).map((item) => item.id)).toEqual([
      'personal_forecast_day',
      'personal_forecast_week',
      'personal_forecast_month',
    ]);
    expect(getStartupRequiredTaskIds(true)).toEqual([
      'personal_forecast_day',
      'personal_forecast_week',
      'personal_forecast_month',
    ]);
  });
});
