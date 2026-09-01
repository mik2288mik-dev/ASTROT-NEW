import type { FeatureKey } from './accessMatrix';
import type { ViewState } from '../types';

export type PaywallPlacement =
  | 'today'
  | 'week'
  | 'month'
  | 'deep_natal'
  | 'personality_deep'
  | 'natal_questions'
  | 'compatibility_by_charts'
  | 'saved_people'
  | 'settings';

export type PaywallTriggerType =
  | 'inline_promo'
  | 'locked_feature'
  | 'settings';

export type PaywallOutcome =
  | 'close'
  | 'checkout_cancelled'
  | 'checkout_failed'
  | 'checkout_unavailable'
  | 'purchase_succeeded';

export type PaywallContext = {
  entryPoint: string;
  placement: PaywallPlacement;
  featureKey: FeatureKey;
  triggerType: PaywallTriggerType;
  returnView: ViewState;
  returnScrollAnchor: string | null;
  returnAction: string | null;
  returnEntityId: string | null;
  paywallInstanceId: string;
};

const PAYWALL_PLACEMENTS = new Set<PaywallPlacement>([
  'today',
  'week',
  'month',
  'deep_natal',
  'personality_deep',
  'natal_questions',
  'compatibility_by_charts',
  'saved_people',
  'settings',
]);

const PAYWALL_TRIGGER_TYPES = new Set<PaywallTriggerType>([
  'inline_promo',
  'locked_feature',
  'settings',
]);

function defaultRequestContext(
  source: string,
  returnView: ViewState,
): Pick<PaywallContext, 'placement' | 'featureKey' | 'triggerType' | 'returnScrollAnchor' | 'returnAction' | 'returnEntityId'> {
  if (source === 'settings') {
    return { placement: 'settings', featureKey: 'personal_daily_full', triggerType: 'settings', returnScrollAnchor: null, returnAction: null, returnEntityId: null };
  }
  if (source === 'charts') {
    return { placement: 'saved_people', featureKey: 'saved_people', triggerType: 'locked_feature', returnScrollAnchor: null, returnAction: 'add_saved_person', returnEntityId: null };
  }
  if (source === 'natal_questions') {
    return { placement: 'natal_questions', featureKey: 'natal_questions', triggerType: 'locked_feature', returnScrollAnchor: 'natal-question-action', returnAction: 'open_natal_questions', returnEntityId: null };
  }
  if (source === 'deep_natal' || source === 'natal_story_unlock') {
    return { placement: 'deep_natal', featureKey: 'natal_deep', triggerType: 'locked_feature', returnScrollAnchor: 'natal-deep-premium', returnAction: 'open_deep_natal', returnEntityId: null };
  }
  if (returnView === 'synastry') {
    return { placement: 'compatibility_by_charts', featureKey: 'synastry_by_charts', triggerType: 'locked_feature', returnScrollAnchor: null, returnAction: 'open_birth_compatibility', returnEntityId: null };
  }
  if (returnView === 'chart') {
    return { placement: 'deep_natal', featureKey: 'natal_deep', triggerType: 'locked_feature', returnScrollAnchor: 'natal-deep-premium', returnAction: 'open_deep_natal', returnEntityId: null };
  }
  return { placement: 'today', featureKey: 'personal_daily_full', triggerType: 'locked_feature', returnScrollAnchor: null, returnAction: null, returnEntityId: null };
}

export function createPaywallContextFromRequest(input: {
  source?: string;
  payload?: Record<string, unknown>;
  currentView: ViewState;
}): PaywallContext {
  const source = String(input.source || 'app');
  const fallback = defaultRequestContext(source, input.currentView);
  const payloadPlacement = input.payload?.placement;
  const payloadFeature = input.payload?.featureKey;
  const payloadTrigger = input.payload?.triggerType;
  const payloadReturnView = input.payload?.returnView;
  return createPaywallContext({
    entryPoint: source,
    placement: PAYWALL_PLACEMENTS.has(payloadPlacement as PaywallPlacement)
      ? payloadPlacement as PaywallPlacement
      : fallback.placement,
    featureKey: typeof payloadFeature === 'string'
      ? payloadFeature as FeatureKey
      : fallback.featureKey,
    triggerType: PAYWALL_TRIGGER_TYPES.has(payloadTrigger as PaywallTriggerType)
      ? payloadTrigger as PaywallTriggerType
      : fallback.triggerType,
    returnView: typeof payloadReturnView === 'string'
      ? payloadReturnView as ViewState
      : input.currentView,
    returnScrollAnchor: typeof input.payload?.returnScrollAnchor === 'string'
      ? input.payload.returnScrollAnchor
      : fallback.returnScrollAnchor,
    returnAction: typeof input.payload?.returnAction === 'string'
      ? input.payload.returnAction
      : fallback.returnAction,
    returnEntityId: typeof input.payload?.returnEntityId === 'string'
      || typeof input.payload?.returnEntityId === 'number'
      ? String(input.payload.returnEntityId)
      : fallback.returnEntityId,
  });
}

type CreatePaywallContextInput = Omit<PaywallContext, 'entryPoint' | 'paywallInstanceId' | 'returnAction' | 'returnEntityId'> & {
  entryPoint?: string;
  paywallInstanceId?: string;
  returnAction?: string | null;
  returnEntityId?: string | null;
};

let fallbackInstanceSequence = 0;

export function createPaywallInstanceId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  fallbackInstanceSequence += 1;
  return `pw-${Date.now().toString(36)}-${fallbackInstanceSequence.toString(36)}`;
}

export function createPaywallContext(input: CreatePaywallContextInput): PaywallContext {
  return {
    ...input,
    entryPoint: input.entryPoint || input.placement,
    returnScrollAnchor: input.returnScrollAnchor || null,
    returnAction: input.returnAction || null,
    returnEntityId: input.returnEntityId || null,
    paywallInstanceId: input.paywallInstanceId || createPaywallInstanceId(),
  };
}

export function resolvePaywallOutcome(
  context: PaywallContext,
  outcome: PaywallOutcome,
): {
  view: ViewState;
  scrollAnchor: string | null;
  featureKey: FeatureKey;
  shouldOpenFeature: boolean;
} {
  return {
    view: context.returnView,
    scrollAnchor: context.returnScrollAnchor,
    featureKey: context.featureKey,
    shouldOpenFeature: outcome === 'purchase_succeeded',
  };
}
