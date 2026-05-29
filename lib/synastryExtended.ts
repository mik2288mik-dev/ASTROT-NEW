import { createHash } from 'crypto';
import {
  SYNASTRY_EXTENDED_STARS_COST,
  SYNASTRY_EXTENDED_LUMI_COST,
} from './starsPricing';

export { SYNASTRY_EXTENDED_STARS_COST, SYNASTRY_EXTENDED_LUMI_COST };

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
