import type {
  ContentAccessTier,
  ContentSurface,
  ContentVariant,
  ContentInterpretation,
  ContentUnlock,
} from '../types';
import { db } from './db';
import { getMoscowTodayKey } from './date-utils';

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

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getNextDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
}

function getDefaultCacheKey(surface: ContentSurface, variant: ContentVariant) {
  if (surface === 'forecast' && variant === 'daily') return getMoscowTodayKey();
  if (surface === 'forecast' && (variant === 'morning' || variant === 'day' || variant === 'evening')) {
    return `${getMoscowTodayKey()}:${variant}`;
  }
  if (surface === 'natal' && variant === 'living') return getCurrentMonthKey();
  return 'default';
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

async function loadLegacyNatalAnchor(userId: string, chartId: number | null) {
  const scopeKey = chartId != null ? chartId : userId;
  const cached = await db.interpretations.getByHash(scopeKey, 'natal_intro', 'default');
  if (!cached?.content) return null;

  return {
    inputHash: 'default',
    content: cached.content,
    modelTier: 'base' as const,
    isPersistent: true,
    canRegenerateForLumi: true,
    legacySource: 'interpretations.natal_intro',
  };
}

async function loadLegacyNatalLiving(userId: string, chartId: number | null, cacheKey: string) {
  const scopeKey = chartId != null ? chartId : userId;
  const topics = [
    { key: 'personality', legacyType: 'deep_dive_personality' },
    { key: 'love', legacyType: 'deep_dive_love' },
    { key: 'career', legacyType: 'deep_dive_career' },
    { key: 'weakness', legacyType: 'deep_dive_weakness' },
    { key: 'karma', legacyType: 'deep_dive_karma' },
  ] as const;

  const sections: Record<string, string> = {};
  for (const topic of topics) {
    const row = await db.interpretations.getByHash(scopeKey, topic.legacyType, topic.key);
    if (row?.content) {
      sections[topic.key] = row.content;
    }
  }

  if (Object.keys(sections).length === 0) return null;

  const [year, month] = cacheKey.split('-');
  const validFrom = year && month ? `${cacheKey}-01T00:00:00.000Z` : null;

  return {
    inputHash: cacheKey,
    content: {
      periodKey: cacheKey,
      sections,
      migratedFrom: 'deep_dive_bundle',
    },
    modelTier: 'premium' as const,
    validFrom,
    isPersistent: false,
    canRegenerateForLumi: false,
    legacySource: 'interpretations.deep_dive_bundle',
  };
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
    canRegenerateForLumi: false,
    legacySource: 'daily_natal_cards',
  };
}

async function loadLegacyBridge(options: ContentLayerOptions & { chartId: number | null; cacheKey: string }) {
  const { userId, chartId, accessTier, contentSurface, contentVariant, cacheKey } = options;

  if (accessTier === 'free' && contentSurface === 'natal' && contentVariant === 'anchor') {
    return loadLegacyNatalAnchor(userId, chartId);
  }
  if (accessTier === 'premium' && contentSurface === 'natal' && contentVariant === 'living') {
    return loadLegacyNatalLiving(userId, chartId, cacheKey);
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

function getDefaultLumiReason(surface: ContentSurface, variant: ContentVariant) {
  if (surface === 'natal') return 'natal_recalculation';
  if (surface === 'forecast') return 'forecast_extra';
  if (surface === 'synastry') return 'synastry_one_off';
  if (surface === 'question') return 'question_one_off';
  return `${surface}_${variant}`;
}

export async function unlockContentLayer(options: ContentLayerOptions & { lumiCost?: number }): Promise<{
  unlock: ContentUnlock | null;
  chartId: number | null;
  cacheKey: string;
  via: 'free' | 'premium' | 'lumi';
}> {
  const cacheKey = options.cacheKey || getDefaultCacheKey(options.contentSurface, options.contentVariant);
  const chartId = await resolveChartId(options.userId, options.chartId);

  if (options.accessTier === 'premium') {
    const entitlement = await db.premium_entitlements.getActive(options.userId);
    if (!entitlement) {
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
      expiresAt: entitlement.endsAt,
      metadata: { entitlementId: entitlement.id },
    });
    return { unlock, chartId, cacheKey, via: 'premium' };
  }

  if (options.accessTier === 'lumi') {
    const lumiCost = Number(options.lumiCost ?? 0);
    if (!Number.isFinite(lumiCost) || lumiCost <= 0) {
      throw new Error('LUMI_COST_REQUIRED');
    }

    const existing = await db.content_unlocks.getLatestActive(options.userId, {
      accessTier: 'lumi',
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      chartId,
      cacheKey,
    });
    if (existing) {
      return { unlock: existing, chartId, cacheKey, via: 'lumi' };
    }

    await db.lumi_transactions.deductTransactional(
      options.userId,
      lumiCost,
      getDefaultLumiReason(options.contentSurface, options.contentVariant)
    );

    const unlock = await db.content_unlocks.add({
      userId: options.userId,
      chartId,
      accessTier: 'lumi',
      contentSurface: options.contentSurface,
      contentVariant: options.contentVariant,
      unlockType: 'lumi',
      cacheKey,
      lumiSpent: lumiCost,
    });
    return { unlock, chartId, cacheKey, via: 'lumi' };
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
  const entitlement = await db.premium_entitlements.getActive(userId);
  return {
    isPremium: !!entitlement,
    entitlement,
  };
}
