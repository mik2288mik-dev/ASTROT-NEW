import {
  PREMIUM_ANALYTICS_EVENTS,
  sanitizeUserAppEvent,
} from '../lib/premiumAnalytics';

describe('Premium analytics contract', () => {
  it('contains the complete P0 funnel event set', () => {
    expect(PREMIUM_ANALYTICS_EVENTS).toEqual([
      'first_value_viewed',
      'locked_feature_tapped',
      'premium_promo_impression',
      'premium_promo_clicked',
      'premium_promo_dismissed',
      'paywall_impression',
      'plan_selected',
      'checkout_started',
      'purchase_succeeded',
      'purchase_cancelled',
      'purchase_failed',
      'restore_started',
      'restore_succeeded',
      'restore_failed',
      'subscription_cancelled',
      'subscription_expired',
    ]);
  });

  it('canonicalizes safe context and removes PII, forecast text, tokens, and receipts', () => {
    const event = sanitizeUserAppEvent({
      eventType: 'checkout_started',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        featureKey: 'personal_daily',
        triggerType: 'inline_promo',
        returnView: 'dashboard',
        returnScrollAnchor: 'today-fragment-2',
        paywallInstanceId: 'pw-018f-1234',
        planId: 'premium_quarter',
        productId: 'owner-configured-product-id',
        period: 'P3M',
        priceMicros: 399_000_000,
        currency: 'RUB',
        email: 'person@example.com',
        birthDate: '1990-01-01',
        birthPlace: 'Moscow',
        forecastText: 'Private forecast body',
        question: 'Private natal question',
        purchaseToken: 'secret-purchase-token',
        receipt: 'secret-receipt',
        nested: { purchase_token: 'still-secret' },
      },
    });

    expect(event).toEqual({
      eventType: 'checkout_started',
      section: 'premium',
      source: 'today_inline',
      eventPayload: {
        placement: 'today',
        feature_key: 'personal_daily',
        trigger_type: 'inline_promo',
        return_view: 'dashboard',
        return_scroll_anchor: 'today-fragment-2',
        paywall_instance_id: 'pw-018f-1234',
        plan_id: 'premium_quarter',
        period: 'P3M',
        price_micros: 399_000_000,
        currency: 'RUB',
      },
    });
    expect(JSON.stringify(event)).not.toMatch(
      /person@example|1990-01-01|Moscow|Private forecast|Private natal|secret/i,
    );
  });

  it('rejects unknown event names instead of accepting arbitrary telemetry', () => {
    expect(sanitizeUserAppEvent({ eventType: 'made_up_event', eventPayload: {} })).toBeNull();
  });

  it('rejects sensitive values smuggled through allowlisted analytics keys', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'purchase_failed',
      source: '1990-01-01',
      eventPayload: {
        placement: 'person@example.com',
        featureKey: '1990-01-01',
        reasonCode: 'purchase.token.very-secret-receipt-value',
        period: 'receipt-2026-08-13',
        productId: 'purchase-token-123456789',
      },
    })).toEqual({
      eventType: 'purchase_failed',
      section: null,
      source: null,
      eventPayload: {},
    });
  });

  it('keeps explicitly allowlisted legacy events while stripping arbitrary fields', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'screen_view',
      section: 'settings',
      eventPayload: { email: 'person@example.com' },
    })).toEqual({
      eventType: 'screen_view',
      section: 'settings',
      source: null,
      eventPayload: {},
    });
  });
});
