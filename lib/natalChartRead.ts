import { natalChartV2Repository } from './natalChartV2Repository';
import { getPremiumEntitlementState } from './contentArchitecture';
import { assertChartReadable } from './chartAccessPolicy';
import { isCanonicalNatalChartDataComplete } from './natalChartCanonical';

/** Strict database read: no geocoding, ephemeris, repair or derived calculation. */
export async function getCanonicalNatalChart(userId: string, chartId?: number | null) {
  if (chartId != null && (!Number.isSafeInteger(chartId) || chartId <= 0)) {
    throw Object.assign(new Error('Invalid chart id'), { code: 'INVALID_CHART_ID', status: 400 });
  }
  const chart = chartId != null ? await natalChartV2Repository.getById(chartId) : await natalChartV2Repository.getPrimary(userId);
  if (!chart || String(chart.user_id) !== String(userId)) {
    throw Object.assign(new Error('Chart not found'), { code: 'CHART_NOT_FOUND', status: 404 });
  }
  const [entitlement, charts] = await Promise.all([
    getPremiumEntitlementState(userId), natalChartV2Repository.getAll(userId),
  ]);
  assertChartReadable(chart, entitlement.isPremium, charts);
  if (!chart.input_hash || !isCanonicalNatalChartDataComplete(chart.chart_data)) {
    throw Object.assign(new Error('Chart repair required'), { code: 'CHART_REPAIR_REQUIRED', status: 409 });
  }
  return chart;
}
