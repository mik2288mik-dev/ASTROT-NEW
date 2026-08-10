import { createHash } from 'crypto';
import { getContentPolicy } from './contentMatrix';

export const SYNASTRY_CONTEXT_PROMPT_VERSION = 'synastry-context.v3';

export function buildSynastryExtendedCacheKey(
  userId: string,
  primaryChartId: number | null,
  partnerChartId: number | null,
  partnerName: string,
  partnerDate: string,
  relationshipType: string,
  language: string,
  partnerTime = '',
  partnerPlace = '',
) {
  const raw = [
    userId,
    primaryChartId ?? 'none',
    partnerChartId ?? 'none',
    partnerName.trim().toLowerCase(),
    partnerDate,
    partnerTime.trim(),
    partnerPlace.trim().toLowerCase(),
    relationshipType,
    language,
    getContentPolicy('deep_report').promptVersion,
    SYNASTRY_CONTEXT_PROMPT_VERSION,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}
