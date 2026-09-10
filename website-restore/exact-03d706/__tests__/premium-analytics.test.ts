import {
  PREMIUM_ANALYTICS_EVENTS,
  PRODUCT_ANALYTICS_EVENTS,
  USER_APP_EVENT_ALIASES,
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

  it('publishes the canonical product funnel taxonomy', () => {
    expect(PRODUCT_ANALYTICS_EVENTS).toEqual([
      'first_result_ready',
      'natal_section_open',
      'compatibility_ready',
      'person_added',
      'future_open',
      'question_sent',
      'paywall_view',
      'checkout_start',
      'purchase_success',
      'purchase_failed',
      'restore_success',
      'share',
      'invite_open',
    ]);
    expect(USER_APP_EVENT_ALIASES).toMatchObject({
      paywall_impression: 'paywall_view',
      checkout_started: 'checkout_start',
      purchase_succeeded: 'purchase_success',
      restore_succeeded: 'restore_success',
    });
  });

  it('keeps Today first value separate from first result readiness', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'first_value_viewed',
      section: 'personal_forecast',
      source: 'personal_forecast_feed',
      eventPayload: { placement: 'today', featureKey: 'personal_daily' },
    })).toMatchObject({ eventType: 'first_value_viewed' });
    expect(sanitizeUserAppEvent({
      eventType: 'first_result_ready',
      section: 'natal',
      source: 'natal_report',
      eventPayload: { resultType: 'natal_report' },
    })).toMatchObject({ eventType: 'first_result_ready' });
  });

  it('canonicalizes safe context and removes PII, forecast text, tokens, and receipts', () => {
    const event = sanitizeUserAppEvent({
      eventType: 'checkout_started',
      section: 'premium',
      source: 'feature_gate',
      eventPayload: {
        entryPoint: 'feature_gate',
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
      eventType: 'checkout_start',
      section: 'premium',
      source: 'feature_gate',
      eventPayload: {
        entry_point: 'feature_gate',
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

  it('keeps only bounded semantic metadata for natal result events', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'first_result_ready',
      section: 'chart',
      source: 'deep_natal',
      eventPayload: {
        resultType: 'natal_report',
        openSectionCount: 2,
        totalSectionCount: 17,
        source: 'natal_report',
        reportText: 'private generated report',
        birthDate: '1990-01-01',
        userId: '42',
        chartId: 'raw-chart-id',
        receipt: 'secret-receipt',
      },
    })).toEqual({
      eventType: 'first_result_ready',
      section: 'chart',
      source: 'deep_natal',
      eventPayload: {
        result_type: 'natal_report',
        open_section_count: 2,
        total_section_count: 17,
        source: 'natal_report',
      },
    });
  });

  it('keeps the paywall instance only for an exact post-purchase natal return', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'natal_section_open',
      section: 'natal',
      source: 'deep_natal',
      eventPayload: {
        sectionKey: 'relationships',
        accessState: 'premium',
        source: 'paywall_return',
        paywallInstanceId: 'pw-return-20260901',
        reportText: 'private report body',
      },
    })).toEqual({
      eventType: 'natal_section_open',
      section: 'natal',
      source: 'deep_natal',
      eventPayload: {
        section_key: 'relationships',
        access_state: 'premium',
        source: 'paywall_return',
        paywall_instance_id: 'pw-return-20260901',
      },
    });
  });

  it('keeps an exact catalog answer through checkout without keeping generated copy', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'checkout_start',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: {
        entryPoint: 'deep_natal',
        placement: 'deep_natal',
        featureKey: 'natal_deep',
        triggerType: 'locked_feature',
        returnView: 'chart',
        returnAction: 'open_natal_answer',
        returnEntityId: 'love_lose_interest',
        paywallInstanceId: 'pw-catalog-answer-20260901',
        previewText: 'private personalized preview',
      },
    })).toEqual({
      eventType: 'checkout_start',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: {
        entry_point: 'deep_natal',
        placement: 'deep_natal',
        feature_key: 'natal_deep',
        trigger_type: 'locked_feature',
        return_view: 'chart',
        return_action: 'open_natal_answer',
        return_entity_id: 'love_lose_interest',
        paywall_instance_id: 'pw-catalog-answer-20260901',
      },
    });
  });

  it('normalizes commerce aliases and never accepts raw ids or question text', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'purchase_succeeded',
      section: 'premium',
      source: 'deep_natal',
      eventPayload: { entitlementState: 'paid' },
    })?.eventType).toBe('purchase_success');

    expect(sanitizeUserAppEvent({
      eventType: 'question_sent',
      section: 'questions',
      source: 'natal_questions',
      eventPayload: {
        sectionKey: 'natal_questions',
        scope: 'self',
        source: 'natal_report',
        question: 'Private question body',
        userId: 42,
        personId: 'person-123',
        inviteToken: 'secret-invite-token',
      },
    })).toEqual({
      eventType: 'question_sent',
      section: 'questions',
      source: 'natal_questions',
      eventPayload: {
        section_key: 'natal_questions',
        scope: 'self',
        source: 'natal_report',
      },
    });
  });

  it('rejects unknown event names instead of accepting arbitrary telemetry', () => {
    expect(sanitizeUserAppEvent({ eventType: 'made_up_event', eventPayload: {} })).toBeNull();
  });

  it('rejects semantic event ids that could bypass the payload privacy allowlist', () => {
    expect(sanitizeUserAppEvent({
      eventId: 'evt-person-example-com-purchase',
      eventType: 'checkout_start',
      eventPayload: {},
    })).toBeNull();
  });

  it('rejects sensitive values smuggled through allowlisted analytics keys', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'purchase_failed',
      source: '1990-01-01',
      eventPayload: {
        entryPoint: 'person@example.com',
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

  it('keeps bounded RuStore timeout reasons so payment failures remain diagnosable', () => {
    expect(sanitizeUserAppEvent({
      eventType: 'restore_failed',
      section: 'premium',
      source: 'settings',
      eventPayload: { reasonCode: 'RUSTORE_RESTORE_TIMEOUT' },
    })).toEqual({
      eventType: 'restore_failed',
      section: 'premium',
      source: 'settings',
      eventPayload: { reason_code: 'RUSTORE_RESTORE_TIMEOUT' },
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
