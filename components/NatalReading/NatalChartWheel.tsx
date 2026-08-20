import React, { useRef } from 'react';
import { Download } from 'lucide-react';
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
  fromKey: string;
  toKey: string;
  fromLongitude: number;
  toLongitude: number;
};

type WheelHouse = {
  house: number;
  longitude: number;
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

function exactWheelCoordinate(chart: ChartSource, value: Record<string, unknown>): boolean {
  const rawChart = chart as unknown as Record<string, unknown>;
  if (rawChart.schemaVersion === 'natal-chart-data-v2') return value.reliability === 'exact';
  return getPermanentNatalReliability(chart).quality === 'exact'
    && value.reliability !== 'variable_in_range';
}

function collectBodies(chart: ChartSource): WheelPoint[] {
  return BODY_KEYS.flatMap((key) => {
    const position = positionRecord(chart, key);
    if (!position || !exactWheelCoordinate(chart, position)) return [];
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
  if (!reliability.anglesIncluded || reliability.quality !== 'exact') return false;

  const rawChart = chart as unknown as Record<string, unknown>;
  const angles = objectRecord(rawChart.angles);
  const angle = objectRecord(angles?.[key] ?? (key === 'ascendant' ? rawChart.rising : rawChart.mc));
  return !!angle
    && finite(angle.longitude) != null
    && exactWheelCoordinate(chart, angle);
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

function collectHouses(chart: ChartSource): WheelHouse[] {
  const reliability = getPermanentNatalReliability(chart);
  if (reliability.quality !== 'exact' || !reliability.housesIncluded || !Array.isArray(chart.houses)) return [];

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
    const reliable = exactWheelCoordinate(chart, house) && !variableHouses.has(number);
    if (longitude == null || !reliable) return [];
    return [{ house: number, longitude: normalizeLongitude(longitude) }];
  }).sort((left, right) => left.house - right.house);
}

function houseLabelLongitude(house: WheelHouse, houses: WheelHouse[]): number {
  const nextHouseNumber = house.house === 12 ? 1 : house.house + 1;
  const next = houses.find((candidate) => candidate.house === nextHouseNumber);
  if (!next) return normalizeLongitude(house.longitude + 15);
  const forward = normalizeLongitude(next.longitude - house.longitude);
  return normalizeLongitude(house.longitude + forward / 2);
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
    if (point.key === 'ascendant') {
      longitudeByAlias.set('descendant', normalizeLongitude(point.longitude + 180));
      longitudeByAlias.set('dsc', normalizeLongitude(point.longitude + 180));
    }
    if (point.key === 'mc') {
      longitudeByAlias.set('ic', normalizeLongitude(point.longitude + 180));
      longitudeByAlias.set('imumcoeli', normalizeLongitude(point.longitude + 180));
    }
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
      fromKey,
      toKey,
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

export function NatalChartWheel({
  chart,
  language,
  downloadName = 'natal-chart',
}: {
  chart: ChartSource;
  language: Language;
  downloadName?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const bodies = collectBodies(chart);
  const angles = collectAngles(chart);
  const houses = collectHouses(chart);
  const allPoints = [...bodies, ...angles];
  const aspects = collectAspects(chart, allPoints);
  const omittedBodyCount = BODY_KEYS.length - bodies.length;
  const ascendant = angles.find((angle) => angle.key === 'ascendant');
  const midheaven = angles.find((angle) => angle.key === 'mc');
  const wheelRotation = ascendant
    ? ascendant.longitude + 270
    : midheaven
      ? midheaven.longitude
      : 0;
  const chartPoint = (longitude: number, radius: number) => pointOnWheel(wheelRotation - longitude, radius);
  const title = language === 'ru' ? 'Круг натальной карты' : 'Natal chart wheel';
  const caption = language === 'ru'
    ? `Точные положения рассчитанных объектов и аспекты из карты.${omittedBodyCount > 0 ? ' Координаты с недостаточной точностью не показаны.' : ''}`
    : `Exact calculated placements and chart aspects.${omittedBodyCount > 0 ? ' Coordinates without sufficient precision are omitted.' : ''}`;

  const downloadChart = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '1440');
    clone.setAttribute('height', '1440');
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const safeName = downloadName
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'natal-chart';
    const fileName = `${safeName}.svg`;
    const shareNavigator = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title: string }) => Promise<void>;
    };
    if (typeof File !== 'undefined' && shareNavigator.share && shareNavigator.canShare) {
      const file = new File([blob], fileName, { type: blob.type });
      if (shareNavigator.canShare({ files: [file] })) {
        try {
          await shareNavigator.share({ files: [file], title });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <figure className="natal-chart-wheel" aria-labelledby="natal-chart-wheel-caption">
      <svg
        ref={svgRef}
        className="natal-chart-wheel-svg"
        viewBox="0 0 360 360"
        role="img"
        aria-labelledby="natal-chart-wheel-title natal-chart-wheel-description"
      >
        <title id="natal-chart-wheel-title">{title}</title>
        <desc id="natal-chart-wheel-description">{caption}</desc>

        <style>{`
          .natal-chart-wheel-export-bg { fill: #ffffff !important; }
          .natal-chart-wheel-ring { fill: none !important; stroke: rgba(37,34,31,.22) !important; stroke-width: 1 !important; }
          .natal-chart-wheel-ring--outer { stroke: rgba(37,34,31,.52) !important; }
          .natal-chart-wheel-ring--aspects { stroke: rgba(37,34,31,.10) !important; }
          .natal-chart-wheel-sign { color: #403b36 !important; }
          .natal-chart-wheel-sign > line, .natal-chart-wheel-house > line { stroke: rgba(37,34,31,.20) !important; stroke-width: 1 !important; }
          .natal-chart-wheel-house > text { fill: #a49b92 !important; font-family: Manrope, Arial, sans-serif; font-size: 7px; }
          .natal-chart-wheel-axis line { stroke: rgba(191,143,99,.62) !important; stroke-width: 1 !important; }
          .natal-chart-wheel-axis text { fill: #655e57 !important; font-family: Manrope, Arial, sans-serif; font-size: 7px; font-weight: 650; }
          .natal-chart-wheel-aspect { fill: none !important; stroke-width: 1.15 !important; }
          .natal-chart-wheel-aspect--conjunction { stroke: rgba(78,74,69,.42) !important; }
          .natal-chart-wheel-aspect--sextile, .natal-chart-wheel-aspect--trine { stroke: rgba(82,132,161,.48) !important; }
          .natal-chart-wheel-aspect--square, .natal-chart-wheel-aspect--opposition { stroke: rgba(191,143,99,.58) !important; stroke-dasharray: 3 2; }
          .natal-chart-wheel-marker { color: #24211e !important; }
          .natal-chart-wheel-marker > circle { fill: #fff !important; stroke: rgba(37,34,31,.20) !important; stroke-width: .9 !important; }
          .natal-chart-wheel-marker > text { fill: #77716b !important; font-family: Manrope, Arial, sans-serif; font-size: 6px; font-weight: 650; }
          .natal-chart-wheel-angle { color: #bf8f63 !important; }
          .natal-chart-wheel-angle > circle { fill: #fffaf6 !important; stroke: rgba(191,143,99,.46) !important; stroke-width: 1 !important; }
        `}</style>

        <rect className="natal-chart-wheel-export-bg" width="360" height="360" />

        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--outer" cx="180" cy="180" r="166" />
        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--signs" cx="180" cy="180" r="137" />
        <circle className="natal-chart-wheel-ring natal-chart-wheel-ring--aspects" cx="180" cy="180" r="66" />

        {SIGNS.map((sign, index) => {
          const divider = chartPoint(index * 30, 166);
          const dividerInner = chartPoint(index * 30, 137);
          const glyph = chartPoint(index * 30 + 15, 151.5);
          return (
            <g key={sign} className="natal-chart-wheel-sign" aria-hidden="true">
              <line x1={dividerInner.x} y1={dividerInner.y} x2={divider.x} y2={divider.y} />
              <g transform={`translate(${glyph.x - 10} ${glyph.y - 10})`}>
                <ZodiacIcon sign={sign} size={20} strokeWidth={1.25} />
              </g>
            </g>
          );
        })}

        <g className="natal-chart-wheel-houses" aria-hidden="true">
          {houses.map((house) => {
            const cusp = chartPoint(house.longitude, 137);
            const center = chartPoint(house.longitude, 66);
            const label = chartPoint(houseLabelLongitude(house, houses), 123);
            return (
              <g key={house.house} className="natal-chart-wheel-house">
                <line x1={center.x} y1={center.y} x2={cusp.x} y2={cusp.y} />
                <text x={label.x} y={label.y + 2.5} textAnchor="middle">{house.house}</text>
              </g>
            );
          })}
        </g>

        {angles.map((angle) => {
          const start = chartPoint(angle.longitude, 166);
          const end = chartPoint(angle.longitude + 180, 166);
          const startLabel = chartPoint(angle.longitude, 170);
          const endLabel = chartPoint(angle.longitude + 180, 170);
          const startText = angle.key === 'ascendant' ? 'ASC' : 'MC';
          const endText = angle.key === 'ascendant' ? 'DSC' : 'IC';
          return (
            <g key={`axis-${angle.key}`} className="natal-chart-wheel-axis" aria-hidden="true">
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
              <text x={startLabel.x} y={startLabel.y + 2.5} textAnchor="middle">{startText}</text>
              <text x={endLabel.x} y={endLabel.y + 2.5} textAnchor="middle">{endText}</text>
            </g>
          );
        })}

        <g className="natal-chart-wheel-aspects" aria-hidden="true">
          {aspects.map((aspect) => {
            const from = chartPoint(aspect.fromLongitude, 66);
            const to = chartPoint(aspect.toLongitude, 66);
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
          const marker = chartPoint(body.longitude, radius);
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
              <text x="0" y="9" textAnchor="middle">{Math.floor(normalizeLongitude(body.degree) % 30)}°</text>
            </g>
          );
        })}

        {angles.map((angle) => {
          const marker = chartPoint(angle.longitude, 126);
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
        <span className="natal-chart-wheel-caption-copy">
          <strong>{title}</strong>
          <span>{caption}</span>
        </span>
        <button
          type="button"
          className="natal-chart-download"
          onClick={() => { void downloadChart(); }}
          aria-label={language === 'ru' ? 'Скачать натальную карту в SVG' : 'Download natal chart as SVG'}
        >
          <Download aria-hidden="true" strokeWidth={1.45} />
        </button>
      </figcaption>

      <ul className="natal-chart-wheel-a11y">
        {allPoints.map((point) => (
          <li key={point.key}>
            {PLANET_NAMES[point.key as keyof typeof PLANET_NAMES]?.[language] || point.name}: {' '}
            {getZodiacSign(language, point.sign)} {(normalizeLongitude(point.degree) % 30).toFixed(1)}°
          </li>
        ))}
        {houses.map((house) => {
          const sign = SIGNS[Math.floor(house.longitude / 30) % SIGNS.length];
          return (
            <li key={`house-${house.house}`}>
              {language === 'ru' ? `Дом ${house.house}` : `House ${house.house}`}: {' '}
              {getZodiacSign(language, sign)} {(house.longitude % 30).toFixed(1)}°
            </li>
          );
        })}
        {aspects.map((aspect) => (
          <li key={`aspect-${aspect.id}`}>
            {language === 'ru' ? 'Аспект' : 'Aspect'}: {aspect.fromKey} — {aspect.type} — {aspect.toKey}
          </li>
        ))}
      </ul>
    </figure>
  );
}
