/**
 * Legacy calculation vocabulary used only by the separate astrologer-question
 * product. It must not leak into the personal Today/Week/Month contract.
 */
export type CalculatedAstroEvidence = {
  id: string;
  kind: 'transit_to_natal' | 'transit_house' | 'lunation' | 'ingress' | 'station' | 'period_aggregate';
  transitPlanet?: string | null;
  natalPoint?: string | null;
  aspect?: string | null;
  house?: number | null;
  orb?: number | null;
  status: 'applying' | 'separating' | 'exact' | 'active' | 'unknown';
  exactAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  strength: number;
  polarity: 'supporting' | 'challenging' | 'mixed' | 'neutral';
  calculationSource: string;
};

export type ForecastEvidenceView = {
  id: string;
  factor: string;
  orb: number | null;
  status: CalculatedAstroEvidence['status'];
  period: string | null;
  meaning: string;
};

export type PersonalForecastPeriod = 'day' | 'week' | 'month';
export type PersonalForecastWindow = {
  period: PersonalForecastPeriod;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  startsAt: Date;
  endsAt: Date;
};
export const PERSONAL_FORECAST_CALCULATION_VERSION = 'astrologer-question-legacy-v1';
