import type { NatalChartData, PlanetPosition } from '../../types';
import type { NatalChartDataV2, NatalPositionV2, NatalReliability } from '../natalChartV2Types';

/** Real inter-chart aspects calculated from absolute longitudes in two natal charts. */

export const SYNASTRY_BODY_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

export type SynastryBodyKey = (typeof SYNASTRY_BODY_KEYS)[number];
export type SynastryAspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

const PLANET_RU: Record<SynastryBodyKey, string> = {
  sun: 'Солнце',
  moon: 'Луна',
  mercury: 'Меркурий',
  venus: 'Венера',
  mars: 'Марс',
  jupiter: 'Юпитер',
  saturn: 'Сатурн',
  uranus: 'Уран',
  neptune: 'Нептун',
  pluto: 'Плутон',
};

const ASPECTS: Array<{ key: SynastryAspectKey; name: string; angle: number; orb: number }> = [
  { key: 'conjunction', name: 'соединение', angle: 0, orb: 8 },
  { key: 'sextile', name: 'секстиль', angle: 60, orb: 5 },
  { key: 'square', name: 'квадрат', angle: 90, orb: 6 },
  { key: 'trine', name: 'трин', angle: 120, orb: 6 },
  { key: 'opposition', name: 'оппозиция', angle: 180, orb: 8 },
];

type ChartPosition = PlanetPosition | NatalPositionV2 | null | undefined;

function readPosition(chart: NatalChartData | NatalChartDataV2, key: SynastryBodyKey): ChartPosition {
  const v2 = chart as NatalChartDataV2;
  return v2.positions?.[key] || (chart as NatalChartData)[key];
}

function longitudeOf(position: ChartPosition): number | null {
  if (!position || typeof position.longitude !== 'number' || !Number.isFinite(position.longitude)) return null;
  if ('reliability' in position && position.reliability === 'variable_in_range') return null;
  return ((position.longitude % 360) + 360) % 360;
}

function reliabilityOf(position: ChartPosition): Exclude<NatalReliability, 'variable_in_range'> {
  if (position && 'reliability' in position && position.reliability === 'stable_in_range') {
    return 'stable_in_range';
  }
  return 'exact';
}

export type SynastryAspect = {
  a: string;
  b: string;
  aKey: SynastryBodyKey;
  bKey: SynastryBodyKey;
  aspect: string;
  aspectKey: SynastryAspectKey;
  angle: number;
  orb: number;
  maxOrb: number;
  strength: number;
  reliability: Exclude<NatalReliability, 'variable_in_range'>;
};

/** Inter-chart aspects sorted by effective strength. Unstable interval positions are excluded. */
export function computeSynastryAspects(
  subject: NatalChartData | NatalChartDataV2 | null,
  partner: NatalChartData | NatalChartDataV2 | null,
): SynastryAspect[] {
  if (!subject || !partner) return [];
  const output: SynastryAspect[] = [];

  for (const aKey of SYNASTRY_BODY_KEYS) {
    const aPosition = readPosition(subject, aKey);
    const aLongitude = longitudeOf(aPosition);
    if (aLongitude == null) continue;

    for (const bKey of SYNASTRY_BODY_KEYS) {
      const bPosition = readPosition(partner, bKey);
      const bLongitude = longitudeOf(bPosition);
      if (bLongitude == null) continue;

      let distance = Math.abs(aLongitude - bLongitude) % 360;
      if (distance > 180) distance = 360 - distance;

      for (const definition of ASPECTS) {
        const orb = Math.abs(distance - definition.angle);
        if (orb > definition.orb) continue;
        const reliability = reliabilityOf(aPosition) === 'stable_in_range'
          || reliabilityOf(bPosition) === 'stable_in_range'
          ? 'stable_in_range'
          : 'exact';
        const strength = Math.max(0, 1 - orb / definition.orb);
        output.push({
          a: PLANET_RU[aKey],
          b: PLANET_RU[bKey],
          aKey,
          bKey,
          aspect: definition.name,
          aspectKey: definition.key,
          angle: Number(distance.toFixed(2)),
          orb: Number(orb.toFixed(2)),
          maxOrb: definition.orb,
          strength: Number(strength.toFixed(4)),
          reliability,
        });
        break;
      }
    }
  }

  return output
    .sort((first, second) => second.strength - first.strength || first.orb - second.orb)
    .slice(0, 48);
}
