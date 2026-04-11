import React, { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getText, getZodiacSign } from '../../constants';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  NatalHouseData,
  PlanetPosition,
} from '../../types';
import { LumiaButton } from '../lumia-ui/LumiaButton';

type PlacementKey =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'rising';

type PlacementSpec = {
  key: PlacementKey;
  symbol: string;
  label: { ru: string; en: string };
  data: PlanetPosition | null | undefined;
};

type PlacementEntry = PlacementSpec & {
  longitude: number;
  orbitRadius: number;
  signLabel: string;
  degreeLabel: string | null;
};

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const OUTER_RADIUS = 132;
const SIGN_RADIUS = 118;
const PLANET_BASE_RADIUS = 92;
const HOUSE_RADIUS = 86;
const ASPECT_RADIUS = 61;

const ZODIAC_ORDER = [
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

const ZODIAC_SYMBOLS: Record<(typeof ZODIAC_ORDER)[number], string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

const SIGN_INDEX = Object.fromEntries(ZODIAC_ORDER.map((sign, index) => [sign, index])) as Record<string, number>;

const PLACEMENT_SPECS: PlacementSpec[] = [
  { key: 'sun', symbol: '☉', label: { ru: 'Солнце', en: 'Sun' }, data: null },
  { key: 'moon', symbol: '☽', label: { ru: 'Луна', en: 'Moon' }, data: null },
  { key: 'mercury', symbol: '☿', label: { ru: 'Меркурий', en: 'Mercury' }, data: null },
  { key: 'venus', symbol: '♀', label: { ru: 'Венера', en: 'Venus' }, data: null },
  { key: 'mars', symbol: '♂', label: { ru: 'Марс', en: 'Mars' }, data: null },
  { key: 'jupiter', symbol: '♃', label: { ru: 'Юпитер', en: 'Jupiter' }, data: null },
  { key: 'saturn', symbol: '♄', label: { ru: 'Сатурн', en: 'Saturn' }, data: null },
  { key: 'rising', symbol: '↑', label: { ru: 'Асцендент', en: 'Ascendant' }, data: null },
];

const normalizeDegrees = (value: number): number => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const getSignBaseLongitude = (sign?: string | null): number | null => {
  if (!sign) return null;
  const index = SIGN_INDEX[sign];
  if (typeof index !== 'number') return null;
  return index * 30;
};

const resolveLongitude = (position?: PlanetPosition | null): number | null => {
  if (!position) return null;
  if (typeof position.longitude === 'number') {
    return normalizeDegrees(position.longitude);
  }
  const signBase = getSignBaseLongitude(position.sign);
  if (signBase === null) return null;
  const degree = typeof position.degree === 'number' ? position.degree : 15;
  return normalizeDegrees(signBase + (degree % 30));
};

const resolveHouseLongitude = (house: NatalHouseData): number => {
  if (typeof house.longitude === 'number') {
    return normalizeDegrees(house.longitude);
  }
  const signBase = getSignBaseLongitude(house.sign) ?? 0;
  return normalizeDegrees(signBase + (house.degree % 30));
};

const toRadians = (degree: number): number => (degree * Math.PI) / 180;

const polarPoint = (longitude: number, radius: number, rotation: number) => {
  const angle = normalizeDegrees(longitude - rotation) - 90;
  const radians = toRadians(angle);
  return {
    x: CENTER + Math.cos(radians) * radius,
    y: CENTER + Math.sin(radians) * radius,
  };
};

const angularGap = (from: number, to: number): number => {
  const delta = Math.abs(normalizeDegrees(from - to));
  return delta > 180 ? 360 - delta : delta;
};

const normalizeAspectKey = (value: string): PlacementKey | null => {
  const key = value.trim().toLowerCase();
  if (key === 'ascendant' || key === 'asc' || key === 'rising') return 'rising';
  if (
    key === 'sun' ||
    key === 'moon' ||
    key === 'mercury' ||
    key === 'venus' ||
    key === 'mars' ||
    key === 'jupiter' ||
    key === 'saturn'
  ) {
    return key;
  }
  return null;
};

const getInfoText = (language: Language): string =>
  language === 'ru'
    ? 'Это твоя реальная натальная карта, рассчитанная по дате, времени и месту рождения. Положения планет, дома и Асцендент основаны на астрономических расчётах и отражают именно твои данные.'
    : 'This is your real natal chart, calculated from your birth date, time, and place. Planet placements, houses, and the Ascendant are based on astronomical calculations and reflect your actual data.';

interface TrueNatalWheelHeroProps {
  chartData: NatalChartData;
  language: Language;
  onOpenChart: () => void;
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ chartData, language, onOpenChart }) => {
    const shouldReduceMotion = useReducedMotion();

    const wheelRotation = useMemo(() => {
      const risingLongitude = resolveLongitude(chartData.rising);
      return risingLongitude !== null ? risingLongitude - 180 : 0;
    }, [chartData.rising]);

    const houseCusps = useMemo(() => {
      const houses =
        chartData.houses && chartData.houses.length
          ? [...chartData.houses].sort((left, right) => left.house - right.house)
          : Array.from({ length: 12 }, (_, index) => ({
              house: index + 1,
              sign: ZODIAC_ORDER[index % 12],
              degree: 0,
              longitude: normalizeDegrees((resolveLongitude(chartData.rising) ?? 0) + index * 30),
            }));

      return houses.map((house) => ({
        house: house.house,
        longitude: resolveHouseLongitude(house),
      }));
    }, [chartData.houses, chartData.rising]);

    const placements = useMemo<PlacementEntry[]>(() => {
      const source = PLACEMENT_SPECS.map((item) => ({
        ...item,
        data:
          item.key === 'sun'
            ? chartData.sun
            : item.key === 'moon'
              ? chartData.moon
              : item.key === 'mercury'
                ? chartData.mercury
                : item.key === 'venus'
                  ? chartData.venus
                  : item.key === 'mars'
                    ? chartData.mars
                    : item.key === 'jupiter'
                      ? chartData.jupiter
                      : item.key === 'saturn'
                        ? chartData.saturn
                        : chartData.rising,
      }))
        .map((item) => {
          const longitude = resolveLongitude(item.data);
          if (longitude === null || !item.data?.sign) return null;
          const signLabel = getZodiacSign(language, item.data.sign);
          const roundedDegree =
            typeof item.data.degree === 'number' && Number.isFinite(item.data.degree)
              ? Math.round(item.data.degree)
              : null;
          return {
            ...item,
            longitude,
            orbitRadius: PLANET_BASE_RADIUS,
            signLabel,
            degreeLabel: roundedDegree !== null ? `${roundedDegree}°` : null,
          };
        })
        .filter(Boolean) as PlacementEntry[];

      const sorted = [...source].sort((left, right) => left.longitude - right.longitude);
      const adjusted: PlacementEntry[] = [];

      sorted.forEach((entry) => {
        const previous = adjusted[adjusted.length - 1];
        let orbitRadius = PLANET_BASE_RADIUS;

        if (previous) {
          const gap = angularGap(entry.longitude, previous.longitude);
          if (gap < 11) orbitRadius = previous.orbitRadius - 12;
          if (gap < 7) orbitRadius = previous.orbitRadius - 18;
          if (gap < 4) orbitRadius = previous.orbitRadius - 22;
        }

        if (orbitRadius < 62) orbitRadius = PLANET_BASE_RADIUS + 10;
        adjusted.push({ ...entry, orbitRadius });
      });

      const byKey = new Map(adjusted.map((entry) => [entry.key, entry]));
      return source.map((entry) => byKey.get(entry.key) ?? entry);
    }, [chartData, language]);

    const placementMap = useMemo(
      () => new Map<PlacementKey, PlacementEntry>(placements.map((item) => [item.key, item])),
      [placements]
    );

    const aspectLines = useMemo(() => {
      const fallbackKeys: PlacementKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
      const rawAspects = Array.isArray(chartData.aspects) ? chartData.aspects : [];

      const lines = rawAspects
        .map((aspect: NatalAspectData) => {
          const fromKey = normalizeAspectKey(aspect.from);
          const toKey = normalizeAspectKey(aspect.to);
          if (!fromKey || !toKey || fromKey === toKey) return null;

          const from = placementMap.get(fromKey);
          const to = placementMap.get(toKey);
          if (!from || !to) return null;

          return {
            type: aspect.type,
            orb: aspect.orb,
            from,
            to,
          };
        })
        .filter(Boolean)
        .sort((left, right) => (left?.orb ?? 0) - (right?.orb ?? 0))
        .slice(0, 6) as Array<{
        type: NatalAspectData['type'];
        orb: number;
        from: PlacementEntry;
        to: PlacementEntry;
      }>;

      if (lines.length) return lines;

      return fallbackKeys
        .map((key, index) => {
          const from = placementMap.get(key);
          const to = placementMap.get(fallbackKeys[index + 1] as PlacementKey);
          if (!from || !to) return null;
          return { type: 'conjunction' as const, orb: index, from, to };
        })
        .filter(Boolean)
        .slice(0, 3) as Array<{
        type: NatalAspectData['type'];
        orb: number;
        from: PlacementEntry;
        to: PlacementEntry;
      }>;
    }, [chartData.aspects, placementMap]);

    const ascPoint = useMemo(() => polarPoint(resolveLongitude(chartData.rising) ?? 180, OUTER_RADIUS + 12, wheelRotation), [
      chartData.rising,
      wheelRotation,
    ]);

    const wheelTransition = shouldReduceMotion
      ? { duration: 0.24 }
      : { duration: 1.05, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    return (
      <div className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted/72">
          {getText(language, 'dashboard.natal_preview_label')}
        </p>

        <div className="relative">
          <div
            className="pointer-events-none absolute left-1/2 top-[7.2rem] h-[15.75rem] w-[15.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(241,236,229,0.92) 0%, rgba(250,248,244,0.68) 38%, rgba(255,255,255,0) 72%)',
            }}
            aria-hidden
          />

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={wheelTransition}
            className="relative mx-auto h-[15rem] w-[15rem]"
          >
            <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="h-full w-full overflow-visible" aria-hidden>
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="rgba(255,255,255,0.88)"
                stroke="rgba(18,18,18,0.12)"
                strokeWidth="1.2"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.15 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={wheelTransition}
              />
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={112}
                fill="rgba(255,255,255,0.72)"
                stroke="rgba(18,18,18,0.08)"
                strokeWidth="1"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.15 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={{ ...wheelTransition, delay: shouldReduceMotion ? 0 : 0.04 }}
              />
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={HOUSE_RADIUS}
                fill="rgba(252,250,247,0.88)"
                stroke="rgba(18,18,18,0.08)"
                strokeWidth="1"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.15 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={{ ...wheelTransition, delay: shouldReduceMotion ? 0 : 0.08 }}
              />

              {Array.from({ length: 36 }, (_, index) => {
                const longitude = index * 10;
                const outer = polarPoint(longitude, OUTER_RADIUS, wheelRotation);
                const inner = polarPoint(longitude, index % 3 === 0 ? OUTER_RADIUS - 10 : OUTER_RADIUS - 6, wheelRotation);
                return (
                  <line
                    key={`tick-${index}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="rgba(18,18,18,0.12)"
                    strokeWidth={index % 3 === 0 ? 1 : 0.7}
                  />
                );
              })}

              {ZODIAC_ORDER.map((sign, index) => {
                const separator = polarPoint(index * 30, OUTER_RADIUS - 12, wheelRotation);
                const separatorOuter = polarPoint(index * 30, OUTER_RADIUS, wheelRotation);
                const glyphPoint = polarPoint(index * 30 + 15, SIGN_RADIUS, wheelRotation);

                return (
                  <g key={sign}>
                    <line
                      x1={separator.x}
                      y1={separator.y}
                      x2={separatorOuter.x}
                      y2={separatorOuter.y}
                      stroke="rgba(18,18,18,0.16)"
                      strokeWidth="1"
                    />
                    <text
                      x={glyphPoint.x}
                      y={glyphPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(31,31,31,0.62)"
                      style={{ fontSize: 13, letterSpacing: '0.02em', fontWeight: 500 }}
                    >
                      {ZODIAC_SYMBOLS[sign]}
                    </text>
                  </g>
                );
              })}

              {houseCusps.map((house) => {
                const outer = polarPoint(house.longitude, HOUSE_RADIUS, wheelRotation);
                const inner = polarPoint(house.longitude, 28, wheelRotation);
                const labelPoint = polarPoint(house.longitude + 15, 54, wheelRotation);
                const emphatic = house.house === 1 || house.house === 4 || house.house === 7 || house.house === 10;

                return (
                  <g key={`house-${house.house}`}>
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke={emphatic ? 'rgba(18,18,18,0.18)' : 'rgba(18,18,18,0.1)'}
                      strokeWidth={emphatic ? 1.1 : 0.85}
                    />
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(31,31,31,0.45)"
                      style={{ fontSize: 8.5, letterSpacing: '0.08em', fontWeight: 500 }}
                    >
                      {house.house}
                    </text>
                  </g>
                );
              })}

              {aspectLines.map((aspect, index) => {
                const fromPoint = polarPoint(aspect.from.longitude, ASPECT_RADIUS, wheelRotation);
                const toPoint = polarPoint(aspect.to.longitude, ASPECT_RADIUS, wheelRotation);
                const opacity =
                  aspect.type === 'opposition'
                    ? 0.22
                    : aspect.type === 'square'
                      ? 0.2
                      : aspect.type === 'trine'
                        ? 0.18
                        : 0.15;

                return (
                  <motion.line
                    key={`aspect-${aspect.from.key}-${aspect.to.key}-${index}`}
                    x1={fromPoint.x}
                    y1={fromPoint.y}
                    x2={toPoint.x}
                    y2={toPoint.y}
                    stroke={`rgba(31,31,31,${opacity})`}
                    strokeWidth="0.9"
                    strokeDasharray={aspect.type === 'sextile' ? '2.4 3.4' : undefined}
                    initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                    animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0.2 : 0.85,
                      delay: shouldReduceMotion ? 0 : 0.16 + index * 0.04,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                );
              })}

              {placements.map((placement, index) => {
                const anchorPoint = polarPoint(placement.longitude, PLANET_BASE_RADIUS, wheelRotation);
                const markerPoint = polarPoint(placement.longitude, placement.orbitRadius, wheelRotation);

                return (
                  <motion.g
                    key={placement.key}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.88 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0.18 : 0.42,
                      delay: shouldReduceMotion ? 0 : 0.22 + index * 0.035,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <line
                      x1={anchorPoint.x}
                      y1={anchorPoint.y}
                      x2={markerPoint.x}
                      y2={markerPoint.y}
                      stroke="rgba(31,31,31,0.16)"
                      strokeWidth="0.9"
                    />
                    <circle cx={anchorPoint.x} cy={anchorPoint.y} r="2.1" fill="rgba(31,31,31,0.48)" />
                    <circle
                      cx={markerPoint.x}
                      cy={markerPoint.y}
                      r="11.5"
                      fill="rgba(255,255,255,0.96)"
                      stroke="rgba(18,18,18,0.09)"
                      strokeWidth="1"
                    />
                    <text
                      x={markerPoint.x}
                      y={markerPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#1f1f1f"
                      style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      {placement.symbol}
                    </text>
                  </motion.g>
                );
              })}

              <line
                x1={CENTER}
                y1={CENTER}
                x2={ascPoint.x}
                y2={ascPoint.y}
                stroke="rgba(18,18,18,0.16)"
                strokeWidth="1.05"
              />
              <text
                x={ascPoint.x}
                y={ascPoint.y}
                dx="-3"
                dy="-4"
                textAnchor="end"
                fill="rgba(31,31,31,0.62)"
                style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 600 }}
              >
                ASC
              </text>
            </svg>
          </motion.div>
        </div>

        <div
          className="grid gap-x-3 gap-y-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, placements.length))}, minmax(0, 1fr))` }}
        >
          {placements.map((placement) => (
            <div key={`placement-${placement.key}`} className="min-w-0 text-center">
              <span className="block text-[15px] leading-none text-[#1f1f1f]">{placement.symbol}</span>
              <span className="mt-1 block truncate text-[9px] uppercase tracking-[0.16em] text-text-muted/80">
                {placement.label[language]}
              </span>
              <span className="mt-1 block text-[12px] leading-[1.15] text-text-main">{placement.signLabel}</span>
              {placement.degreeLabel ? (
                <span className="mt-0.5 block text-[10px] leading-none text-text-muted/76">
                  {placement.degreeLabel}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <LumiaButton className="min-h-[48px] w-full" variant="primary" onClick={onOpenChart}>
          {getText(language, 'dashboard.natal_preview_cta')}
        </LumiaButton>

        <div className="flex items-start gap-2 pt-0.5 text-[11px] leading-[1.55] text-text-muted/78">
          <span className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-[10px] font-medium text-text-main/72">
            i
          </span>
          <p>{getInfoText(language)}</p>
        </div>
      </div>
    );
  }
);

TrueNatalWheelHero.displayName = 'TrueNatalWheelHero';
