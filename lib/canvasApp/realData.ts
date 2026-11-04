import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { formatDisplayDate } from '../date-utils';
import { isCanonicalNatalChart } from '../natalCalculationProof';
import { buildBigThree, buildChartMoments, SIGN_NOMINATIVE_RU } from '../natalMoments';

/** The account's own data in the shape the canvas keeps for «me». */
export type CanvasRealData = {
  account: 'free' | 'plus';
  me: Record<string, unknown>;
};

const BODIES: ReadonlyArray<[string, string]> = [
  ['sun', 'Солнце'], ['moon', 'Луна'], ['mercury', 'Меркурий'], ['venus', 'Венера'], ['mars', 'Марс'],
  ['jupiter', 'Юпитер'], ['saturn', 'Сатурн'], ['uranus', 'Уран'], ['neptune', 'Нептун'], ['pluto', 'Плутон'],
];

function degreeLabel(value: number): string {
  const inSign = ((value % 30) + 30) % 30;
  const whole = Math.floor(inSign);
  return `${whole}°${String(Math.floor((inSign - whole) * 60)).padStart(2, '0')}′`;
}

const signRu = (sign: string): string => SIGN_NOMINATIVE_RU[sign] ?? sign;

function chartFields(chart: NatalChartDataV2): Record<string, unknown> {
  const nat = BODIES.flatMap(([key, label]) => {
    const position = chart.positions[key as keyof typeof chart.positions];
    if (!position) return [];
    return [[key, position.longitude, label, signRu(position.sign), degreeLabel(position.degree), position.house ? `${position.house} дом` : '']];
  });
  const ascendant = chart.angles.ascendant;
  const houses = [...(chart.houses ?? [])].sort((a, b) => a.house - b.house).map((house) => house.longitude);
  const sun = chart.positions.sun;
  // Without a birth time there are no real houses: the wheel starts from the Sun's sign.
  const start = ascendant?.longitude ?? (sun ? Math.floor(sun.longitude / 30) * 30 : 0);
  const cusps = houses.length === 12 ? houses : Array.from({ length: 12 }, (_, index) => (start + index * 30) % 360);
  const tiles = buildBigThree(chart);
  const big3 = ['sun', 'moon', 'ascendant'].map((key) => {
    const tile = tiles.find((item) => item.key === key);
    if (!tile) return ['', ''];
    const house = key === 'ascendant' ? null : chart.positions[key as 'sun' | 'moon']?.house;
    const detail = key === 'ascendant' ? (ascendant ? degreeLabel(ascendant.degree) : '') : house ? `${house} дом` : '';
    return [tile.signLabel, detail];
  });
  return {
    nat,
    cusps,
    asc: start,
    ascIdx: Math.floor(start / 30) % 12,
    big3,
    highlights: buildChartMoments(chart).slice(0, 3).map((moment) => [moment.headline, moment.body]),
  };
}

export function buildCanvasRealData(profile: UserProfile, chart: NatalChartData | null): CanvasRealData {
  const canonical = chart && isCanonicalNatalChart(chart) ? (chart as unknown as NatalChartDataV2) : null;
  const name = profile.name?.trim() || 'Ты';
  const birth = [
    profile.birthDate ? formatDisplayDate(profile.birthDate, 'ru').replace(/(\d{4}) г\./, '$1') : '',
    profile.birthTime,
    profile.birthPlace,
  ].filter(Boolean).join(' · ');
  const sunSign = canonical?.positions.sun ? signRu(canonical.positions.sun.sign) : '';
  return {
    account: profile.isPremium ? 'plus' : 'free',
    me: {
      name,
      sex: profile.gender === 'female' ? 'f' : 'm',
      sub: birth,
      over: [name, sunSign].filter(Boolean).join(' · '),
      ...(canonical ? chartFields(canonical) : {}),
    },
  };
}
