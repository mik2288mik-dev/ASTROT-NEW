import {
  createPaywallContextFromRequest,
  createPaywallContext,
  isCurrentPaywallInstance,
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

  it('allows late checkout navigation only for the still-open paywall instance', () => {
    const replacement = createPaywallContext({
      ...context,
      paywallInstanceId: 'pw-test-2',
    });

    expect(isCurrentPaywallInstance(context, context)).toBe(true);
    expect(isCurrentPaywallInstance(null, context)).toBe(false);
    expect(isCurrentPaywallInstance(replacement, context)).toBe(false);

    const app = read('App.tsx');
    const purchaseFlow = app.slice(
      app.indexOf('const purchasePremiumPlan = async'),
      app.indexOf('const restorePremiumPurchases = async'),
    );
    const restoreFlow = app.slice(
      app.indexOf('const restorePremiumPurchases = async'),
      app.indexOf('const requestPremium = async'),
    );
    expect(purchaseFlow).toContain('isCurrentPaywallInstance(paywallContextRef.current, context)');
    expect(purchaseFlow).toContain('const activeContext = paywallContextRef.current');
    expect(restoreFlow).toContain('isCurrentPaywallInstance(paywallContextRef.current, context)');
  });

  it('renders Premium as the embedded store without a second Open store step', () => {
    const app = read('App.tsx');
    const services = read('views/v2/ServiceScreen.tsx');

    expect(services).toContain('{premiumStoreContent}');
    expect(services).not.toContain('Открыть магазин');
    expect(services).not.toContain('Open store');
    expect(app).toContain('premiumStoreContent={(');
    expect(app).toContain('<Paywall');
    expect(app).toContain('embedded');
    expect(app).toContain('onRequestPremium={openServiceStore}');
    expect(services).toContain("{ id: 'store', label: 'Premium' }");
  });

  it('opens the ordinary Premium tab without creating the fullscreen overlay', () => {
    const app = read('App.tsx');
    const openStore = app.slice(
      app.indexOf('const openServiceStore'),
      app.indexOf('const managePremiumSubscription'),
    );

    expect(openStore).toContain("setServiceTab('store')");
    expect(openStore).toContain("navigateTo('services')");
    expect(openStore).not.toContain('requestPremium(');
    expect(openStore).not.toContain('setPaywallContext(');
    expect(app).toContain('const showsBottomNavigation = !paywallContext');
    expect(app).toContain('{paywallContext ? (');
  });

  it('keeps contextual Premium requests in the existing fullscreen overlay', () => {
    const app = read('App.tsx');
    const requestPremium = app.slice(
      app.indexOf('const requestPremium = async'),
      app.indexOf('// Navigation logic:'),
    );

    expect(requestPremium).toContain('setPaywallContext(context)');
    expect(app).toContain('className="fixed inset-0 z-[150] h-[100dvh]');
    expect(app).toContain('style={{ zIndex: 150 }}');
    expect(app).toContain('aria-modal="true"');
    expect(app).toContain('onClose={() => returnFromPaywall(paywallContext, \'close\')}');
  });

  it('opens an explicitly tapped paid feature before first value and keeps its exact return context', () => {
    const app = read('App.tsx');
    const requestPremium = app.slice(
      app.indexOf('const requestPremium = async'),
      app.indexOf('// Navigation logic:'),
    );
    const returnFlow = app.slice(
      app.indexOf('const returnFromPaywall'),
      app.indexOf('const paymentPatchFromValidatedPayment'),
    );

    expect(requestPremium).toContain(
      "const isExplicitPaidFeatureRequest = context.triggerType === 'locked_feature';",
    );
    expect(requestPremium).toMatch(
      /!firstValueReachedRef\.current\s+&& !isExplicitPaidFeatureRequest\s+&& !options\?\.bypassFirstValueGate/,
    );
    expect(requestPremium.indexOf('setPaywallContext(context)')).toBeGreaterThan(
      requestPremium.indexOf('!isExplicitPaidFeatureRequest'),
    );
    expect(returnFlow).toContain(
      'setPremiumContinuation(destination.shouldOpenFeature ? context : null)',
    );
    expect(returnFlow).toContain('setView(destination.view)');
    expect(returnFlow).toContain('focus: !destination.shouldOpenFeature');
  });

  it('keeps all three plans visible and recoverable without invented prices', () => {
    const paywall = read('views/Paywall.tsx');
    const styles = read('styles/globals.css');

    expect(paywall).toContain("premium_month: { ru: '1 месяц'");
    expect(paywall).toContain("premium_quarter: { ru: '3 месяца'");
    expect(paywall).toContain("premium_year: { ru: '1 год'");
    expect(paywall).toContain('type="radio"');
    expect(paywall).toContain('aria-label={`${plan.periodLabel} — ${price}`}');
    expect(paywall).toContain('Личные прогнозы');
    expect(paywall).toContain('Натальный разбор');
    expect(paywall).toContain('PREMIUM_SAVED_PERSON_LIMIT');
    expect(paywall).not.toContain('pw2-plan-features');
    expect(paywall).not.toContain('planRailRef');
    expect(paywall).toContain('className="pw2-benefits"');
    expect(paywall).toContain('<footer className="pw2-checkout"');
    expect(paywall).toContain('className="pw2-selection-summary" aria-live="polite" aria-atomic="true"');
    expect(paywall).toContain('${selectedPlan.periodLabel} Premium');
    expect(paywall).toContain('aria-describedby={renewalId}');
    expect(styles).toContain('.pw2--overlay .pw2-content { flex: 1 1 0; overflow-y: auto;');
    expect(styles).toContain('.pw2--embedded .pw2-checkout { position: sticky;');
    expect(styles).toContain('.services-screen-page .services-screen-tabs .editorial-tab::after { display: none; }');
    expect(styles).toContain('.pw2 .pw2-plan { position: relative; display: grid;');
    expect(styles).not.toContain('.pw2-plan { height: 100%; min-height: 410px; }');
    expect(paywall).toContain('priceLabel: product.amountLabel');
    expect(paywall).toContain("catalogState === 'not_configured'");
    expect(paywall).toContain("catalogState === 'error'");
    expect(paywall).toContain('Не удалось загрузить цены.');
    expect(paywall).toContain('setCatalogRetryToken((value) => value + 1)');
    expect(paywall).toContain('Загрузить цены');
    expect(paywall).toContain('if (!paymentCatalogEnabled)');
    expect(paywall).not.toMatch(/priceLabel:\s*['"]\d[\d\s]*\s*₽/);
    expect(paywall).not.toMatch(/эконом|скидк|выгодн|популярн/i);
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
      entryPoint: 'charts',
      returnAction: 'open_saved_person',
      returnEntityId: '73',
    });
    expect(resolvePaywallOutcome(savedPerson, 'purchase_succeeded')).toMatchObject({
      view: 'charts',
      shouldOpenFeature: true,
    });
  });

  it('keeps the entry point separate from the paid placement through checkout', () => {
    const app = read('App.tsx');
    const deepNatal = createPaywallContextFromRequest({
      source: 'feature_gate',
      currentView: 'chart',
      payload: {
        placement: 'deep_natal',
        featureKey: 'natal_deep',
        triggerType: 'locked_feature',
      },
    });

    expect(deepNatal).toMatchObject({
      entryPoint: 'feature_gate',
      placement: 'deep_natal',
    });
    expect(app).toContain('entryPoint: context.entryPoint');
    expect(app).toContain('source: paywallEventSource(context)');
    expect(app).not.toContain('source: paywallContext.placement');
    expect(app).not.toContain('source: serviceStoreContext.placement');
    expect(app).toContain('target?.focus({ preventScroll: true })');
    expect(read('components/NatalReading/HumanReport.tsx')).toContain(
      'returnScrollAnchor: `natal-topic-premium-${topicKey}`',
    );
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
