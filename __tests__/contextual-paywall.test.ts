import {
  createPaywallContextFromRequest,
  createPaywallContext,
  resolvePaywallOutcome,
  type PaywallContext,
} from '../lib/paywallContext';
import {
  resolveTodayPremiumTeaserInsertion,
} from '../lib/todayPremiumTeaser';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('contextual paywall return contract', () => {
  const context: PaywallContext = createPaywallContext({
    placement: 'today',
    featureKey: 'personal_daily_full',
    triggerType: 'inline_promo',
    returnView: 'dashboard',
    returnScrollAnchor: 'forecast-section-action',
    paywallInstanceId: 'pw-test-1',
  });

  it.each(['close', 'checkout_cancelled', 'checkout_failed'] as const)(
    '%s returns to the exact originating fragment',
    (outcome) => {
      expect(resolvePaywallOutcome(context, outcome)).toEqual({
        view: 'dashboard',
        scrollAnchor: 'forecast-section-action',
        featureKey: 'personal_daily_full',
        shouldOpenFeature: false,
      });
    },
  );

  it('purchase success returns to and opens the requested feature', () => {
    expect(resolvePaywallOutcome(context, 'purchase_succeeded')).toEqual({
      view: 'dashboard',
      scrollAnchor: 'forecast-section-action',
      featureKey: 'personal_daily_full',
      shouldOpenFeature: true,
    });
  });

  it('disarms a locked Week/Month request until purchase success', () => {
    const app = read('App.tsx');
    const returnFlow = app.slice(
      app.indexOf('const returnFromPaywall'),
      app.indexOf('const profileFromValidatedPayment'),
    );
    expect(returnFlow).toContain("outcome === 'purchase_succeeded' && context.placement === 'week'");
    expect(returnFlow).toContain("outcome === 'purchase_succeeded' && context.placement === 'month'");
    expect(returnFlow).not.toContain("if (context.placement === 'week') setDashboardPeriod('week')");
    expect(returnFlow).not.toContain("if (context.placement === 'month') setDashboardPeriod('month')");
    expect(app).toContain("(context.placement === 'week' || context.placement === 'month')");
  });

  it('records one locked_feature_tapped event for one locked period interaction', () => {
    const dashboard = read('views/Dashboard.tsx');
    const lockedPeriodBranch = dashboard.slice(
      dashboard.indexOf("=== 'PERSONAL_FORECAST_PREMIUM_REQUIRED'"),
      dashboard.indexOf('const errorCode', dashboard.indexOf("=== 'PERSONAL_FORECAST_PREMIUM_REQUIRED'")),
    );
    const app = read('App.tsx');
    const requestPremium = app.slice(
      app.indexOf('const requestPremium = async'),
      app.indexOf('const closePaywall'),
    );
    expect(lockedPeriodBranch).not.toContain("onPremiumAnalytics?.('locked_feature_tapped'");
    expect(requestPremium.match(/eventType: 'locked_feature_tapped'/g)).toHaveLength(1);
  });

  it('returns a locked saved person to the exact chart instead of the add form', () => {
    const savedPerson = createPaywallContextFromRequest({
      source: 'charts',
      currentView: 'charts',
      payload: {
        placement: 'saved_people',
        featureKey: 'saved_people',
        returnView: 'charts',
        returnAction: 'open_saved_person',
        returnEntityId: 73,
      },
    });
    expect(savedPerson).toMatchObject({
      returnAction: 'open_saved_person',
      returnEntityId: '73',
    });
    expect(resolvePaywallOutcome(savedPerson, 'purchase_succeeded')).toMatchObject({
      view: 'charts',
      shouldOpenFeature: true,
    });
  });

  it('places the offer only after overview and one readable fragment', () => {
    expect(resolveTodayPremiumTeaserInsertion({
      premium: false,
      sectionIds: ['overview', 'first-open', 'locked-a', 'locked-b'],
      lockedSectionIds: new Set(['locked-a', 'locked-b']),
    })).toEqual({ afterSectionId: 'first-open', lockedCount: 2 });
    expect(resolveTodayPremiumTeaserInsertion({
      premium: true,
      sectionIds: ['overview', 'first-open', 'locked-a'],
      lockedSectionIds: new Set(['locked-a']),
    })).toBeNull();
    expect(resolveTodayPremiumTeaserInsertion({
      premium: false,
      sectionIds: ['overview', 'locked-a'],
      lockedSectionIds: new Set(['locked-a']),
    })).toBeNull();
  });
});
