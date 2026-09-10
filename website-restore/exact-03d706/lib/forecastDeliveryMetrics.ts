export type ForecastDeliveryDomain = 'personal' | 'sign';
export type ForecastDeliveryOutcome =
  | 'cache_hit'
  | 'cache_miss'
  | 'generated'
  | 'prewarmed'
  | 'skipped_already_cached'
  | 'skipped_entitlement'
  | 'generation_in_progress'
  | 'failed';

export type ForecastDeliveryMetric = {
  domain: ForecastDeliveryDomain;
  outcome: ForecastDeliveryOutcome;
  period: 'day' | 'week' | 'month';
  periodKey: string;
  tier?: 'free' | 'premium';
  language?: 'ru' | 'en';
  reason?: string;
  generationCount?: number;
  signBatchGenerationCount?: number;
  errorCode?: string;
};

/** Structured counters only. Never include forecast copy or birth-profile data. */
export function logForecastDeliveryMetric(metric: ForecastDeliveryMetric): void {
  console.info('[forecast-delivery]', JSON.stringify({
    event: 'forecast_delivery',
    ...metric,
  }));
}
