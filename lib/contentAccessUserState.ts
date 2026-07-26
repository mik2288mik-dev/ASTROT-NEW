import type { ContentSurface, ContentUnlock, ContentVariant } from '../types';
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
  const [{ isPremium }, unlocks] = await Promise.all([
    getPremiumEntitlementState(userId),
    db.content_unlocks.listActive(userId, resolvedChartId).catch(() => [] as ContentUnlock[]),
  ]);

  return {
    userId,
    chartId: resolvedChartId,
    isPremium,
    unlockedContent: mapUnlocksToUserState(unlocks),
  };
}
