import type { NatalChartData, PlanetPosition } from '../../types';
import type { NatalChartDataV2, NatalPositionV2 } from '../natalChartV2Types';

/**
 * Реальные межкартовые (синастрические) аспекты: какие планеты двух карт стоят в
 * значимом угле друг к другу. Это то, что делает разбор «по двум картам» настоящим,
 * а не пересказом совместимости знаков. Считается из абсолютных долгот планет.
 */

const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;

const PLANET_RU: Record<string, string> = {
  sun: 'Солнце', moon: 'Луна', mercury: 'Меркурий', venus: 'Венера',
  mars: 'Марс', jupiter: 'Юпитер', saturn: 'Сатурн',
};

const ASPECTS: Array<{ name: string; angle: number; orb: number }> = [
  { name: 'соединение', angle: 0, orb: 8 },
  { name: 'секстиль', angle: 60, orb: 5 },
  { name: 'квадрат', angle: 90, orb: 6 },
  { name: 'трин', angle: 120, orb: 6 },
  { name: 'оппозиция', angle: 180, orb: 8 },
];

function longitudeOf(p: PlanetPosition | NatalPositionV2 | null | undefined): number | null {
  if (!p || typeof p.longitude !== 'number' || !Number.isFinite(p.longitude)) return null;
  return ((p.longitude % 360) + 360) % 360;
}

export type SynastryAspect = { a: string; b: string; aspect: string; orb: number };

/** Межкартовые аспекты двух карт, отсортированные от самых точных (до 12 шт.). */
export function computeSynastryAspects(
  a: NatalChartData | NatalChartDataV2 | null,
  b: NatalChartData | NatalChartDataV2 | null,
): SynastryAspect[] {
  if (!a || !b) return [];
  const out: SynastryAspect[] = [];
  for (const pa of PLANETS) {
    const la = longitudeOf(a[pa]);
    if (la == null) continue;
    for (const pb of PLANETS) {
      const lb = longitudeOf(b[pb]);
      if (lb == null) continue;
      let diff = Math.abs(la - lb) % 360;
      if (diff > 180) diff = 360 - diff;
      for (const asp of ASPECTS) {
        const delta = Math.abs(diff - asp.angle);
        if (delta <= asp.orb) {
          out.push({
            a: PLANET_RU[pa] || pa,
            b: PLANET_RU[pb] || pb,
            aspect: asp.name,
            orb: Number(delta.toFixed(1)),
          });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb).slice(0, 12);
}
