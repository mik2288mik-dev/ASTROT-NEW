import { canAccessFeature, hasActivePremium, hasFullPremium, isStoreTrial } from '../lib/accessMatrix';

const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const chart = { primaryChartId: 7 } as never;
const trial = { entitlementState: 'store_trial', entitlementEndsAt: future } as never;
const paid = { entitlementState: 'paid', entitlementEndsAt: future } as never;

describe('store trial is a limited Premium', () => {
  it('keeps habits open and closes the read-once readings', () => {
    expect(isStoreTrial(trial)).toBe(true);
    expect(hasActivePremium(trial)).toBe(true);
    expect(hasFullPremium(trial)).toBe(false);
    expect(hasFullPremium(paid)).toBe(true);
    expect(canAccessFeature('personal_weekly', trial, chart).allowed).toBe(true);
    expect(canAccessFeature('natal_deep', trial, chart).status).toBe('needs_premium');
    expect(canAccessFeature('synastry_by_charts', trial, chart).status).toBe('needs_premium');
    expect(canAccessFeature('natal_deep', paid, chart).allowed).toBe(true);
  });
});
