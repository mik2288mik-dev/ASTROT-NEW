import { createHash } from 'crypto';
import type { ContentInterpretation } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { db, getPool } from '../db';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from '../contentGenerationLock';
import {
  saveReading,
  type CachedReadingOptions,
  type ReadingContext,
} from './apiHelper';
import { generateNatalUnifiedReading } from './unifiedGeneration';
import {
  isNatalUnifiedReading,
  NATAL_UNIFIED_READING_CACHE_KEY,
  NATAL_UNIFIED_READING_PROMPT_VERSION,
  NATAL_COPY_REVISION,
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

export function natalUnifiedReadingInputHash(ctx: ReadingContext): string {
  return createHash('sha256').update(JSON.stringify({
    birth: canonicalChart(ctx).birth,
    language: languageOf(ctx),
  })).digest('hex');
}

function legacyInputHash(ctx: ReadingContext, promptVersion: string, contractVersion: string): string {
  const chart = canonicalChart(ctx);
  return createHash('sha256').update(JSON.stringify({
    chart: stableChart(chart),
    language: languageOf(ctx),
    contractVersion,
    promptVersion,
  })).digest('hex');
}

export function natalUnifiedReadingCacheOptions(
  ctx: ReadingContext,
  _tier: NatalUnifiedReadingTier,
): CachedReadingOptions {
  const language = languageOf(ctx);
  return {
    accessTier: 'premium',
    contentVariant: 'full',
    cacheKey: `${NATAL_UNIFIED_READING_CACHE_KEY}.canonical.${language}.${natalUnifiedReadingInputHash(ctx)}`,
    inputHash: natalUnifiedReadingInputHash(ctx),
    promptVersion: NATAL_UNIFIED_READING_PROMPT_VERSION,
    modelTier: 'premium',
    isPersistent: true,
  };
}

export async function getCachedNatalUnifiedReading(
  ctx: ReadingContext,
  tier: NatalUnifiedReadingTier,
  requiredCopyRevision?: string,
): Promise<ContentInterpretation<NatalUnifiedReading> | null> {
  if (ctx.chartId == null) return null;
  const options = natalUnifiedReadingCacheOptions(ctx, tier);
  // Old voice versions remain readable. Verify the actual chart and language,
  // rather than treating editorial version changes as missing natal content.
  const candidates = await getPool().query<{ cache_key: string }>(
    `SELECT cache_key FROM content_interpretations
     WHERE chart_id=$1 AND user_id=$2 AND access_tier='premium'
       AND content_surface='natal' AND content_variant='full'
       AND cache_key LIKE 'natal.unified-reading.v3%'
     ORDER BY updated_at DESC, id DESC`,
    [ctx.chartId, String(ctx.profile.id)],
  );
  let previous: ContentInterpretation<NatalUnifiedReading> | null = null;
  for (const row of candidates.rows) {
    const cached = await db.content_interpretations.getByChart(
      ctx.chartId, 'premium', 'natal', 'full', row.cache_key, true,
    ) as ContentInterpretation<NatalUnifiedReading> | null;
    if (!cached || !isNatalUnifiedReading(cached.content) || cached.content.tier !== 'premium') continue;
    const matches = cached.inputHash === options.inputHash || cached.inputHash === legacyInputHash(
      ctx, String(cached.promptVersion || ''), cached.content.contractVersion,
    );
    if (!matches) continue;
    if (cached.content.copyRevision === (requiredCopyRevision || NATAL_COPY_REVISION)) return cached;
    if (!requiredCopyRevision && !previous) previous = cached;
  }
  return previous;
}

export async function generateNatalUnifiedReadingWithLock(input: {
  userId: string;
  ctx: ReadingContext;
  tier: NatalUnifiedReadingTier;
  progress?: Parameters<typeof generateNatalUnifiedReading>[0]['progress'];
  onProgress?: Parameters<typeof generateNatalUnifiedReading>[0]['onProgress'];
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
      promptVersion: options.inputHash,
    }),
    operation: 'natal-unified-generation',
    readCached: async () => {
      const cached = await getCachedNatalUnifiedReading(input.ctx, input.tier, NATAL_COPY_REVISION);
      return cached
        ? { value: cached, source: 'natal_unified_v1' }
        : null;
    },
    generate: async () => {
      const reading = await generateNatalUnifiedReading({
        chart: canonicalChart(input.ctx),
        language: languageOf(input.ctx),
        tier: 'premium',
        progress: input.progress,
        onProgress: input.onProgress,
      });
      return saveReading(input.ctx, options, reading);
    },
  });
}
