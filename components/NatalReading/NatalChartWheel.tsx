import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { getZodiacSign } from '../../constants';
import type { NatalChartData } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import {
  NATAL_CHART_WHEEL_BODY_KEYS,
  buildNatalChartWheelModel as buildWheelModel,
  getNatalChartWheelCaption as getWheelCaption,
  natalChartWheelBodyLane,
  natalChartWheelHouseLabelLongitude,
  normalizeNatalWheelLongitude,
} from '../../lib/natalChartWheelModel';
import { PlanetIcon, type PlanetKey } from '../icons/PlanetIcon';
import { ZodiacIcon } from '../icons/ZodiacIcon';

type Language = 'ru' | 'en';
type ChartSource = NatalChartData | NatalChartDataV2;
type BodyKey = (typeof NATAL_CHART_WHEEL_BODY_KEYS)[number];

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

const PLANET_ICONS: Record<BodyKey, PlanetKey> = {
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

const PLANET_NAMES: Record<BodyKey | 'ascendant' | 'mc', Record<Language, string>> = {
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

function pointOnWheel(longitude: number, radius: number) {
  const radians = ((normalizeNatalWheelLongitude(longitude) - 90) * Math.PI) / 180;
  return {
    x: 180 + Math.cos(radians) * radius,
    y: 180 + Math.sin(radians) * radius,
  };
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
  const reliability = getPermanentNatalReliability(chart);
  const { bodies, angles, houses, allPoints, aspects } = buildWheelModel(chart);
  const omittedBodyCount = NATAL_CHART_WHEEL_BODY_KEYS.length - bodies.length;
  const ascendant = angles.find((angle) => angle.key === 'ascendant');
  const midheaven = angles.find((angle) => angle.key === 'mc');
  const wheelRotation = ascendant
    ? ascendant.longitude + 270
    : midheaven
      ? midheaven.longitude
      : 0;
  const chartPoint = (longitude: number, radius: number) => pointOnWheel(wheelRotation - longitude, radius);
  const title = language === 'ru' ? 'Круг натальной карты' : 'Natal chart wheel';
  const caption = getWheelCaption(reliability.quality, language, omittedBodyCount);
  const precisionLabel = reliability.quality === 'unknown'
    ? (language === 'ru' ? 'Время не указано' : 'Time not specified')
    : reliability.quality === 'approximate'
      ? (language === 'ru' ? 'Время примерное' : 'Approximate time')
      : null;

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

        {precisionLabel ? (
          <g className="natal-chart-wheel-precision-note" aria-hidden="true">
            <circle cx="180" cy="180" r="3" />
            <line x1="172" y1="180" x2="148" y2="180" />
            <line x1="188" y1="180" x2="212" y2="180" />
            <text x="180" y="196" textAnchor="middle">{precisionLabel}</text>
          </g>
        ) : null}

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
            const label = chartPoint(natalChartWheelHouseLabelLongitude(house, houses), 123);
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
          const radius = [116, 96, 77][natalChartWheelBodyLane(bodies, index)];
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
                <PlanetIcon planet={PLANET_ICONS[body.key as BodyKey]} size={16} strokeWidth={1.45} />
              </g>
              <text x="0" y="9" textAnchor="middle">{Math.floor(normalizeNatalWheelLongitude(body.degree) % 30)}°</text>
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
                <PlanetIcon planet={angle.key === 'ascendant' ? 'asc' : 'mc'} size={16} strokeWidth={1.55} />
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
            {getZodiacSign(language, point.sign)} {(normalizeNatalWheelLongitude(point.degree) % 30).toFixed(1)}°
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
