import type {
  NatalAngleKey,
  NatalBodyKey,
  NatalChartDataV2,
  NatalReliability,
} from '../natalChartV2Types';
import type {
  NatalInterpretationEvidence,
  RejectedNatalInterpretationEvidence,
} from './types';

export const NATAL_BODY_KEYS: readonly NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode',
];

export const NATAL_ANGLE_KEYS: readonly NatalAngleKey[] = [
  'ascendant', 'mc', 'descendant', 'ic',
];

function acceptedReliability(
  value: NatalReliability,
): Exclude<NatalReliability, 'variable_in_range'> | null {
  return value === 'exact' || value === 'stable_in_range' ? value : null;
}

export function extractNatalInterpretationEvidence(chart: NatalChartDataV2): {
  evidence: NatalInterpretationEvidence[];
  rejectedEvidence: RejectedNatalInterpretationEvidence[];
} {
  const evidence: NatalInterpretationEvidence[] = [];
  const rejectedEvidence: RejectedNatalInterpretationEvidence[] = [];
  const variableAspectIds = new Set(chart.chartQuality.variableAspectIds || []);

  for (const bodyKey of NATAL_BODY_KEYS) {
    const position = chart.positions[bodyKey];
    const reliability = acceptedReliability(position.reliability);

    if (!reliability) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reason: 'variable_in_range',
      });
    } else if (position.reliability !== 'exact' && position.stable.sign !== true) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reason: 'unstable_sign',
      });
    } else if (!position.sign) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reason: 'missing_value',
      });
    } else {
      evidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reliability,
        bodyKey,
        sign: position.sign,
        degree: Number.isFinite(position.degree) ? position.degree : undefined,
      });
    }

    if (position.house == null) {
      if (chart.chartQuality.birthTimeQuality !== 'unknown') {
        rejectedEvidence.push({
          id: `position:${bodyKey}:house`,
          kind: 'body_house',
          reason: 'missing_value',
        });
      }
    } else if (!reliability) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:house`,
        kind: 'body_house',
        reason: 'variable_in_range',
      });
    } else if (position.reliability !== 'exact' && position.stable.house !== true) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:house`,
        kind: 'body_house',
        reason: 'unstable_house',
      });
    } else {
      evidence.push({
        id: `position:${bodyKey}:house`,
        kind: 'body_house',
        reliability,
        bodyKey,
        house: position.house,
      });
    }

    if (typeof position.retrograde === 'boolean') {
      if (!reliability) {
        rejectedEvidence.push({
          id: `position:${bodyKey}:retrograde`,
          kind: 'body_retrograde',
          reason: 'variable_in_range',
        });
      } else if (position.reliability !== 'exact' && position.stable.retrograde !== true) {
        rejectedEvidence.push({
          id: `position:${bodyKey}:retrograde`,
          kind: 'body_retrograde',
          reason: 'unstable_retrograde',
        });
      } else {
        evidence.push({
          id: `position:${bodyKey}:retrograde`,
          kind: 'body_retrograde',
          reliability,
          bodyKey,
          retrograde: position.retrograde,
        });
      }
    }
  }

  for (const angleKey of NATAL_ANGLE_KEYS) {
    const angle = chart.angles[angleKey];
    if (!angle) continue;
    const reliability = acceptedReliability(angle.reliability);
    if (!reliability) {
      rejectedEvidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reason: 'variable_in_range',
      });
    } else if (angle.reliability !== 'exact' && angle.stableSign !== true) {
      rejectedEvidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reason: 'unstable_sign',
      });
    } else if (!angle.sign) {
      rejectedEvidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reason: 'missing_value',
      });
    } else {
      evidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reliability,
        angleKey,
        sign: angle.sign,
        degree: Number.isFinite(angle.degree) ? angle.degree : undefined,
      });
    }
  }

  for (const house of chart.houses || []) {
    const reliability = acceptedReliability(house.reliability);
    const id = `house:${house.house}:cusp`;
    if (!reliability) {
      rejectedEvidence.push({ id, kind: 'house_cusp', reason: 'variable_in_range' });
    } else if (house.reliability !== 'exact' && house.stableSign !== true) {
      rejectedEvidence.push({ id, kind: 'house_cusp', reason: 'unstable_sign' });
    } else if (!house.sign) {
      rejectedEvidence.push({ id, kind: 'house_cusp', reason: 'missing_value' });
    } else {
      evidence.push({
        id,
        kind: 'house_cusp',
        reliability,
        house: house.house,
        sign: house.sign,
        degree: Number.isFinite(house.degree) ? house.degree : undefined,
      });
    }
  }

  for (const aspect of chart.aspects || []) {
    const id = `aspect:${aspect.id}`;
    if (aspect.reliable === false || variableAspectIds.has(aspect.id)) {
      rejectedEvidence.push({ id, kind: 'aspect', reason: 'unreliable_aspect' });
      continue;
    }
    evidence.push({
      id,
      kind: 'aspect',
      reliability: chart.chartQuality.birthTimeQuality === 'exact'
        ? 'exact'
        : 'stable_in_range',
      aspectId: aspect.id,
      aspectType: aspect.type,
      fromKey: aspect.fromKey,
      toKey: aspect.toKey,
      orb: aspect.orb,
      phase: aspect.phase,
      sampleCoverage: aspect.sampleCoverage,
    });
  }

  return { evidence, rejectedEvidence };
}
