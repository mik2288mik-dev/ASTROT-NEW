import type {
  ContentAccessTier,
  ContentSurface,
  ContentVariant,
  ContentInterpretation,
  ContentUnlock,
} from '../types';
import { db } from './db';
import { getConfiguredOwnerId } from './adminAuth';
import { getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey, getMoscowYearKey } from './date-utils';
import { getCurrentNatalPeriodKey } from './natalReadings';
import { isGuestUserId } from './userId';

const log = {
  info: (message: string, data?: any) => {
    console.log(`[ContentArchitecture] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[ContentArchitecture] WARN: ${message}`, data || '');
  },
};

type ContentLayerOptions = {
  userId: string;
  chartId?: number | null;
  accessTier: ContentAccessTier;
  contentSurface: ContentSurface;
  contentVariant: ContentVariant;
  cacheKey?: string;
};

type ContentLayerResult = {
  interpretation: ContentInterpretation | null;
  chartId: number | null;
  cacheKey: string;
  source: 'content_v1' | 'legacy_bridge' | 'miss';
};

function getNextDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
}

function getDefaultCacheKey(surface: ContentSurface, variant: ContentVariant) {
  if (surface === 'forecast' && variant === 'daily') return getMoscowTodayKey();
  if (surface === 'forecast' && variant === 'weekly') return getMoscowIsoWeekKey();
  if (surface === 'forecast' && variant === 'monthly') return getMoscowMonthKey();
  if (surface === 'forecast' && variant === 'yearly') return getMoscowYearKey();
  if (surface === 'natal' && variant === 'anchor') return 'base';
  if (surface === 'natal' && variant === 'full') return 'personality';
  if (surface === 'natal' && variant === 'living') return getCurrentNatalPeriodKey();
  return 'default';
}

/** @internal Exported for cache-policy tests */
export function getDefaultCacheKeyForContent(surface: ContentSurface, variant: ContentVariant) {
  return getDefaultCacheKey(surface, variant);
}

async function resolveChartId(userId: string, chartId?: number | null) {
  if (chartId != null) return chartId;
  const primaryChart = await db.natal_charts.getPrimary(userId);
  return primaryChart?.id ?? null;
}

async function upsertScopedInterpretation(
  userId: string,
  chartId: number | null,
  data: Parameters<typeof db.content_interpretations.upsertByUser>[1]
) {
  if (chartId != null) {
    return db.content_interpretations.upsertByChart(chartId, data, userId);
  }
  return db.content_interpretations.upsertByUser(userId, data);
}

async function loadLegacyForecastDaily(userId: string, chartId: number | null, cacheKey: string) {
  const daily = chartId != null
    ? await db.daily_natal_cards.getByChart(chartId, cacheKey)
    : await db.daily_natal_cards.getForPrimaryUser(userId, cacheKey);

  if (!daily) return null;

  return {
    inputHash: cacheKey,
    content: daily,
    modelTier: 'base' as const,
    validFrom: `${cacheKey}T00:00:00.000Z`,
    validTo: `${getNextDateKey(cacheKey)}T00:00:00.000Z`,
    isPersistent: false,
    legacySource: 'daily_natal_cards',
  };
}

async function loadLegacyBridge(options: ContentLayerOptions & { chartId: number | null; cacheKey: string }) {
  const { userId, chartId, accessTier, contentSurface, contentVariant, cacheKey } = options;

  if (contentSurface === 'natal' && (contentVariant === 'anchor' || contentVariant === 'living' || contentVariant === 'full')) {
    return null;
  }
  if (accessTier === 'free' && contentSurface === 'forecast' && contentVariant === 'daily') {
    return loadLegacyForecastDaily(userId, chartId, cacheKey);
  }

  return null;
}

export async function getContentLayer(options: ContentLayerOptions): Promise<ContentLayerResult> {
  const cacheKey = options.cacheKey || getDefaultCacheKey(options.contentSurface, options.contentVariant);
  const chartId = await resolveChartId(options.userId, options.chartId);

  const interpretation = chartId != null
    ? await db.content_interpretations.getByChart(
        chartId,
        options.accessTier,
        options.contentSurface,
        options.contentVariant,
        cacheKey
      )
    : await db.content_interpretations.getByUser(
        options.userId,
        options.accessTier,
        options.contentSurface,
        options.contentVariant,
        cacheKey
      );

  if (interpretation) {
    return { interpretation, chartId, cacheKey, source: 'content_v1' };
  }

  const bridged = await loadLegacyBridge({ ...options, chartId, cacheKey });
  if (!bridged) {
    return { interpretation: null, chartId, cacheKey, source: 'miss' };
  }

  const created = await upsertScopedInterpretation(options.userId, chartId, {
    accessTier: options.accessTier,
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    cacheKey,
    ...bridged,
  });

  if (created) {
    log.info('Bridged legacy content into content_v1', {
      userId: options.userId,
      chartId,
      accessTier: options.accessTier,
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      cacheKey,
      legacySource: bridged.legacySource,
    });
  }

  return { interpretation: created, chartId, cacheKey, source: created ? 'legacy_bridge' : 'miss' };
}

export async function unlockContentLayer(
  options: ContentLayerOptions
): Promise<{
  unlock: ContentUnlock | null;
  chartId: number | null;
  cacheKey: string;
  via: 'free' | 'premium';
}> {
  const cacheKey = options.cacheKey || getDefaultCacheKey(options.contentSurface, options.contentVariant);
  const chartId = await resolveChartId(options.userId, options.chartId);

  if (options.accessTier === 'premium') {
    const entitlementState = await getPremiumEntitlementState(options.userId);
    if (!entitlementState.isPremium) {
      throw new Error('PREMIUM_REQUIRED');
    }

    const existing = await db.content_unlocks.getLatestActive(options.userId, {
      accessTier: 'premium',
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      chartId,
      cacheKey,
    });
    if (existing) {
      return { unlock: existing, chartId, cacheKey, via: 'premium' };
    }

    const unlock = await db.content_unlocks.add({
      userId: options.userId,
      chartId,
      accessTier: 'premium',
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      unlockType: 'premium',
      cacheKey,
      expiresAt: entitlementState.entitlement?.endsAt ?? null,
      metadata: entitlementState.entitlement
        ? { entitlementId: entitlementState.entitlement.id }
        : { entitlementSource: 'active_premium' },
    });
    return { unlock, chartId, cacheKey, via: 'premium' };
  }

  const existing = await db.content_unlocks.getLatestActive(options.userId, {
    accessTier: 'free',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    chartId,
    cacheKey,
  });
  if (existing) {
    return { unlock: existing, chartId, cacheKey, via: 'free' };
  }

  const unlock = await db.content_unlocks.add({
    userId: options.userId,
    chartId,
    accessTier: 'free',
    contentSurface: options.contentSurface,
    contentVariant: options.contentVariant,
    unlockType: 'free',
    cacheKey,
  });
  return { unlock, chartId, cacheKey, via: 'free' };
}

export async function getPremiumEntitlementState(userId: string) {
  if (isGuestUserId(userId)) return { isPremium: false, entitlement: null };

  const ownerId = getConfiguredOwnerId();
  if (ownerId && String(userId) === String(ownerId)) {
    return {
      isPremium: true,
      entitlement: null,
    };
  }

  let entitlement: Awaited<ReturnType<typeof db.premium_entitlements.getActive>> | null = null;
  try {
    entitlement = await db.premium_entitlements.getActive(userId);
  } catch (error: any) {
    log.warn('Premium entitlement lookup failed; falling back to users.premium_until', {
      userId,
      error: error?.message || String(error),
    });
  }

  if (entitlement) {
    return {
      isPremium: true,
      entitlement,
    };
  }

  const user = await db.users.get(userId);
  if (user?.is_admin) {
    return {
      isPremium: true,
      entitlement: null,
    };
  }

  const premiumUntil = user?.premium_until ? new Date(user.premium_until) : null;
  if (premiumUntil && !Number.isNaN(premiumUntil.getTime()) && premiumUntil.getTime() > Date.now()) {
    return {
      isPremium: true,
      entitlement: null,
    };
  }

  return {
    isPremium: false,
    entitlement: null,
  };
}
