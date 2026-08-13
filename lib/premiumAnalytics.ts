export const PREMIUM_ANALYTICS_EVENTS = [
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
] as const;

export type PremiumAnalyticsEventName = typeof PREMIUM_ANALYTICS_EVENTS[number];

// Kept explicit while older product surfaces migrate to the P0 taxonomy.
const LEGACY_USER_APP_EVENTS = [
  'screen_view',
  'paywall_view',
  'natal_upgrade_success',
  'natal_story_open',
  'natal_card_impression',
  'natal_story_completed',
  'natal_card_swipe_next',
  'natal_readmore_tap',
  'natal_sheet_open',
  'natal_today_cta_tap',
  'natal_checkin_cta_tap',
  'natal_save_tap',
  'natal_share_tap',
  'natal_notifications_optin',
  'natal_paywall_open',
  'natal_sheet_scroll_depth',
  'natal_paywall_dismiss',
] as const;

type LegacyUserAppEventName = typeof LEGACY_USER_APP_EVENTS[number];
export type UserAppEventName = PremiumAnalyticsEventName | LegacyUserAppEventName;
export type SanitizedAnalyticsValue = string | number | boolean;

export type SanitizedUserAppEvent = {
  eventType: UserAppEventName;
  section: string | null;
  source: string | null;
  eventPayload: Record<string, SanitizedAnalyticsValue>;
};

export const MAX_USER_APP_EVENT_BODY_LENGTH = 16_384;

const EVENT_NAMES = new Set<string>([
  ...PREMIUM_ANALYTICS_EVENTS,
  ...LEGACY_USER_APP_EVENTS,
]);

const PAYWALL_CONTEXT_KEYS = [
  'placement',
  'feature_key',
  'trigger_type',
  'return_view',
  'return_scroll_anchor',
  'paywall_instance_id',
  'entry_point',
] as const;
const PLAN_KEYS = [
  'plan_id',
  'default_plan_id',
  'product_count',
  'period',
  'price_micros',
  'currency',
  'auto_renew',
] as const;
const ENTITLEMENT_KEYS = [
  'entitlement_state',
  'previous_entitlement_state',
  'entitlement_ends_at',
  'reason_code',
] as const;
const LEGACY_STORY_KEYS = [
  'card_id',
  'section_key',
  'is_first_time',
  'index',
  'viewed_count',
  'from_card',
  'to_card',
  'reason',
  'is_premium_teaser',
  'time_of_day',
  'format',
  'enabled',
  'suppressed',
  'depth_pct',
  'trial_supported',
  'source',
] as const;

const ALLOWED_PAYLOAD_KEYS_BY_EVENT: Record<UserAppEventName, readonly string[]> = {
  first_value_viewed: [
    'placement',
    'feature_key',
    'return_view',
    'open_fragment_count',
    'visible_fragment_count',
  ],
  locked_feature_tapped: PAYWALL_CONTEXT_KEYS,
  premium_promo_impression: PAYWALL_CONTEXT_KEYS,
  premium_promo_clicked: PAYWALL_CONTEXT_KEYS,
  premium_promo_dismissed: PAYWALL_CONTEXT_KEYS,
  paywall_impression: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS],
  plan_selected: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS],
  checkout_started: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS],
  purchase_succeeded: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS, ...ENTITLEMENT_KEYS],
  purchase_cancelled: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS, 'reason_code'],
  purchase_failed: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS, 'reason_code'],
  restore_started: PAYWALL_CONTEXT_KEYS,
  restore_succeeded: [...PAYWALL_CONTEXT_KEYS, ...ENTITLEMENT_KEYS],
  restore_failed: [...PAYWALL_CONTEXT_KEYS, 'reason_code'],
  subscription_cancelled: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS, ...ENTITLEMENT_KEYS],
  subscription_expired: [...PAYWALL_CONTEXT_KEYS, ...PLAN_KEYS, ...ENTITLEMENT_KEYS],
  screen_view: [],
  paywall_view: [...PAYWALL_CONTEXT_KEYS, ...LEGACY_STORY_KEYS],
  natal_upgrade_success: [...PAYWALL_CONTEXT_KEYS, ...LEGACY_STORY_KEYS],
  natal_story_open: LEGACY_STORY_KEYS,
  natal_card_impression: LEGACY_STORY_KEYS,
  natal_story_completed: LEGACY_STORY_KEYS,
  natal_card_swipe_next: LEGACY_STORY_KEYS,
  natal_readmore_tap: LEGACY_STORY_KEYS,
  natal_sheet_open: LEGACY_STORY_KEYS,
  natal_today_cta_tap: LEGACY_STORY_KEYS,
  natal_checkin_cta_tap: LEGACY_STORY_KEYS,
  natal_save_tap: LEGACY_STORY_KEYS,
  natal_share_tap: LEGACY_STORY_KEYS,
  natal_notifications_optin: [...LEGACY_STORY_KEYS, 'placement'],
  natal_paywall_open: [...PAYWALL_CONTEXT_KEYS, ...LEGACY_STORY_KEYS],
  natal_sheet_scroll_depth: LEGACY_STORY_KEYS,
  natal_paywall_dismiss: [...PAYWALL_CONTEXT_KEYS, ...LEGACY_STORY_KEYS],
};

const PAYLOAD_KEY_ALIASES: Record<string, string> = {
  featureKey: 'feature_key',
  triggerType: 'trigger_type',
  returnView: 'return_view',
  returnScrollAnchor: 'return_scroll_anchor',
  paywallInstanceId: 'paywall_instance_id',
  entryPoint: 'entry_point',
  planId: 'plan_id',
  defaultPlanId: 'default_plan_id',
  productCount: 'product_count',
  priceMicros: 'price_micros',
  autoRenew: 'auto_renew',
  autoRenewEnabled: 'auto_renew',
  entitlementState: 'entitlement_state',
  previousEntitlementState: 'previous_entitlement_state',
  entitlementEndsAt: 'entitlement_ends_at',
  reasonCode: 'reason_code',
  openFragmentCount: 'open_fragment_count',
  visibleFragmentCount: 'visible_fragment_count',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeCode(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(normalized) ? normalized : null;
}

const ENUM_VALUES_BY_KEY: Record<string, ReadonlySet<string>> = {
  placement: new Set(['today', 'week', 'month', 'deep_natal', 'personality_deep', 'natal_questions', 'compatibility_by_charts', 'saved_people', 'settings']),
  feature_key: new Set(['personal_daily', 'personal_daily_full', 'personal_weekly', 'personal_monthly', 'natal_deep', 'personality_deep', 'natal_questions', 'synastry_by_charts', 'saved_people']),
  trigger_type: new Set(['inline_promo', 'locked_feature', 'settings']),
  return_view: new Set(['dashboard', 'chart', 'synastry', 'charts', 'settings']),
  plan_id: new Set(['premium_month', 'premium_quarter', 'premium_year']),
  default_plan_id: new Set(['premium_quarter']),
  entitlement_state: new Set(['free', 'gift', 'store_trial', 'paid', 'grace', 'cancelled_active', 'expired']),
  previous_entitlement_state: new Set(['free', 'gift', 'store_trial', 'paid', 'grace', 'cancelled_active', 'expired']),
  currency: new Set(['RUB']),
};

const SAFE_TOP_LEVEL_SOURCES = new Set([
  'today_inline',
  'personal_forecast_feed',
  'feature_gate',
  'settings',
  'charts',
  'deep_natal',
  'natal_questions',
  'natal_story_unlock',
  'entitlement_refresh',
  'rustore_callback',
  'today',
  'week',
  'month',
  'deep_natal',
  'personality_deep',
  'compatibility_by_charts',
  'saved_people',
]);

const SAFE_SECTIONS = new Set([
  'premium',
  'personal_forecast',
  'natal_story',
  'onboarding',
  'paywall',
  'dashboard',
  'chart',
  'horoscope',
  'synastry',
  'matrix',
  'settings',
  'admin',
  'charts',
]);

const SAFE_REASON_CODES = new Set([
  'CHECKOUT_CANCELLED',
  'BACKEND_ENTITLEMENT_MISSING',
  'NO_VALID_PURCHASE',
  'RECOVERY_IDENTITY_REQUIRED',
  'PAYMENTS_NOT_AVAILABLE_ON_THIS_CHANNEL',
  'TELEGRAM_STARS_DISABLED',
  'TELEGRAM_STARS_NOT_COMPLETED',
  'RUSTORE_PAY_DISABLED',
  'RUSTORE_PAY_NOT_AVAILABLE',
  'RUSTORE_ACCOUNT_ID_REQUIRED',
  'RUSTORE_NOT_AVAILABLE',
  'RUSTORE_PRODUCT_NOT_CONFIGURED',
  'RUSTORE_PRODUCT_NOT_PUBLISHED',
  'RUSTORE_PRODUCT_NOT_SUBSCRIPTION',
  'RUSTORE_TRIAL_NOT_SUPPORTED',
  'RUSTORE_SUBSCRIPTION_INFO_MISSING',
  'RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID',
  'RUSTORE_PURCHASE_STATUS_UNKNOWN',
  'RUSTORE_PURCHASE_CANCELLED',
  'RUSTORE_PURCHASE_EXPIRED',
  'RUSTORE_PURCHASE_REJECTED',
  'RUSTORE_PURCHASE_TERMINATED',
  'RUSTORE_PURCHASE_CLOSED',
  'RUSTORE_PURCHASE_NOT_ACTIVE',
  'RUSTORE_SERVER_VALIDATION_FAILED',
  'RUSTORE_ENTITLEMENT_SNAPSHOT_INVALID',
  'RUSTORE_PREMIUM_NOT_CONFIRMED',
  'RUSTORE_PURCHASE_FAILED',
  'RUSTORE_RESTORE_FAILED',
]);

function safeAnalyticsString(key: string, value: unknown): string | null {
  const normalized = sanitizeCode(value);
  if (!normalized) return null;
  const enumValues = ENUM_VALUES_BY_KEY[key];
  if (enumValues) return enumValues.has(normalized) ? normalized : null;
  if (key === 'period') return /^P(?:1M|3M|1Y|12M)$/.test(normalized) ? normalized : null;
  if (key === 'entitlement_ends_at') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(normalized) ? normalized : null;
  if (key === 'paywall_instance_id') return /^(?:pw-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f-]{27,})$/i.test(normalized) ? normalized : null;
  if (key === 'return_scroll_anchor') return /^[a-z][a-z0-9-]{0,79}$/i.test(normalized) ? normalized : null;
  if (key === 'reason_code') return SAFE_REASON_CODES.has(normalized) ? normalized : null;
  return normalized;
}

function sanitizeValue(key: string, value: unknown): SanitizedAnalyticsValue | null {
  if (typeof value === 'string') return safeAnalyticsString(key, value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    return value;
  }
  return null;
}

function normalizeEventName(value: unknown): UserAppEventName | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return EVENT_NAMES.has(normalized) ? normalized as UserAppEventName : null;
}

export function isUserAppEventBodyTooLarge(input: unknown): boolean {
  try {
    return JSON.stringify(input).length > MAX_USER_APP_EVENT_BODY_LENGTH;
  } catch {
    return true;
  }
}

export function sanitizeUserAppEvent(input: unknown): SanitizedUserAppEvent | null {
  if (!isPlainObject(input) || isUserAppEventBodyTooLarge(input)) return null;
  const eventType = normalizeEventName(input.eventType);
  if (!eventType) return null;

  const allowedKeys = new Set(ALLOWED_PAYLOAD_KEYS_BY_EVENT[eventType]);
  const eventPayload: Record<string, SanitizedAnalyticsValue> = {};
  if (isPlainObject(input.eventPayload)) {
    for (const [inputKey, inputValue] of Object.entries(input.eventPayload)) {
      const key = PAYLOAD_KEY_ALIASES[inputKey] || inputKey;
      if (!allowedKeys.has(key) || Object.hasOwn(eventPayload, key)) continue;
      const value = sanitizeValue(key, inputValue);
      if (value !== null) eventPayload[key] = value;
    }
  }

  return {
    eventType,
    section: typeof input.section === 'string' && SAFE_SECTIONS.has(input.section)
      ? input.section
      : null,
    source: typeof input.source === 'string' && SAFE_TOP_LEVEL_SOURCES.has(input.source)
      ? input.source
      : null,
    eventPayload,
  };
}
