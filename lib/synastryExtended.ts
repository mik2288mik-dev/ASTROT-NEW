import { createHash } from 'crypto';
import { getContentPolicy } from './contentMatrix';
import { COMPATIBILITY_ENGINE_VERSION } from './synastry/compatibilityEngine';
import { COMPATIBILITY_NARRATIVE_VERSION } from './synastry/compatibilityNarrative';

export const SYNASTRY_CONTEXT_PROMPT_VERSION = 'synastry-context.v10';

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
  subjectName = '',
  subjectDate = '',
  subjectTime = '',
  subjectPlace = '',
  inputSignature = '',
) {
  const raw = [
    userId,
    primaryChartId ?? 'none',
    partnerChartId ?? 'none',
    partnerName.trim().toLowerCase(),
    partnerDate,
    partnerTime.trim(),
    partnerPlace.trim().toLowerCase(),
    subjectName.trim().toLowerCase(),
    subjectDate,
    subjectTime.trim(),
    subjectPlace.trim().toLowerCase(),
    inputSignature.trim().toLowerCase(),
    relationshipType,
    language,
    getContentPolicy('deep_report').promptVersion,
    COMPATIBILITY_ENGINE_VERSION,
    SYNASTRY_CONTEXT_PROMPT_VERSION,
    COMPATIBILITY_NARRATIVE_VERSION,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}
