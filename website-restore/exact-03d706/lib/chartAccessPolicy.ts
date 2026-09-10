export {
  FREE_ACTIVE_CHART_LIMIT,
  FREE_SAVED_PERSON_LIMIT,
  PREMIUM_ACTIVE_CHART_LIMIT,
  PREMIUM_SAVED_PERSON_LIMIT,
} from './accessMatrix';
import {
  FREE_ACTIVE_CHART_LIMIT,
  FREE_SAVED_PERSON_LIMIT,
  PREMIUM_ACTIVE_CHART_LIMIT,
  PREMIUM_SAVED_PERSON_LIMIT,
} from './accessMatrix';

const LOCKED_CALCULATION_FIELDS = [
  'chart_data',
  'sun',
  'moon',
  'ascendant',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'houses',
  'aspects',
  'sun_sign',
  'moon_sign',
  'ascendant_sign',
  'input_hash',
  'calculation_version',
  'latitude',
  'longitude',
  'timezone',
] as const;

export type ChartSubjectType = 'self' | 'saved_person';

export type ChartIdentityRecord = {
  id?: number | null;
  is_primary?: boolean | null;
  subject_type?: string | null;
  archived_at?: string | Date | null;
  relation_label?: string | null;
  created_at?: string | Date | null;
};

export type ChartAccessErrorCode =
  | 'PREMIUM_REQUIRED'
  | 'CHART_LIMIT_REACHED'
  | 'SELF_CHART_REQUIRED'
  | 'SELF_CHART_IMMUTABLE'
  | 'CHART_ARCHIVED';

export class ChartAccessPolicyError extends Error {
  readonly code: ChartAccessErrorCode;
  readonly status: number;

  constructor(code: ChartAccessErrorCode, message: string, status = 403) {
    super(message);
    this.name = 'ChartAccessPolicyError';
    this.code = code;
    this.status = status;
  }
}

/**
 * subject_type is authoritative after the identity migration. is_primary keeps
 * legacy rows readable during rollout and must not become a mutable role again.
 */
export function getChartSubjectType(chart: ChartIdentityRecord): ChartSubjectType {
  if (chart.subject_type === 'self' || chart.subject_type === 'saved_person') {
    return chart.subject_type;
  }
  return chart.is_primary === false ? 'saved_person' : 'self';
}

export function isSelfChart(chart: ChartIdentityRecord): boolean {
  return getChartSubjectType(chart) === 'self';
}

export function isActiveChart(chart: ChartIdentityRecord): boolean {
  return chart.archived_at == null;
}

export function getEffectiveChartLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_ACTIVE_CHART_LIMIT : FREE_ACTIVE_CHART_LIMIT;
}

export function getActiveCharts<T extends ChartIdentityRecord>(charts: T[]): T[] {
  return charts.filter(isActiveChart);
}

export function getSelfChart<T extends ChartIdentityRecord>(charts: T[]): T | null {
  return getActiveCharts(charts).find(isSelfChart) || null;
}

export function getAccessibleSavedPersonIds(
  charts: ChartIdentityRecord[],
  isPremium: boolean,
): Set<number> {
  const timestamp = (value: string | Date | null | undefined) => {
    const parsed = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  const saved = getActiveCharts(charts)
    .filter((chart) => !isSelfChart(chart) && Number.isFinite(chart.id))
    .sort((left, right) => timestamp(left.created_at) - timestamp(right.created_at)
      || Number(left.id) - Number(right.id));
  return new Set(saved
    .slice(0, isPremium ? PREMIUM_SAVED_PERSON_LIMIT : FREE_SAVED_PERSON_LIMIT)
    .map((chart) => Number(chart.id)));
}

export function assertCanCreateSavedPerson(
  charts: ChartIdentityRecord[],
  isPremium: boolean,
): void {
  const activeCharts = getActiveCharts(charts);
  if (!getSelfChart(activeCharts)) {
    throw new ChartAccessPolicyError(
      'SELF_CHART_REQUIRED',
      'Create your own natal chart before adding another person.',
      409,
    );
  }
  const limit = getEffectiveChartLimit(isPremium);
  if (activeCharts.length >= limit) {
    throw new ChartAccessPolicyError(
      'CHART_LIMIT_REACHED',
      `You can keep up to ${limit} active charts.`,
    );
  }
}

export function assertChartReadable(
  chart: ChartIdentityRecord,
  isPremium: boolean,
  charts: ChartIdentityRecord[] = [],
): void {
  if (!isActiveChart(chart)) {
    throw new ChartAccessPolicyError('CHART_ARCHIVED', 'Chart is archived.', 404);
  }
  if (!isSelfChart(chart) && !getAccessibleSavedPersonIds(charts, isPremium).has(Number(chart.id))) {
    throw new ChartAccessPolicyError(
      isPremium ? 'CHART_LIMIT_REACHED' : 'PREMIUM_REQUIRED',
      'This saved person exceeds the current chart access limit.',
    );
  }
}

export function assertChartCanBeArchived(chart: ChartIdentityRecord): void {
  if (isSelfChart(chart)) {
    throw new ChartAccessPolicyError(
      'SELF_CHART_IMMUTABLE',
      'Your own chart cannot be removed from saved people.',
      409,
    );
  }
  if (!isActiveChart(chart)) {
    throw new ChartAccessPolicyError('CHART_ARCHIVED', 'Chart is already archived.', 404);
  }
}

export function normalizeRelationLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 60) : null;
}

export function exposeChartAccess<T extends ChartIdentityRecord>(
  chart: T,
  isPremium: boolean,
  charts: ChartIdentityRecord[] = [],
): T & {
  subject_type: ChartSubjectType;
  relation_label: string | null;
  access_locked: boolean;
} {
  const subjectType = getChartSubjectType(chart);
  const accessLocked = subjectType === 'saved_person'
    && !getAccessibleSavedPersonIds(charts, isPremium).has(Number(chart.id));
  const exposed = {
    ...chart,
    subject_type: subjectType,
    relation_label: normalizeRelationLabel(chart.relation_label),
    access_locked: accessLocked,
  };

  // Premium expiry changes access, never persistence. Keep the saved person's
  // identity visible in the list, but do not leak the locked calculation in
  // the list response while the dedicated chart route correctly returns 403.
  if (accessLocked) {
    const redacted = exposed as Record<string, unknown>;
    for (const field of LOCKED_CALCULATION_FIELDS) delete redacted[field];
  }

  return exposed;
}
