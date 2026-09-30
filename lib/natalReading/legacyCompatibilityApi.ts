import type { ContentInterpretation } from '../../types';
import type { ReadingContext } from './apiHelper';
import {
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

  return { status: 'not_found' };
}
