import type { ContentInterpretation } from '../../types';
import type { ReadingContext } from './apiHelper';
import {
  generateNatalUnifiedReadingWithLock,
  getCachedNatalUnifiedReading,
} from './unifiedApi';
import type { NatalUnifiedReading } from './unifiedReading';

export type LegacyUnifiedLoadResult =
  | {
      status: 'ready';
      interpretation: ContentInterpretation<NatalUnifiedReading>;
      source: string;
      fromCache: boolean;
    }
  | {
      status: 'not_found';
    }
  | {
      status: 'in_progress';
      retryAfterMs: number;
    };

export async function loadUnifiedReadingForLegacyEndpoint(input: {
  userId: string;
  ctx: ReadingContext;
  method: 'GET' | 'POST';
}): Promise<LegacyUnifiedLoadResult> {
  const cached = await getCachedNatalUnifiedReading(input.ctx, 'premium');
  if (cached) {
    return {
      status: 'ready',
      interpretation: cached,
      source: 'natal_unified_v1',
      fromCache: true,
    };
  }

  if (input.method === 'GET') return { status: 'not_found' };

  const generated = await generateNatalUnifiedReadingWithLock({
    userId: input.userId,
    ctx: input.ctx,
    tier: 'premium',
  });
  if (generated.status === 'in_progress') {
    return {
      status: 'in_progress',
      retryAfterMs: generated.retryAfterMs,
    };
  }
  return {
    status: 'ready',
    interpretation: generated.value,
    source: generated.fromCache ? (generated.source || 'natal_unified_v1') : 'generated',
    fromCache: generated.fromCache,
  };
}
