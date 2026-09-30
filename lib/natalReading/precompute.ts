import type { ContentInterpretation } from '../../types';
import { resolveReadingContext } from './apiHelper';
import {
  generateNatalUnifiedReadingWithLock,
  getCachedNatalUnifiedReading,
} from './unifiedApi';
import type { NatalUnifiedReading } from './unifiedReading';

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
