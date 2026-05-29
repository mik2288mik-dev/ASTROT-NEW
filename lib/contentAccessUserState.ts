import type { ContentSurface, ContentUnlock, ContentVariant } from '../types';
import { getPremiumEntitlementState } from './contentArchitecture';
import type { UnlockedContentEntry, UserState } from './contentAccessMatrix';
import { canAccessContent, matchesUnlockEntry as matrixMatchesUnlockEntry } from './contentAccessMatrix';
import { db } from './db';

export function mapUnlocksToUserState(unlocks: ContentUnlock[]): UnlockedContentEntry[] {
  return unlocks.map((unlock) => ({
    surface: unlock.contentSurface,
    variant: unlock.contentVariant,
    accessTier: unlock.accessTier,
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

  if (surface === 'forecast' && (variant === 'morning' || variant === 'day' || variant === 'evening')) {
    return userState.unlockedContent.some((entry) =>
      matrixMatchesUnlockEntry(entry, 'forecast', 'full', cacheKey)
    );
  }

  return false;
}

export async function buildContentAccessUserState(
  userId: string,
  chartId?: number | null
): Promise<UserState> {
  const resolvedChartId = chartId ?? (await db.natal_charts.getPrimary(userId).catch(() => null))?.id ?? null;
  const [{ isPremium }, lumiBalance, unlocks] = await Promise.all([
    getPremiumEntitlementState(userId),
    db.lumi_transactions.getBalance(userId).catch(() => 0),
    db.content_unlocks.listActive(userId, resolvedChartId).catch(() => [] as ContentUnlock[]),
  ]);

  return {
    userId,
    chartId: resolvedChartId,
    isPremium,
    lumiBalance,
    unlockedContent: mapUnlocksToUserState(unlocks),
  };
}

export function canAccessForecastDaypart(
  userState: UserState,
  variant: 'morning' | 'day' | 'evening',
  unlockCacheKey?: string
): boolean {
  return canAccessContent(userState, 'forecast', variant, unlockCacheKey);
}
