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

function fieldReliability(
  exactTime: boolean,
  stable: boolean,
): Exclude<NatalReliability, 'variable_in_range'> | null {
  if (exactTime) return 'exact';
  return stable ? 'stable_in_range' : null;
}

export function extractNatalInterpretationEvidence(chart: NatalChartDataV2): {
  evidence: NatalInterpretationEvidence[];
  rejectedEvidence: RejectedNatalInterpretationEvidence[];
} {
  const evidence: NatalInterpretationEvidence[] = [];
  const rejectedEvidence: RejectedNatalInterpretationEvidence[] = [];
  const exactTime = chart.chartQuality.exactTime === true;
  const variableAspectIds = new Set(chart.chartQuality.variableAspectIds || []);

  for (const bodyKey of NATAL_BODY_KEYS) {
    const position = chart.positions[bodyKey];

    const signReliability = fieldReliability(exactTime, position.stable.sign === true);
    if (!position.sign) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reason: 'missing_value',
      });
    } else if (!signReliability) {
      rejectedEvidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reason: 'unstable_sign',
      });
    } else {
      evidence.push({
        id: `position:${bodyKey}:sign`,
        kind: 'body_sign',
        reliability: signReliability,
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
    } else {
      const houseReliability = fieldReliability(exactTime, position.stable.house === true);
      if (!houseReliability) {
        rejectedEvidence.push({
          id: `position:${bodyKey}:house`,
          kind: 'body_house',
          reason: 'unstable_house',
        });
      } else {
        evidence.push({
          id: `position:${bodyKey}:house`,
          kind: 'body_house',
          reliability: houseReliability,
          bodyKey,
          house: position.house,
        });
      }
    }

    if (typeof position.retrograde === 'boolean') {
      const retrogradeReliability = fieldReliability(
        exactTime,
        position.stable.retrograde === true,
      );
      if (!retrogradeReliability) {
        rejectedEvidence.push({
          id: `position:${bodyKey}:retrograde`,
          kind: 'body_retrograde',
          reason: 'unstable_retrograde',
        });
      } else {
        evidence.push({
          id: `position:${bodyKey}:retrograde`,
          kind: 'body_retrograde',
          reliability: retrogradeReliability,
          bodyKey,
          retrograde: position.retrograde,
        });
      }
    }
  }

  for (const angleKey of NATAL_ANGLE_KEYS) {
    const angle = chart.angles[angleKey];
    if (!angle) continue;
    const reliability = fieldReliability(exactTime, angle.stableSign === true);
    if (!angle.sign) {
      rejectedEvidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reason: 'missing_value',
      });
    } else if (!reliability) {
      rejectedEvidence.push({
        id: `angle:${angleKey}:sign`,
        kind: 'angle_sign',
        reason: 'unstable_sign',
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
    const id = `house:${house.house}:cusp`;
    const reliability = fieldReliability(exactTime, house.stableSign === true);
    if (!house.sign) {
      rejectedEvidence.push({ id, kind: 'house_cusp', reason: 'missing_value' });
    } else if (!reliability) {
      rejectedEvidence.push({ id, kind: 'house_cusp', reason: 'unstable_sign' });
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
      reliability: exactTime ? 'exact' : 'stable_in_range',
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
