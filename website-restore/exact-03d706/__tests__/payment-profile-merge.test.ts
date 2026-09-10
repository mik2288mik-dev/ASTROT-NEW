import {
  mergePaymentProfilePatch,
  paymentProfilePatchFromEntitlement,
  paymentProfilePatchFromProfile,
} from '../lib/paymentProfile';
import type { PremiumEntitlementSnapshot, UserProfile } from '../types';

const baseProfile: UserProfile = {
  id: '42',
  name: 'Fresh name',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Kazan',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: false,
  gender: 'female',
};

function entitlement(overrides: Partial<PremiumEntitlementSnapshot> = {}): PremiumEntitlementSnapshot {
  return {
    state: 'paid',
    isPremium: true,
    source: 'rustore',
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-10-01T00:00:00.000Z',
    autoRenew: true,
    productId: 'premium.month',
    period: 'P1M',
    ...overrides,
  };
}

describe('payment profile reconciliation', () => {
  it('updates only entitlement fields and preserves edits made during checkout', () => {
    const merged = mergePaymentProfilePatch(
      baseProfile,
      '42',
      paymentProfilePatchFromEntitlement(entitlement()),
    );

    expect(merged).toMatchObject({
      name: 'Fresh name',
      birthPlace: 'Kazan',
      gender: 'female',
      isPremium: true,
      premiumUntil: '2026-10-01T00:00:00.000Z',
    });
  });

  it('does not mutate a different account after a delayed payment result', () => {
    expect(mergePaymentProfilePatch(
      { ...baseProfile, id: '84' },
      '42',
      paymentProfilePatchFromEntitlement(entitlement()),
    )).toEqual({ ...baseProfile, id: '84' });
  });

  it('applies an authoritative inactive entitlement and revokes stale Premium', () => {
    const expired = entitlement({
      state: 'expired',
      isPremium: false,
      endsAt: '2026-09-01T00:00:00.000Z',
      autoRenew: false,
    });
    const merged = mergePaymentProfilePatch(
      { ...baseProfile, isPremium: true, premiumEntitlement: entitlement() },
      '42',
      paymentProfilePatchFromEntitlement(expired),
    );

    expect(merged).toMatchObject({
      isPremium: false,
      premiumUntil: '2026-09-01T00:00:00.000Z',
      premiumEntitlement: expired,
    });
  });

  it('reduces a refreshed server profile to payment-owned fields', () => {
    expect(paymentProfilePatchFromProfile({
      ...baseProfile,
      isPremium: true,
      premiumUntil: '2026-10-01T00:00:00.000Z',
    })).toEqual({
      isPremium: true,
      premiumUntil: '2026-10-01T00:00:00.000Z',
      premiumEntitlement: null,
    });
  });
});
