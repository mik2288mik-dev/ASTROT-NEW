import type { ContentSurface, ContentUnlock, ContentVariant } from '../types';
import {
  getProfilePremiumUntil,
  hasActivePremium,
  resolveEntitlementState,
  type ProfileAccessState,
} from './accessMatrix';
import { getPremiumEntitlementState } from './contentArchitecture';
import type { UnlockedContentEntry, UserState } from './contentAccessMatrix';
import { matchesUnlockEntry as matrixMatchesUnlockEntry } from './contentAccessMatrix';
import { normalizeStoredAccessTier } from './contentAccessTier';
import { db } from './db';

export function mapUnlocksToUserState(unlocks: ContentUnlock[]): UnlockedContentEntry[] {
  return unlocks.map((unlock) => ({
    surface: unlock.contentSurface,
    variant: unlock.contentVariant,
    accessTier: normalizeStoredAccessTier(unlock.accessTier),
    cacheKey: unlock.cacheKey,
  }));
}

export function hasExistingUnlock(
  userState: UserState,
  surface: ContentSurface,
  variant: ContentVariant,
  cacheKey?: string
): boolean {
  if (userState.unlockedContent.some((entry) => matrixMatchesUnlockEntry(entry, surface, variant, cacheKey))) {
    return true;
  }

  return false;
}

export async function buildContentAccessUserState(
  userId: string,
  chartId?: number | null
): Promise<UserState> {
  const resolvedChartId = chartId ?? (await db.natal_charts.getPrimary(userId).catch(() => null))?.id ?? null;
  const [premiumState, unlocks] = await Promise.all([
    getPremiumEntitlementState(userId),
    db.content_unlocks.listActive(userId, resolvedChartId).catch(() => [] as ContentUnlock[]),
  ]);
  const user = await db.users.get(userId).catch(() => null);
  const entitlement = premiumState.entitlement;
  const hasCanonicalSnapshot = typeof premiumState.state === 'string';
  const entitlementProfile: ProfileAccessState = hasCanonicalSnapshot
    ? {
        premiumEntitlement: {
          state: premiumState.state,
          isPremium: premiumState.isPremium,
          source: premiumState.source,
          startsAt: premiumState.startsAt,
          endsAt: premiumState.endsAt,
          autoRenew: premiumState.autoRenew,
          productId: premiumState.productId,
          period: premiumState.period,
        },
      }
    : entitlement
      ? {
          entitlementStatus: entitlement.status,
          entitlementSource: entitlement.source,
          entitlementEndsAt: entitlement.endsAt,
        }
      : {
          premiumUntil: user?.premium_until ? String(user.premium_until) : null,
        };
  const privilegedSource = premiumState.source === 'owner' || premiumState.source === 'admin';
  const isServerOnlyAdmin = privilegedSource || (premiumState.isPremium
    && !entitlement
    && !user?.premium_until
    && !hasCanonicalSnapshot);
  const accessProfile: ProfileAccessState = {
    ...entitlementProfile,
    isAdmin: Boolean(user?.is_admin) || isServerOnlyAdmin,
  };
  const entitlementState = resolveEntitlementState(accessProfile);

  return {
    userId,
    chartId: resolvedChartId,
    isPremium: hasActivePremium(accessProfile),
    isAdmin: accessProfile.isAdmin,
    entitlementState,
    entitlementStatus: entitlement?.status ?? null,
    entitlementSource: premiumState.source
      ?? entitlement?.source
      ?? (entitlementState === 'gift' ? 'legacy_gift' : null),
    entitlementEndsAt: getProfilePremiumUntil(accessProfile),
    unlockedContent: mapUnlocksToUserState(unlocks),
  };
}
