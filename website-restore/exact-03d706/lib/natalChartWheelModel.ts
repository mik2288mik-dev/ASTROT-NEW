import type { NatalChartData } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { getPermanentNatalReliability } from './natalReading/permanentReport';

export type NatalChartWheelSource = NatalChartData | NatalChartDataV2;

export type NatalChartWheelPoint = {
  key: string;
  name: string;
  sign: string;
  degree: number;
  longitude: number;
};

export type NatalChartWheelAspect = {
  id: string;
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  fromKey: string;
  toKey: string;
  fromLongitude: number;
  toLongitude: number;
};

export type NatalChartWheelHouse = {
  house: number;
  longitude: number;
};

export const NATAL_CHART_WHEEL_BODY_KEYS = [
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
  'chiron',
  'northNode',
  'southNode',
] as const;

const ASPECT_TYPES = new Set<NatalChartWheelAspect['type']>([
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
]);

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeNatalWheelLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function canonicalKey(value: unknown): string {
  const compact = String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '');
  const aliases: Record<string, string> = {
    asc: 'ascendant',
    rising: 'ascendant',
    midheaven: 'mc',
    northnode: 'northnode',
    truenode: 'northnode',
    southnode: 'southnode',
  };
  return aliases[compact] || compact;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function positionRecord(
  chart: NatalChartWheelSource,
  key: (typeof NATAL_CHART_WHEEL_BODY_KEYS)[number],
): Record<string, unknown> | null {
  const rawChart = chart as unknown as Record<string, unknown>;
  const positions = objectRecord(rawChart.positions);
  return objectRecord(positions?.[key] ?? rawChart[key]);
}

function reliableWheelCoordinate(
  chart: NatalChartWheelSource,
  value: Record<string, unknown>,
): boolean {
  const rawChart = chart as unknown as Record<string, unknown>;
  if (rawChart.schemaVersion === 'natal-chart-data-v2') return value.reliability !== 'variable_in_range';
  return getPermanentNatalReliability(chart).quality === 'exact'
    && value.reliability !== 'variable_in_range';
}

function collectBodies(chart: NatalChartWheelSource): NatalChartWheelPoint[] {
  return NATAL_CHART_WHEEL_BODY_KEYS.flatMap((key) => {
    const position = positionRecord(chart, key);
    if (!position || !reliableWheelCoordinate(chart, position)) return [];
    const longitude = finite(position.longitude);
    if (longitude == null) return [];
    const degree = finite(position.degree);
    return [{
      key,
      name: String(position.object || position.planet || key),
      sign: String(position.sign || '').trim(),
      degree: degree == null ? normalizeNatalWheelLongitude(longitude) % 30 : degree,
      longitude: normalizeNatalWheelLongitude(longitude),
    }];
  });
}

function angleAllowed(chart: NatalChartWheelSource, key: 'ascendant' | 'mc'): boolean {
  const reliability = getPermanentNatalReliability(chart);
  if (!reliability.anglesIncluded) return false;
  const rawChart = chart as unknown as Record<string, unknown>;
  const angles = objectRecord(rawChart.angles);
  const quality = objectRecord(rawChart.chartQuality);
  const variableAngles = new Set(
    Array.isArray(quality?.variableAngles)
      ? quality.variableAngles.map((value) => canonicalKey(value))
      : [],
  );
  const angle = objectRecord(angles?.[key] ?? (key === 'ascendant' ? rawChart.rising : rawChart.mc));
  return !!angle
    && finite(angle.longitude) != null
    && reliableWheelCoordinate(chart, angle)
    && (reliability.quality === 'exact'
      || (angle.stableSign === true && !variableAngles.has(canonicalKey(key))));
}

function collectAngles(chart: NatalChartWheelSource): NatalChartWheelPoint[] {
  const rawChart = chart as unknown as Record<string, unknown>;
  const angles = objectRecord(rawChart.angles);
  return (['ascendant', 'mc'] as const).flatMap((key) => {
    if (!angleAllowed(chart, key)) return [];
    const angle = objectRecord(angles?.[key] ?? (key === 'ascendant' ? rawChart.rising : rawChart.mc));
    if (!angle) return [];
    const longitude = finite(angle.longitude);
    if (longitude == null) return [];
    return [{
      key,
      name: String(angle.object || angle.planet || key),
      sign: String(angle.sign || '').trim(),
      degree: finite(angle.degree) ?? normalizeNatalWheelLongitude(longitude) % 30,
      longitude: normalizeNatalWheelLongitude(longitude),
    }];
  });
}

function collectHouses(chart: NatalChartWheelSource): NatalChartWheelHouse[] {
  const reliability = getPermanentNatalReliability(chart);
  if (!reliability.housesIncluded || !Array.isArray(chart.houses)) return [];
  const rawChart = chart as unknown as Record<string, unknown>;
  const quality = objectRecord(rawChart.chartQuality);
  const variableHouses = new Set(
    Array.isArray(quality?.variableHouses)
      ? quality.variableHouses.map(finite).filter((value): value is number => value != null)
      : [],
  );
  return chart.houses.flatMap((raw, index) => {
    const house = raw as unknown as Record<string, unknown>;
    const number = finite(house.house) ?? index + 1;
    const longitude = finite(house.longitude);
    const reliable = reliableWheelCoordinate(chart, house)
      && !variableHouses.has(number)
      && (reliability.quality === 'exact' || house.stableSign === true);
    return longitude == null || !reliable
      ? []
      : [{ house: number, longitude: normalizeNatalWheelLongitude(longitude) }];
  }).sort((left, right) => left.house - right.house);
}

function aliasesForPoint(point: NatalChartWheelPoint): string[] {
  const aliases = [point.key, point.name];
  if (point.key === 'northNode') aliases.push('north node', 'true node');
  if (point.key === 'southNode') aliases.push('south node');
  if (point.key === 'ascendant') aliases.push('asc', 'rising');
  if (point.key === 'mc') aliases.push('midheaven');
  return aliases.map(canonicalKey);
}

function collectAspects(
  chart: NatalChartWheelSource,
  points: NatalChartWheelPoint[],
): NatalChartWheelAspect[] {
  const longitudeByAlias = new Map<string, number>();
  points.forEach((point) => {
    aliasesForPoint(point).forEach((alias) => longitudeByAlias.set(alias, point.longitude));
    if (point.key === 'ascendant') {
      longitudeByAlias.set('descendant', normalizeNatalWheelLongitude(point.longitude + 180));
      longitudeByAlias.set('dsc', normalizeNatalWheelLongitude(point.longitude + 180));
    }
    if (point.key === 'mc') {
      longitudeByAlias.set('ic', normalizeNatalWheelLongitude(point.longitude + 180));
      longitudeByAlias.set('imumcoeli', normalizeNatalWheelLongitude(point.longitude + 180));
    }
  });
  const aspects = Array.isArray(chart.aspects) ? chart.aspects : [];
  return aspects.flatMap((raw, index) => {
    const aspect = raw as unknown as Record<string, unknown>;
    const type = String(aspect.type || '').toLocaleLowerCase('en-US') as NatalChartWheelAspect['type'];
    if (!ASPECT_TYPES.has(type) || aspect.reliable === false) return [];
    const fromKey = canonicalKey(aspect.fromKey ?? aspect.from);
    const toKey = canonicalKey(aspect.toKey ?? aspect.to);
    const fromLongitude = longitudeByAlias.get(fromKey);
    const toLongitude = longitudeByAlias.get(toKey);
    if (fromLongitude == null || toLongitude == null) return [];
    return [{
      id: String(aspect.id || `${fromKey}-${type}-${toKey}-${index}`),
      type,
      fromKey,
      toKey,
      fromLongitude,
      toLongitude,
    }];
  });
}

export function buildNatalChartWheelModel(chart: NatalChartWheelSource) {
  const bodies = collectBodies(chart);
  const angles = collectAngles(chart);
  const houses = collectHouses(chart);
  const allPoints = [...bodies, ...angles];
  return { bodies, angles, houses, allPoints, aspects: collectAspects(chart, allPoints) };
}

export function getNatalChartWheelCaption(
  quality: 'exact' | 'approximate' | 'unknown',
  language: 'ru' | 'en',
  omittedBodyCount: number,
): string {
  if (quality === 'exact') {
    return language === 'ru'
      ? `Точные положения рассчитанных объектов и аспекты из карты.${omittedBodyCount > 0 ? ' Координаты с недостаточной точностью не показаны.' : ''}`
      : `Exact calculated placements and chart aspects.${omittedBodyCount > 0 ? ' Coordinates without sufficient precision are omitted.' : ''}`;
  }
  return language === 'ru'
    ? `Показаны положения и аспекты, устойчивые для указанной точности времени.${omittedBodyCount > 0 ? ' Меняющиеся координаты не показаны.' : ''}`
    : `Placements and aspects stable for the stated time accuracy are shown.${omittedBodyCount > 0 ? ' Variable coordinates are omitted.' : ''}`;
}

export function natalChartWheelBodyLane(points: NatalChartWheelPoint[], index: number): number {
  const current = points[index];
  const nearBefore = points.slice(0, index).filter((candidate) => {
    const distance = Math.abs(candidate.longitude - current.longitude);
    return Math.min(distance, 360 - distance) < 13;
  }).length;
  return nearBefore % 3;
}

export function natalChartWheelHouseLabelLongitude(
  house: NatalChartWheelHouse,
  houses: NatalChartWheelHouse[],
): number {
  const nextHouseNumber = house.house === 12 ? 1 : house.house + 1;
  const next = houses.find((candidate) => candidate.house === nextHouseNumber);
  if (!next) return normalizeNatalWheelLongitude(house.longitude + 15);
  const forward = normalizeNatalWheelLongitude(next.longitude - house.longitude);
  return normalizeNatalWheelLongitude(house.longitude + forward / 2);
}
