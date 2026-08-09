import React from 'react';
import { getZodiacSign } from '../../constants';
import type { NatalChartData } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import { PlanetIcon, type PlanetKey } from '../icons/PlanetIcon';

type Language = 'ru' | 'en';
type ChartSource = NatalChartData | NatalChartDataV2;

type PortraitPoint = {
  key: string;
  name: string;
  sign: string;
  degree: number;
  longitude: number;
  retrograde: boolean;
  icon: PlanetKey;
  x: number;
  y: number;
};

type PortraitAspect = {
  id: string;
  type: string;
  phase: string;
  orb: number;
  from: PortraitPoint;
  to: PortraitPoint;
};

const BODY_KEYS = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode',
] as const;

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

const PLANET_ICONS: Record<(typeof BODY_KEYS)[number], PlanetKey> = {
  sun: 'sun', moon: 'moon', mercury: 'mercury', venus: 'venus', mars: 'mars',
  jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune',
  pluto: 'pluto', chiron: 'chiron', northNode: 'north-node', southNode: 'south-node',
};

const PLANET_NAMES: Record<string, Record<Language, string>> = {
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

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function canonicalKey(value: unknown): string {
  const key = String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '');
  return {
    asc: 'ascendant', rising: 'ascendant', midheaven: 'mc',
    northnode: 'northnode', truenode: 'northnode', southnode: 'southnode',
  }[key] || key;
}

function layoutPoint(key: string, sign: string, degree: number) {
  const signIndex = Math.max(0, SIGNS.indexOf(sign as typeof SIGNS[number]));
  const column = signIndex % 4;
  const row = Math.floor(signIndex / 4);
  const keyOffset = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    x: 18 + column * 65 + 12 + (Math.max(0, Math.min(30, degree)) / 30) * 40,
    y: 34 + row * 64 + ((keyOffset % 7) - 3) * 3,
  };
}

function positionRecord(chart: ChartSource, key: (typeof BODY_KEYS)[number]) {
  const source = chart as unknown as Record<string, unknown>;
  const positions = objectRecord(source.positions);
  return objectRecord(positions?.[key] ?? source[key]);
}

function collectBodies(chart: ChartSource): PortraitPoint[] {
  return BODY_KEYS.flatMap((key) => {
    const position = positionRecord(chart, key);
    if (!position) return [];
    const longitude = finite(position.longitude);
    const sign = String(position.sign || '').trim();
    if (longitude == null || !sign) return [];
    const degree = finite(position.degree) ?? normalizeLongitude(longitude) % 30;
    return [{
      key,
      name: String(position.object || position.planet || key),
      sign,
      degree,
      longitude: normalizeLongitude(longitude),
      retrograde: position.retrograde === true,
      icon: PLANET_ICONS[key],
      ...layoutPoint(key, sign, degree),
    }];
  });
}

function collectAngles(chart: ChartSource): PortraitPoint[] {
  const reliability = getPermanentNatalReliability(chart);
  if (!reliability.anglesIncluded || reliability.quality === 'unknown') return [];
  const source = chart as unknown as Record<string, unknown>;
  const angles = objectRecord(source.angles);
  const variableAngles = new Set(
    Array.isArray(objectRecord(source.chartQuality)?.variableAngles)
      ? (objectRecord(source.chartQuality)?.variableAngles as unknown[]).map(canonicalKey)
      : [],
  );
  return (['ascendant', 'mc'] as const).flatMap((key) => {
    const angle = objectRecord(angles?.[key] ?? (key === 'ascendant' ? source.rising : source.mc));
    const longitude = finite(angle?.longitude);
    const sign = String(angle?.sign || '').trim();
    const stable = reliability.quality === 'exact'
      || (angle?.stableSign === true && !variableAngles.has(key));
    if (!angle || longitude == null || !sign || angle.reliability === 'variable_in_range' || !stable) return [];
    const degree = finite(angle.degree) ?? normalizeLongitude(longitude) % 30;
    return [{
      key,
      name: String(angle.object || angle.planet || key),
      sign,
      degree,
      longitude: normalizeLongitude(longitude),
      retrograde: false,
      icon: key === 'ascendant' ? 'asc' : 'mc',
      ...layoutPoint(key, sign, degree),
    }];
  });
}

function aliases(point: PortraitPoint): string[] {
  const values = [point.key, point.name];
  if (point.key === 'northNode') values.push('north node', 'true node');
  if (point.key === 'southNode') values.push('south node');
  if (point.key === 'ascendant') values.push('asc', 'rising');
  if (point.key === 'mc') values.push('midheaven');
  return values.map(canonicalKey);
}

function collectAspects(chart: ChartSource, points: PortraitPoint[]): PortraitAspect[] {
  const pointByAlias = new Map<string, PortraitPoint>();
  points.forEach((point) => aliases(point).forEach((alias) => pointByAlias.set(alias, point)));
  const source = chart as unknown as Record<string, unknown>;
  const variableIds = new Set(
    Array.isArray(objectRecord(source.chartQuality)?.variableAspectIds)
      ? objectRecord(source.chartQuality)?.variableAspectIds as string[]
      : [],
  );
  return (Array.isArray(chart.aspects) ? chart.aspects : []).flatMap((raw, index) => {
    const aspect = raw as unknown as Record<string, unknown>;
    const id = String(aspect.id || `${aspect.fromKey}-${aspect.type}-${aspect.toKey}-${index}`);
    const from = pointByAlias.get(canonicalKey(aspect.fromKey ?? aspect.from));
    const to = pointByAlias.get(canonicalKey(aspect.toKey ?? aspect.to));
    const orb = finite(aspect.orb);
    if (!from || !to || aspect.reliable === false || variableIds.has(id) || orb == null) return [];
    return [{
      id,
      type: String(aspect.type || 'aspect').toLocaleLowerCase('en-US'),
      phase: String(aspect.phase || ''),
      orb,
      from,
      to,
    }];
  });
}

export function NatalChartPortrait({ chart, language }: { chart: ChartSource; language: Language }) {
  const bodies = collectBodies(chart);
  const angles = collectAngles(chart);
  const points = [...bodies, ...angles];
  const aspects = collectAspects(chart, points);
  const keyPoints = [
    bodies.find((point) => point.key === 'sun'),
    bodies.find((point) => point.key === 'moon'),
    angles.find((point) => point.key === 'ascendant'),
  ].filter((point): point is PortraitPoint => !!point);
  const title = language === 'ru' ? 'Код натальной карты' : 'Birth chart signature';
  const description = language === 'ru'
    ? 'Уникальная композиция построена из рассчитанных положений и надёжных аспектов этой карты.'
    : 'This unique composition is built from the calculated placements and reliable aspects in this chart.';

  return (
    <figure className="natal-chart-portrait" aria-labelledby="natal-chart-portrait-caption">
      <div className="natal-chart-portrait-visual">
        <svg
          className="natal-chart-portrait-svg"
          viewBox="0 0 420 230"
          role="img"
          aria-labelledby="natal-chart-portrait-title natal-chart-portrait-description"
        >
          <title id="natal-chart-portrait-title">{title}</title>
          <desc id="natal-chart-portrait-description">{description}</desc>

          <g className="natal-chart-portrait-aspects" aria-hidden="true">
            {aspects.map((aspect) => (
              <line
                key={aspect.id}
                className={`natal-chart-portrait-aspect is-${aspect.type} is-${aspect.phase}`}
                x1={aspect.from.x}
                y1={aspect.from.y}
                x2={aspect.to.x}
                y2={aspect.to.y}
                style={{ opacity: Math.max(0.24, Math.min(0.9, 1 - aspect.orb / 10)) }}
              />
            ))}
          </g>

          <g className="natal-chart-portrait-points" aria-hidden="true">
            {points.map((point) => (
              <g key={point.key} transform={`translate(${point.x} ${point.y})`}>
                <path className="natal-chart-portrait-node" d="M0 -4 L4 0 L0 4 L-4 0 Z" />
                <g transform="translate(-8 -22)">
                  <PlanetIcon planet={point.icon} size={16} strokeWidth={1.45} />
                </g>
                {point.retrograde ? <text className="natal-chart-portrait-retro" x="7" y="-9">R</text> : null}
              </g>
            ))}
          </g>

          <line className="natal-chart-portrait-divider" x1="282" y1="28" x2="282" y2="202" aria-hidden="true" />
          <g className="natal-chart-portrait-key" aria-hidden="true">
            {keyPoints.map((point, index) => (
              <g key={point.key} transform={`translate(306 ${64 + index * 56})`}>
                <g transform="translate(0 -13)">
                  <PlanetIcon planet={point.icon} size={20} strokeWidth={1.4} />
                </g>
                <text className="natal-chart-portrait-key-label" x="30" y="-7">
                  {PLANET_NAMES[point.key]?.[language] || point.name}
                </text>
                <text className="natal-chart-portrait-key-value" x="30" y="12">
                  {getZodiacSign(language, point.sign)} {Number(point.degree.toFixed(1))}°
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="natal-chart-portrait-mobile-key" aria-hidden="true">
        {keyPoints.map((point) => (
          <div key={point.key} className="natal-chart-portrait-mobile-key-item">
            <PlanetIcon planet={point.icon} size={18} strokeWidth={1.4} />
            <span>
              <strong>{PLANET_NAMES[point.key]?.[language] || point.name}</strong>
              <small>{getZodiacSign(language, point.sign)} {Number(point.degree.toFixed(1))}°</small>
            </span>
          </div>
        ))}
      </div>

      <figcaption id="natal-chart-portrait-caption" className="natal-chart-portrait-caption">
        <strong>{title}</strong>
        <span>{description}</span>
      </figcaption>

      <ul className="natal-chart-portrait-a11y">
        {points.map((point) => (
          <li key={point.key}>
            {PLANET_NAMES[point.key]?.[language] || point.name}: {' '}
            {getZodiacSign(language, point.sign)} {point.degree.toFixed(1)}°
            {point.retrograde ? `, ${language === 'ru' ? 'ретроградный' : 'retrograde'}` : ''}
          </li>
        ))}
      </ul>
    </figure>
  );
}
