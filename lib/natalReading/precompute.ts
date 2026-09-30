import type { ContentInterpretation } from '../../types';
import { getPool } from '../db';
import { resolveReadingContext } from './apiHelper';
import {
  generateNatalUnifiedReadingWithLock,
  getCachedNatalUnifiedReading,
} from './unifiedApi';
import {
  NATAL_UNIFIED_READING_CACHE_KEY,
  NATAL_UNIFIED_READING_CONTRACT_VERSION,
  NATAL_UNIFIED_READING_PROMPT_VERSION,
  type NatalUnifiedReading,
} from './unifiedReading';

const PRECOMPUTE_TIMEOUT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prepare the canonical full natal reading immediately after a chart write.
 *
 * This is deliberately NOT called by page-load/read APIs. The user-facing
 * natal page is read-only: it only returns content that is already persisted.
 * Generation belongs to chart creation / birth-data change / explicit backfill.
 */
export async function precomputeNatalUnifiedReadingForChart(input: {
  userId: string;
  chartId: number;
}): Promise<ContentInterpretation<NatalUnifiedReading>> {
  const ctx = await resolveReadingContext(input.userId, input.chartId, undefined, undefined, {
    repairCanonical: false,
  });
  if (!ctx?.chartData || ctx.chartId == null) {
    throw Object.assign(new Error('Canonical natal chart required before reading precompute'), {
      code: 'PRIMARY_CHART_MISSING',
    });
  }

  const cached = await getCachedNatalUnifiedReading(ctx, 'premium');
  if (cached) return cached;

  const startedAt = Date.now();
  let result = await generateNatalUnifiedReadingWithLock({
    userId: input.userId,
    ctx,
    tier: 'premium',
  });

  if (result.status === 'ready') return result.value;

  let retryAfterMs = Math.max(250, Math.min(result.retryAfterMs || 1000, 5000));
  while (Date.now() - startedAt < PRECOMPUTE_TIMEOUT_MS) {
    await sleep(retryAfterMs);
    const ready = await getCachedNatalUnifiedReading(ctx, 'premium');
    if (ready) return ready;
    result = await generateNatalUnifiedReadingWithLock({
      userId: input.userId,
      ctx,
      tier: 'premium',
    });
    if (result.status === 'ready') return result.value;
    retryAfterMs = Math.max(250, Math.min(result.retryAfterMs || Math.round(retryAfterMs * 1.35), 5000));
  }

  throw Object.assign(new Error('Natal reading precompute timed out'), {
    code: 'NATAL_UNIFIED_PRECOMPUTE_TIMEOUT',
  });
}

export type NatalUnifiedBackfillResult = {
  status: 'idle' | 'cached' | 'generated';
  userId?: string;
  chartId?: number;
};

/**
 * Incremental migration path for charts that existed before unified readings.
 * It is cron/backfill-only: user reads never call this function.
 */
export async function prewarmNatalUnifiedReadingBackfillIncrement(): Promise<NatalUnifiedBackfillResult> {
  const result = await getPool().query<{ chart_id: number; user_id: string }>(
    `SELECT nc.id AS chart_id, nc.user_id
       FROM natal_charts nc
       JOIN users u ON u.id = nc.user_id
      WHERE nc.archived_at IS NULL
        AND nc.input_hash IS NOT NULL
        AND nc.chart_data IS NOT NULL
        AND nc.chart_data->>'schemaVersion' = 'natal-chart-data-v2'
        AND NOT EXISTS (
          SELECT 1
            FROM content_interpretations ci
           WHERE ci.chart_id = nc.id
             AND ci.access_tier = 'premium'
             AND ci.content_surface = 'natal'
             AND ci.content_variant = 'full'
             AND ci.cache_key = $1 || '.canonical.' || CASE WHEN u.language = 'en' THEN 'en' ELSE 'ru' END
             AND ci.prompt_version = $2
             AND ci.content->>'contractVersion' = $3
             AND (ci.valid_to IS NULL OR ci.valid_to >= NOW())
             AND ci.updated_at >= nc.updated_at
        )
      ORDER BY nc.is_primary DESC,
               COALESCE(u.last_login, u.created_at) DESC NULLS LAST,
               nc.updated_at DESC,
               nc.id DESC
      LIMIT 1`,
    [
      NATAL_UNIFIED_READING_CACHE_KEY,
      NATAL_UNIFIED_READING_PROMPT_VERSION,
      NATAL_UNIFIED_READING_CONTRACT_VERSION,
    ],
  );

  const row = result.rows[0];
  if (!row) return { status: 'idle' };

  const userId = String(row.user_id);
  const chartId = Number(row.chart_id);
  const ctx = await resolveReadingContext(userId, chartId, undefined, undefined, {
    repairCanonical: false,
  });
  if (!ctx?.chartData || ctx.chartId == null) {
    return { status: 'idle' };
  }

  const cached = await getCachedNatalUnifiedReading(ctx, 'premium');
  if (cached) return { status: 'cached', userId, chartId };

  await precomputeNatalUnifiedReadingForChart({ userId, chartId });
  return { status: 'generated', userId, chartId };
}
