import { createHash } from 'crypto';

function readSynastryExtendedLumiCost(): number {
  if (typeof process === 'undefined' || !process.env) return 180;
  const raw =
    process.env.SYNASTRY_EXTENDED_LUMI_COST || process.env.NEXT_PUBLIC_SYNASTRY_EXTENDED_LUMI_COST;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

/** Разовое Lumi-открытие полного разбора синастрии. Сервер: `SYNASTRY_EXTENDED_LUMI_COST`; клиент: `NEXT_PUBLIC_SYNASTRY_EXTENDED_LUMI_COST`. */
export const SYNASTRY_EXTENDED_LUMI_COST = readSynastryExtendedLumiCost();

export function buildSynastryExtendedCacheKey(
  userId: string,
  primaryChartId: number | null,
  partnerChartId: number | null,
  partnerName: string,
  partnerDate: string,
  relationshipType: string,
  language: string
): string {
  const normName = partnerName.trim().toLowerCase();
  return createHash('sha256')
    .update(
      `syn_ext|${userId}|${primaryChartId ?? 0}|${partnerChartId ?? 0}|${normName}|${partnerDate}|${relationshipType}|${language}`
    )
    .digest('hex');
}
