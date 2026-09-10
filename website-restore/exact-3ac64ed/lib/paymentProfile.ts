import type { PremiumEntitlementSnapshot, UserProfile } from '../types';
import { getProfilePremiumUntil, hasActivePremium } from './accessMatrix';

export type PaymentProfilePatch = Pick<
  UserProfile,
  'isPremium' | 'premiumUntil' | 'premiumEntitlement'
>;

export function paymentProfilePatchFromEntitlement(
  entitlement: PremiumEntitlementSnapshot,
): PaymentProfilePatch {
  return {
    isPremium: entitlement.isPremium,
    premiumUntil: entitlement.endsAt,
    premiumEntitlement: entitlement,
  };
}

export function paymentProfilePatchFromProfile(profile: UserProfile): PaymentProfilePatch {
  return {
    isPremium: hasActivePremium(profile),
    premiumUntil: getProfilePremiumUntil(profile),
    premiumEntitlement: profile.premiumEntitlement ?? null,
  };
}

export function mergePaymentProfilePatch(
  current: UserProfile | null,
  expectedUserId: string,
  patch: PaymentProfilePatch,
): UserProfile | null {
  if (!current || String(current.id) !== expectedUserId) return current;
  return { ...current, ...patch };
}
