import { describePremiumEntitlement } from '../lib/subscriptionPresentation';
import type { PremiumEntitlementSnapshot } from '../types';

const entitlement = (
  state: PremiumEntitlementSnapshot['state'],
  overrides: Partial<PremiumEntitlementSnapshot> = {},
): PremiumEntitlementSnapshot => ({
  state,
  isPremium: !['free', 'expired'].includes(state),
  source: state === 'gift' ? 'legacy_gift' : 'rustore',
  startsAt: null,
  endsAt: '2026-09-01T00:00:00.000Z',
  autoRenew: state === 'paid',
  productId: state === 'gift' ? null : 'premium_month',
  period: state === 'gift' ? null : 'P1M',
  ...overrides,
});

describe('Settings subscription state copy', () => {
  const activePeriodNow = Date.parse('2026-08-01T00:00:00.000Z');

  it('keeps gift, store trial, and paid distinct', () => {
    expect(describePremiumEntitlement(entitlement('gift'), 'ru', activePeriodNow).title).toContain('Подарочный Premium');
    expect(describePremiumEntitlement(entitlement('store_trial'), 'ru', activePeriodNow).title).toContain('Пробный период RuStore');
    expect(describePremiumEntitlement(entitlement('paid'), 'ru', activePeriodNow).title).toBe('Premium активен');
  });

  it('says cancellation preserves access through the paid end', () => {
    expect(describePremiumEntitlement(entitlement('cancelled_active'), 'ru', activePeriodNow).body)
      .toBe('Автопродление выключено. Premium работает до 1 сентября 2026 г.');
  });

  it('says expiry locks features without deleting data', () => {
    expect(describePremiumEntitlement(entitlement('expired'), 'ru').body)
      .toContain('Данные сохранены');
  });

  it('normalizes a paid-through state to expired after its end time', () => {
    expect(describePremiumEntitlement(entitlement('cancelled_active', {
      endsAt: '2020-01-01T00:00:00.000Z',
    }), 'ru', Date.parse('2020-01-02T00:00:00.000Z'))).toMatchObject({
      title: 'Premium закончился',
      shouldPromote: true,
    });
  });
});
