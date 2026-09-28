import { createHash } from 'crypto';
import type { ContentInterpretation } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from '../contentGenerationLock';
import {
  getCachedReading,
  saveReading,
  type CachedReadingOptions,
  type ReadingContext,
} from './apiHelper';
import { generateNatalUnifiedReading } from './unifiedGeneration';
import {
  isNatalUnifiedReading,
  NATAL_UNIFIED_READING_CACHE_KEY,
  NATAL_UNIFIED_READING_CONTRACT_VERSION,
  NATAL_UNIFIED_READING_PROMPT_VERSION,
  type NatalUnifiedReading,
  type NatalUnifiedReadingTier,
} from './unifiedReading';

function languageOf(ctx: ReadingContext): 'ru' | 'en' {
  return ctx.profile.language === 'en' ? 'en' : 'ru';
}

function canonicalChart(ctx: ReadingContext): NatalChartDataV2 {
  const chart = ctx.chartData as unknown as NatalChartDataV2 | null;
  if (!chart || chart.schemaVersion !== 'natal-chart-data-v2') {
    throw Object.assign(new Error('Canonical natal chart required'), {
      code: 'CHART_REPAIR_REQUIRED',
    });
  }
  return chart;
}

function stableChart(chart: NatalChartDataV2) {
  const metadata = {
    ...chart.calculationMetadata,
    calculatedAt: undefined,
  };
  return {
    schemaVersion: chart.schemaVersion,
    calculationVersion: chart.calculationVersion,
    birth: {
      localDate: chart.birth.localDate,
      localTime: chart.birth.localTime,
      place: chart.birth.place,
      latitude: chart.birth.latitude,
      longitude: chart.birth.longitude,
      timezone: chart.birth.timezone,
      time: chart.birth.time,
      interval: chart.birth.interval,
    },
    positions: chart.positions,
    angles: chart.angles,
    houses: chart.houses,
    aspects: chart.aspects,
    chartQuality: chart.chartQuality,
    calculationMetadata: metadata,
  };
}

function inputHash(ctx: ReadingContext, tier: NatalUnifiedReadingTier): string {
  const chart = canonicalChart(ctx);
  return createHash('sha256').update(JSON.stringify({
    chart: stableChart(chart),
    tier,
    language: languageOf(ctx),
    contractVersion: NATAL_UNIFIED_READING_CONTRACT_VERSION,
    promptVersion: NATAL_UNIFIED_READING_PROMPT_VERSION,
  })).digest('hex');
}

export function natalUnifiedReadingCacheOptions(
  ctx: ReadingContext,
  tier: NatalUnifiedReadingTier,
): CachedReadingOptions {
  const language = languageOf(ctx);
  return {
    accessTier: tier,
    contentVariant: tier === 'free' ? 'brief' : 'full',
    cacheKey: `${NATAL_UNIFIED_READING_CACHE_KEY}.${tier}.${language}`,
    inputHash: inputHash(ctx, tier),
    promptVersion: NATAL_UNIFIED_READING_PROMPT_VERSION,
    modelTier: tier === 'free' ? 'base' : 'premium',
    isPersistent: true,
  };
}

export async function getCachedNatalUnifiedReading(
  ctx: ReadingContext,
  tier: NatalUnifiedReadingTier,
): Promise<ContentInterpretation<NatalUnifiedReading> | null> {
  const cached = await getCachedReading<NatalUnifiedReading>(
    ctx,
    natalUnifiedReadingCacheOptions(ctx, tier),
  );
  return cached && isNatalUnifiedReading(cached.content) ? cached : null;
}

export async function generateNatalUnifiedReadingWithLock(input: {
  userId: string;
  ctx: ReadingContext;
  tier: NatalUnifiedReadingTier;
}) {
  const options = natalUnifiedReadingCacheOptions(input.ctx, input.tier);
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: input.userId,
      chartId: input.ctx.chartId,
      accessTier: options.accessTier,
      contentSurface: 'natal',
      contentVariant: options.contentVariant,
      cacheKey: options.cacheKey,
      promptVersion: options.promptVersion,
    }),
    operation: `natal-unified-${input.tier}-generation`,
    readCached: async () => {
      const cached = await getCachedNatalUnifiedReading(input.ctx, input.tier);
      return cached
        ? { value: cached, source: 'natal_unified_v1' }
        : null;
    },
    generate: async () => {
      const reading = await generateNatalUnifiedReading({
        chart: canonicalChart(input.ctx),
        language: languageOf(input.ctx),
        tier: input.tier,
      });
      return saveReading(input.ctx, options, reading);
    },
  });
}
