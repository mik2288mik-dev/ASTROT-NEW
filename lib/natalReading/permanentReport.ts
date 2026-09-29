import type {
  NatalChartData,
  NatalInterpretationReport,
} from '../../types';
import type {
  NatalAngleKey,
  NatalChartDataV2,
} from '../natalChartV2Types';

/**
 * Legacy APK response contract + shared chart reliability helper.
 *
 * The old permanent-report generator, prompt, cache and report-plan engine were
 * removed in Stage 6. Current natal meaning generation lives exclusively under
 * lib/natalInterpretation + the unified writer.
 */
export const NATAL_PERMANENT_CONTRACT_VERSION = 'natal-permanent-v9';

export type NatalReadingLanguage = 'ru' | 'en';
export type NatalBirthTimeQuality = 'exact' | 'approximate' | 'unknown';

export type NatalReadingStatement = {
  text: string;
  evidenceIds: string[];
};

export type NatalPermanentFreeReport = NatalInterpretationReport & {
  schemaVersion: 'natal-permanent-free-v3';
  contractVersion: typeof NATAL_PERMANENT_CONTRACT_VERSION;
  tier: 'free';
  evidenceIds: string[];
  hook: NatalReadingStatement;
};

export type NatalPermanentPremiumSection = {
  id: string;
  title: string;
  paragraphs: NatalReadingStatement[];
};

export type NatalPermanentPremiumReport = {
  schemaVersion: 'natal-permanent-premium-v2';
  contractVersion: typeof NATAL_PERMANENT_CONTRACT_VERSION;
  tier: 'premium';
  headline: string;
  headlineEvidenceIds: string[];
  lead: NatalReadingStatement;
  sections: NatalPermanentPremiumSection[];
  strategies: Array<NatalReadingStatement & { title: string }>;
  pitfalls: NatalReadingStatement[];
  conclusion: NatalReadingStatement;
  evidenceIds: string[];
};

function validStatement(value: unknown): value is NatalReadingStatement {
  if (!value || typeof value !== 'object') return false;
  const statement = value as Partial<NatalReadingStatement>;
  return typeof statement.text === 'string'
    && statement.text.trim().length > 0
    && Array.isArray(statement.evidenceIds)
    && statement.evidenceIds.every((id) => typeof id === 'string');
}

export function isNatalPermanentFreeReport(value: unknown): value is NatalPermanentFreeReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<NatalPermanentFreeReport>;
  return report.schemaVersion === 'natal-permanent-free-v3'
    && report.contractVersion === NATAL_PERMANENT_CONTRACT_VERSION
    && report.tier === 'free'
    && validStatement(report.hook)
    && Array.isArray(report.evidenceIds)
    && Array.isArray(report.freeSections);
}

export function isNatalPermanentPremiumReport(value: unknown): value is NatalPermanentPremiumReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<NatalPermanentPremiumReport>;
  return report.schemaVersion === 'natal-permanent-premium-v2'
    && report.contractVersion === NATAL_PERMANENT_CONTRACT_VERSION
    && report.tier === 'premium'
    && validStatement(report.lead)
    && validStatement(report.conclusion)
    && Array.isArray(report.sections)
    && report.sections.every((section) => (
      !!section
      && typeof section.id === 'string'
      && typeof section.title === 'string'
      && Array.isArray(section.paragraphs)
      && section.paragraphs.every(validStatement)
    ))
    && Array.isArray(report.evidenceIds);
}

function isV2(chart: NatalChartData | NatalChartDataV2): chart is NatalChartDataV2 {
  return chart.schemaVersion === 'natal-chart-data-v2'
    && !!chart.positions
    && !!chart.chartQuality;
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function qualityOf(chart: NatalChartData | NatalChartDataV2): NatalBirthTimeQuality {
  const value = isV2(chart)
    ? chart.chartQuality.birthTimeQuality
    : chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality;
  return value === 'exact' || value === 'approximate' ? value : 'unknown';
}

/**
 * Presentation-only reliability policy shared by the wheel/map UI.
 * This does not interpret chart meaning and never invokes Swiss or a writer.
 */
export function getPermanentNatalReliability(chart: NatalChartData | NatalChartDataV2) {
  const quality = qualityOf(chart);
  const rawAngles = isV2(chart) ? chart.angles : { ascendant: chart.rising, mc: chart.mc };
  const chartQualityV2 = chart.chartQuality as unknown as {
    variableAngles?: unknown[];
    variableHouses?: unknown[];
    stableHousePlacements?: unknown[];
  } | undefined;
  const variableAngles = new Set(
    Array.isArray(chartQualityV2?.variableAngles)
      ? chartQualityV2.variableAngles.map(text).filter(Boolean)
      : [],
  );
  const anglesIncluded = quality !== 'unknown' && Object.entries(rawAngles || {}).some(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return false;
    const value = raw as unknown as Record<string, unknown>;
    if (quality === 'exact') return value.reliability !== 'variable_in_range';
    return value.reliability !== 'variable_in_range'
      && value.stableSign === true
      && !variableAngles.has(key);
  });
  const variableHouses = new Set(
    Array.isArray(chartQualityV2?.variableHouses)
      ? chartQualityV2.variableHouses.map(finite).filter((value): value is number => value != null)
      : [],
  );
  const hasReliableCusp = Array.isArray(chart.houses)
    && chart.houses.some((raw, index) => {
      const value = raw as unknown as Record<string, unknown>;
      const number = finite(value.house) || index + 1;
      if (quality === 'exact') return value.reliability !== 'variable_in_range';
      return value.reliability !== 'variable_in_range'
        && value.stableSign === true
        && !variableHouses.has(number);
    });
  const hasStablePlacement = quality === 'approximate'
    && Array.isArray(chartQualityV2?.stableHousePlacements)
    && chartQualityV2.stableHousePlacements.length > 0;
  const housesIncluded = quality !== 'unknown' && (hasReliableCusp || hasStablePlacement);

  return {
    quality,
    anglesIncluded,
    housesIncluded,
  } satisfies {
    quality: NatalBirthTimeQuality;
    anglesIncluded: boolean;
    housesIncluded: boolean;
  };
}

// Kept exported for type compatibility with older imports that only need the
// angle-key shape; no legacy interpretation engine remains in this module.
export type LegacyNatalReliableAngleKey = NatalAngleKey;
