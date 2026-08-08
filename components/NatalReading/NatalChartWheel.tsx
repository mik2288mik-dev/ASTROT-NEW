import React from 'react';
import { getZodiacSign } from '../../constants';
import type { NatalChartData } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import { PlanetIcon, type PlanetKey } from '../icons/PlanetIcon';
import { ZodiacIcon } from '../icons/ZodiacIcon';

type Language = 'ru' | 'en';
type ChartSource = NatalChartData | NatalChartDataV2;

type WheelPoint = {
  key: string;
  name: string;
  sign: string;
  degree: number;
  longitude: number;
  icon: PlanetKey;
};

type WheelAspect = {
  id: string;
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  fromLongitude: number;
  toLongitude: number;
};

const BODY_KEYS = [
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

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const PLANET_ICONS: Record<(typeof BODY_KEYS)[number], PlanetKey> = {
  sun: 'sun',
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
  pluto: 'pluto',
  chiron: 'chiron',
  northNode: 'north-node',
  southNode: 'south-node',
};

const PLANET_NAMES: Record<(typeof BODY_KEYS)[number] | 'ascendant' | 'mc', Record<Language, string>> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  northNode: { ru: 'Северный узел', en: 'North Node' },
  southNode: { ru: 'Южный узел', en: 'South Node' },
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
};

const ASPECT_TYPES = new Set<WheelAspect['type']>([
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

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function pointOnWheel(longitude: number, radius: number) {
  const radians = ((normalizeLongitude(longitude) - 90) * Math.PI) / 180;
  return {
    x: 180 + Math.cos(radians) * radius,
    y: 180 + Math.sin(radians) * radius,
  };
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

function positionRecord(chart: ChartSource, key: (typeof BODY_KEYS)[number]): Record<string, unknown> | null {
  const rawChart = chart as unknown as Record<string, unknown>;
  const positions = objectRecord(rawChart.positions);
  return objectRecord(positions?.[key] ?? rawChart[key]);
}

function collectBodies(chart: ChartSource): WheelPoint[] {
  return BODY_KEYS.flatMap((key) => {
    const position = positionRecord(chart, key);
    if (!position) return [];
    const longitude = finite(position.longitude);
    if (longitude == null) return [];
    const degree = finite(position.degree);
    const sign = String(position.sign || '').trim();
    return [{
      key,
      name: String(position.object || position.planet || key),
      sign,
      degree: degree == null ? normalizeLongitude(longitude) % 30 : degree,
      longitude: normalizeLongitude(longitude),
      icon: PLANET_ICONS[key],
    }];
  });
}

function angleAllowed(chart: ChartSource, key: 'ascendant' | 'mc'): boolean {
  const reliability = getPermanentNatalReliability(chart);
  if (!reliability.anglesIncluded || reliability.quality === 'unknown') return false;

  const rawChart = chart as unknown as Record<string, unknown>;
  const angles = objectRecord(rawChart.angles);
  const angle = objectRecord(angles?.[key] ?? (key === 'ascendant' ? rawChart.rising : rawChart.mc));
  if (!angle || finite(angle.longitude) == null) return false;
  if (angle.reliability === 'variable_in_range') return false;
  if (reliability.quality === 'exact') return true;

  const quality = objectRecord(rawChart.chartQuality);
  const variableAngles = Array.isArray(quality?.variableAngles)
    ? quality.variableAngles.map(canonicalKey)
    : [];
  return angle.stableSign === true && !variableAngles.includes(key);
}

function collectAngles(chart: ChartSource): WheelPoint[] {
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
      degree: finite(angle.degree) ?? normalizeLongitude(longitude) % 30,
      longitude: normalizeLongitude(longitude),
      icon: key === 'ascendant' ? 'asc' : 'mc',
    }];
  });
}

function aliasesForPoint(point: WheelPoint): string[] {
  const aliases = [point.key, point.name];
  if (point.key === 'northNode') aliases.push('north node', 'true node');
  if (point.key === 'southNode') aliases.push('south node');
  if (point.key === 'ascendant') aliases.push('asc', 'rising');
  if (point.key === 'mc') aliases.push('midheaven');
  return aliases.map(canonicalKey);
}

function collectAspects(chart: ChartSource, points: WheelPoint[]): WheelAspect[] {
  const longitudeByAlias = new Map<string, number>();
  points.forEach((point) => {
    aliasesForPoint(point).forEach((alias) => longitudeByAlias.set(alias, point.longitude));
  });

  const aspects = Array.isArray(chart.aspects) ? chart.aspects : [];
  return aspects.flatMap((raw, index) => {
    const aspect = raw as unknown as Record<string, unknown>;
    const type = String(aspect.type || '').toLocaleLowerCase('en-US') as WheelAspect['type'];
    if (!ASPECT_TYPES.has(type) || aspect.reliable === false) return [];
    const fromKey = canonicalKey(aspect.fromKey ?? aspect.from);
    const toKey = canonicalKey(aspect.toKey ?? aspect.to);
    const fromLongitude = longitudeByAlias.get(fromKey);
    const toLongitude = longitudeByAlias.get(toKey);
    if (fromLongitude == null || toLongitude == null) return [];
    return [{
      id: String(aspect.id || `${fromKey}-${type}-${toKey}-${index}`),
      type,
      fromLongitude,
      toLongitude,
    }];
  });
}

function bodyLane(points: WheelPoint[], index: number): number {
  const current = points[index];
  const nearBefore = points
    .slice(0, index)
    .filter((candidate) => {
      const distance = Math.abs(candidate.longitude - current.longitude);
      return Math.min(distance, 360 - distance) < 13;
    })
    .length;
  return nearBefore % 3;
}

export function NatalChartWheel({ chart, language }: { chart: ChartSource; language: Language }) {
  const bodies = collectBodies(chart);
  const angles = collectAngles(chart);
  const allPoints = [...bodies, ...angles];
  const aspects = collectAspects(chart, allPoints);
  const title = language === 'ru' ? 'Круг натальной карты' : 'Natal chart wheel';
  const caption = language === 'ru'
    ? 'Положения рассчитанных объектов и основные аспекты карты. Линии соединяют только аспекты из расчёта.'
    : 'Calculated placements and major chart aspects. Lines connect only aspects present in the calculation.';

  return (
    <figure className="natal-chart-wheel" aria-labelledby="natal-chart-wheel-caption">
      <svg
        className="natal-chart-wheel-svg"
        viewBox="0 0 360 360"
        role="img"
        aria-labelledby="natal-chart-wheel-title natal-chart-wheel-description"
      >
        <title id="natal-chart-wheel-title">{title}</title>
        <desc id="natal-chart-wheel-description">{caption}</desc>

        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--outer" cx="180" cy="180" r="166" />
        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--signs" cx="180" cy="180" r="137" />
        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--aspects" cx="180" cy="180" r="66" />

        {SIGNS.map((sign, index) => {
          const divider = pointOnWheel(index * 30, 166);
          const dividerInner = pointOnWheel(index * 30, 137);
          const glyph = pointOnWheel(index * 30 + 15, 151.5);
          return (
            <g key={sign} className="natal-chart-wheel-sign" aria-hidden="true">
              <line x1={dividerInner.x} y1={dividerInner.y} x2={divider.x} y2={divider.y} />
              <g transform={`translate(${glyph.x - 10} ${glyph.y - 10})`}>
                <ZodiacIcon sign={sign} size={20} strokeWidth={1.25} />
              </g>
            </g>
          );
        })}

        <g className="natal-chart-wheel-aspects" aria-hidden="true">
          {aspects.map((aspect) => {
            const from = pointOnWheel(aspect.fromLongitude, 66);
            const to = pointOnWheel(aspect.toLongitude, 66);
            return (
              <line
                key={aspect.id}
                className={`natal-chart-wheel-aspect natal-chart-wheel-aspect--${aspect.type}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            );
          })}
        </g>

        {bodies.map((body, index) => {
          const radius = [116, 96, 77][bodyLane(bodies, index)];
          const marker = pointOnWheel(body.longitude, radius);
          return (
            <g
              key={body.key}
              className="natal-chart-wheel-marker"
              transform={`translate(${marker.x} ${marker.y})`}
              aria-hidden="true"
            >
              <circle r="12" />
              <g transform="translate(-8 -10)">
                <PlanetIcon planet={body.icon} size={16} strokeWidth={1.45} />
              </g>
              <text x="0" y="9" textAnchor="middle">{Math.round(body.degree)}°</text>
            </g>
          );
        })}

        {angles.map((angle) => {
          const marker = pointOnWheel(angle.longitude, 126);
          return (
            <g
              key={angle.key}
              className="natal-chart-wheel-angle"
              transform={`translate(${marker.x} ${marker.y})`}
              aria-hidden="true"
            >
              <circle r="10" />
              <g transform="translate(-8 -8)">
                <PlanetIcon planet={angle.icon} size={16} strokeWidth={1.55} />
              </g>
            </g>
          );
        })}
      </svg>

      <figcaption id="natal-chart-wheel-caption" className="natal-chart-wheel-caption">
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>

      <ul className="natal-chart-wheel-a11y">
        {allPoints.map((point) => (
          <li key={point.key}>
            {PLANET_NAMES[point.key as keyof typeof PLANET_NAMES]?.[language] || point.name}: {' '}
            {getZodiacSign(language, point.sign)} {point.degree.toFixed(1)}°
          </li>
        ))}
      </ul>
    </figure>
  );
}
