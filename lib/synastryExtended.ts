import { createHash } from 'crypto';

export function buildSynastryExtendedCacheKey(
  userId: string,
  primaryChartId: number | null,
  partnerChartId: number | null,
  partnerName: string,
  partnerDate: string,
  relationshipType: string,
  language: string
) {
  const raw = [
    userId,
    primaryChartId ?? 'none',
    partnerChartId ?? 'none',
    partnerName.trim().toLowerCase(),
    partnerDate,
    relationshipType,
    language,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}
