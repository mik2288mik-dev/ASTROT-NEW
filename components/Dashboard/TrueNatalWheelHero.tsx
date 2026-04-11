import React, { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  markerCode: { ru: string; en: string };
  label: { ru: string; en: string };
  data: PlanetPosition | null | undefined;
};

type PlacementEntry = PlacementSpec & {
  longitude: number;
  orbitRadius: number;
  signLabel: string;
  shortSignLabel: string;
  degreeLabel: string | null;
};

type PrimaryCalloutSlot = {
  x: number;
  y: number;
  connectorX: number;
  connectorY: number;
  anchor: 'start' | 'middle' | 'end';
};

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const OUTER_RADIUS = 136;
const SIGN_RADIUS = 119;
const PLANET_BASE_RADIUS = 94;
const HOUSE_RADIUS = 88;
const ASPECT_RADIUS = 63;
const HOUSE_LABEL_RADIUS = 56;
const PRIMARY_KEYS: PlacementKey[] = ['sun', 'moon', 'rising'];
const ASTRO_FONT_STACK = '"Noto Sans Symbols 2 Local","Noto Sans Symbols 2","Segoe UI Symbol",sans-serif';
const ORBIT_LANES = [12, -10, 22, -20, 31, -29] as const;

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

const ZODIAC_SHORT_LABELS: Record<Language, Record<(typeof ZODIAC_ORDER)[number], string>> = {
  ru: {
    Aries: 'Овен',
    Taurus: 'Тел',
    Gemini: 'Бли',
    Cancer: 'Рак',
    Leo: 'Лев',
    Virgo: 'Дев',
    Libra: 'Вес',
    Scorpio: 'Ско',
    Sagittarius: 'Стр',
    Capricorn: 'Коз',
    Aquarius: 'Вод',
    Pisces: 'Рыб',
  },
  en: {
    Aries: 'Ari',
    Taurus: 'Tau',
    Gemini: 'Gem',
    Cancer: 'Can',
    Leo: 'Leo',
    Virgo: 'Vir',
    Libra: 'Lib',
    Scorpio: 'Sco',
    Sagittarius: 'Sag',
    Capricorn: 'Cap',
    Aquarius: 'Aqu',
    Pisces: 'Pis',
  },
};

const SIGN_INDEX = Object.fromEntries(ZODIAC_ORDER.map((sign, index) => [sign, index])) as Record<string, number>;

const PLACEMENT_SPECS: PlacementSpec[] = [
  { key: 'sun', symbol: '☉', markerCode: { ru: 'С', en: 'Su' }, label: { ru: 'Солнце', en: 'Sun' }, data: null },
  { key: 'moon', symbol: '☽', markerCode: { ru: 'Л', en: 'Mo' }, label: { ru: 'Луна', en: 'Moon' }, data: null },
  { key: 'mercury', symbol: '☿', markerCode: { ru: 'Ме', en: 'Me' }, label: { ru: 'Меркурий', en: 'Mercury' }, data: null },
  { key: 'venus', symbol: '♀', markerCode: { ru: 'Ве', en: 'Ve' }, label: { ru: 'Венера', en: 'Venus' }, data: null },
  { key: 'mars', symbol: '♂', markerCode: { ru: 'Ма', en: 'Ma' }, label: { ru: 'Марс', en: 'Mars' }, data: null },
  { key: 'jupiter', symbol: '♃', markerCode: { ru: 'Юп', en: 'Ju' }, label: { ru: 'Юпитер', en: 'Jupiter' }, data: null },
  { key: 'saturn', symbol: '♄', markerCode: { ru: 'Са', en: 'Sa' }, label: { ru: 'Сатурн', en: 'Saturn' }, data: null },
  { key: 'rising', symbol: '↑', markerCode: { ru: 'ASC', en: 'ASC' }, label: { ru: 'ASC', en: 'ASC' }, data: null },
];

const PRIMARY_CALLOUT_SLOTS: Record<PlacementKey, PrimaryCalloutSlot> = {
  sun: { x: 44, y: 50, connectorX: 82, connectorY: 64, anchor: 'start' },
  moon: { x: 276, y: 54, connectorX: 238, connectorY: 68, anchor: 'end' },
  mercury: { x: 0, y: 0, connectorX: 0, connectorY: 0, anchor: 'start' },
  venus: { x: 0, y: 0, connectorX: 0, connectorY: 0, anchor: 'start' },
  mars: { x: 0, y: 0, connectorX: 0, connectorY: 0, anchor: 'start' },
  jupiter: { x: 0, y: 0, connectorX: 0, connectorY: 0, anchor: 'start' },
  saturn: { x: 0, y: 0, connectorX: 0, connectorY: 0, anchor: 'start' },
  rising: { x: 160, y: 299, connectorX: 160, connectorY: 275, anchor: 'middle' },
};

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

const getShortSignLabel = (language: Language, sign: string): string =>
  ZODIAC_SHORT_LABELS[language][sign as keyof (typeof ZODIAC_SHORT_LABELS)[typeof language]] || sign;

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

const midpointLongitude = (start: number, end: number): number => {
  const normalizedStart = normalizeDegrees(start);
  const span = normalizeDegrees(end - normalizedStart);
  return normalizeDegrees(normalizedStart + span / 2);
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
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const titleText = language === 'ru' ? 'Твоя натальная карта' : 'Your natal chart';
    const titleGlyphs = useMemo(() => Array.from(titleText), [titleText]);

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

    const houseLabels = useMemo(
      () =>
        houseCusps.map((house, index) => {
          const nextHouse = houseCusps[(index + 1) % houseCusps.length];
          return {
            house: house.house,
            longitude: midpointLongitude(house.longitude, nextHouse.longitude),
          };
        }),
      [houseCusps]
    );

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
            shortSignLabel: getShortSignLabel(language, item.data.sign),
            degreeLabel: roundedDegree !== null ? `${roundedDegree}°` : null,
          };
        })
        .filter(Boolean) as PlacementEntry[];

      const sorted = [...source].sort((left, right) => left.longitude - right.longitude);
      const adjusted: PlacementEntry[] = [];
      let clusterLane = 0;

      sorted.forEach((entry, index) => {
        const previous = sorted[index - 1];
        const inSameCluster = previous ? angularGap(entry.longitude, previous.longitude) < 11.5 : false;

        clusterLane = inSameCluster ? clusterLane + 1 : 0;

        const laneOffset = ORBIT_LANES[clusterLane % ORBIT_LANES.length];
        const orbitRadius = Math.max(
          64,
          PLANET_BASE_RADIUS + laneOffset + (PRIMARY_KEYS.includes(entry.key) ? 2 : 0)
        );

        adjusted.push({ ...entry, orbitRadius });
      });

      const byKey = new Map(adjusted.map((entry) => [entry.key, entry]));
      return source.map((entry) => byKey.get(entry.key) ?? entry);
    }, [chartData, language]);

    const placementMap = useMemo(
      () => new Map<PlacementKey, PlacementEntry>(placements.map((item) => [item.key, item])),
      [placements]
    );

    const primaryPlacements = useMemo(
      () => PRIMARY_KEYS.map((key) => placementMap.get(key)).filter(Boolean) as PlacementEntry[],
      [placementMap]
    );

    const secondaryPlacements = useMemo(
      () => placements.filter((placement) => !PRIMARY_KEYS.includes(placement.key)),
      [placements]
    );

    const aspectLines = useMemo(() => {
      const rawAspects = Array.isArray(chartData.aspects) ? chartData.aspects : [];

      return rawAspects
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
        .slice(0, 1) as Array<{
        type: NatalAspectData['type'];
        orb: number;
        from: PlacementEntry;
        to: PlacementEntry;
      }>;
    }, [chartData.aspects, placementMap]);

    const wheelTransition = shouldReduceMotion
      ? { duration: 0.24 }
      : { duration: 1.08, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    return (
      <div className="space-y-4 pb-3">
        <div className="space-y-1 text-center">
          <p className="text-[14px] tracking-[0.04em] text-text-main/76">
            {titleGlyphs.map((glyph, index) => (
              <motion.span
                key={`title-${glyph}-${index}`}
                className="inline-block"
                animate={
                  shouldReduceMotion || glyph === ' '
                    ? undefined
                    : {
                        y: [0, -2.4, 0],
                        opacity: [0.76, 1, 0.76],
                      }
                }
                transition={
                  shouldReduceMotion || glyph === ' '
                    ? undefined
                    : {
                        duration: 0.86,
                        ease: [0.22, 1, 0.36, 1],
                        repeat: Infinity,
                        repeatDelay: 46,
                        delay: 4 + index * 0.05,
                      }
                }
              >
                {glyph === ' ' ? '\u00A0' : glyph}
              </motion.span>
            ))}
          </p>
        </div>

        <div className="relative pt-1">
          <div
            className="pointer-events-none absolute left-1/2 top-[9.5rem] h-[21rem] w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(246,241,234,0.98) 0%, rgba(251,247,242,0.92) 44%, rgba(255,255,255,0) 78%)',
            }}
            aria-hidden
          />

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={wheelTransition}
            className="relative mx-auto h-[20.25rem] w-[20.25rem]"
          >
            <button
              type="button"
              onClick={() => setIsInfoOpen((current) => !current)}
              aria-expanded={isInfoOpen}
              aria-label={language === 'ru' ? 'О расчёте карты' : 'About this chart'}
              className="absolute right-[0.8rem] top-[0.95rem] z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.07] bg-white/92 text-[11px] font-medium text-text-main/72 shadow-[0_6px_16px_rgba(0,0,0,0.03)] transition-colors hover:border-black/[0.14] hover:text-text-main"
            >
              i
            </button>
            <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="h-full w-full overflow-visible" aria-hidden>
              <defs>
                <radialGradient id="lumiaWheelGlow" cx="50%" cy="46%" r="58%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                  <stop offset="64%" stopColor="rgba(252,249,245,0.92)" />
                  <stop offset="100%" stopColor="rgba(248,244,238,0.82)" />
                </radialGradient>
              </defs>

              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                fill="url(#lumiaWheelGlow)"
                stroke="rgba(31,31,31,0.1)"
                strokeWidth="1.1"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.16 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={wheelTransition}
              />
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={115}
                fill="rgba(255,255,255,0.78)"
                stroke="rgba(31,31,31,0.06)"
                strokeWidth="1"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.12 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={{ ...wheelTransition, delay: shouldReduceMotion ? 0 : 0.04 }}
              />
              <motion.circle
                cx={CENTER}
                cy={CENTER}
                r={HOUSE_RADIUS}
                fill="rgba(253,251,248,0.94)"
                stroke="rgba(31,31,31,0.07)"
                strokeWidth="1"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0.12 }}
                animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                transition={{ ...wheelTransition, delay: shouldReduceMotion ? 0 : 0.08 }}
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={PLANET_BASE_RADIUS + 10}
                fill="none"
                stroke="rgba(166,152,129,0.08)"
                strokeWidth="0.8"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={PLANET_BASE_RADIUS - 16}
                fill="none"
                stroke="rgba(31,31,31,0.045)"
                strokeWidth="0.75"
                strokeDasharray="1.6 5.8"
              />

              {Array.from({ length: 72 }, (_, index) => {
                const longitude = index * 5;
                const outer = polarPoint(longitude, OUTER_RADIUS, wheelRotation);
                const inner = polarPoint(
                  longitude,
                  index % 6 === 0 ? OUTER_RADIUS - 10 : OUTER_RADIUS - 5,
                  wheelRotation
                );

                return (
                  <line
                    key={`tick-${index}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="rgba(31,31,31,0.1)"
                    strokeWidth={index % 6 === 0 ? 0.95 : 0.55}
                  />
                );
              })}

              {ZODIAC_ORDER.map((sign, index) => {
                const separator = polarPoint(index * 30, OUTER_RADIUS - 14, wheelRotation);
                const separatorOuter = polarPoint(index * 30, OUTER_RADIUS, wheelRotation);
                const labelPoint = polarPoint(index * 30 + 15, SIGN_RADIUS, wheelRotation);

                return (
                  <g key={sign}>
                    <line
                      x1={separator.x}
                      y1={separator.y}
                      x2={separatorOuter.x}
                      y2={separatorOuter.y}
                      stroke="rgba(31,31,31,0.14)"
                      strokeWidth="0.9"
                    />
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(136,127,115,0.9)"
                      style={{
                        fontFamily: ASTRO_FONT_STACK,
                        fontSize: 13.2,
                        letterSpacing: '0',
                        fontWeight: 400,
                      }}
                    >
                      {ZODIAC_SYMBOLS[sign]}
                    </text>
                  </g>
                );
              })}

              {houseCusps.map((house) => {
                const outer = polarPoint(house.longitude, HOUSE_RADIUS, wheelRotation);
                const inner = polarPoint(house.longitude, 40, wheelRotation);
                const emphatic = house.house === 1 || house.house === 4 || house.house === 7 || house.house === 10;

                return (
                  <g key={`house-${house.house}`}>
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke={emphatic ? 'rgba(31,31,31,0.17)' : 'rgba(31,31,31,0.07)'}
                      strokeWidth={emphatic ? 1 : 0.68}
                    />
                  </g>
                );
              })}

              {houseLabels.map((house) => {
                const labelPoint = polarPoint(house.longitude, HOUSE_LABEL_RADIUS, wheelRotation);

                return (
                  <text
                    key={`house-label-${house.house}`}
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(31,31,31,0.34)"
                    style={{ fontSize: 7.4, fontWeight: 500, letterSpacing: '0.02em' }}
                  >
                    {house.house}
                  </text>
                );
              })}

              {aspectLines.map((aspect, index) => {
                const fromPoint = polarPoint(aspect.from.longitude, ASPECT_RADIUS, wheelRotation);
                const toPoint = polarPoint(aspect.to.longitude, ASPECT_RADIUS, wheelRotation);
                const opacity =
                  aspect.type === 'opposition'
                    ? 0.12
                    : aspect.type === 'square'
                      ? 0.11
                      : aspect.type === 'trine'
                        ? 0.1
                        : 0.08;

                return (
                  <motion.line
                    key={`aspect-${aspect.from.key}-${aspect.to.key}-${index}`}
                    x1={fromPoint.x}
                    y1={fromPoint.y}
                    x2={toPoint.x}
                    y2={toPoint.y}
                    stroke={`rgba(31,31,31,${opacity})`}
                    strokeWidth="0.72"
                    strokeDasharray={aspect.type === 'sextile' ? '2.2 3.4' : undefined}
                    initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                    animate={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0.18 : 0.82,
                      delay: shouldReduceMotion ? 0 : 0.16 + index * 0.035,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                );
              })}

              {placements.map((placement, index) => {
                const anchorPoint = polarPoint(placement.longitude, PLANET_BASE_RADIUS, wheelRotation);
                const markerPoint = polarPoint(placement.longitude, placement.orbitRadius, wheelRotation);
                const isPrimary = PRIMARY_KEYS.includes(placement.key);
                const markerGlyph = placement.key === 'rising' ? 'ASC' : placement.symbol;

                return (
                  <motion.g
                    key={placement.key}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.88 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    transition={{
                      duration: shouldReduceMotion ? 0.18 : 0.42,
                      delay: shouldReduceMotion ? 0 : 0.22 + index * 0.03,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <line
                      x1={anchorPoint.x}
                      y1={anchorPoint.y}
                      x2={markerPoint.x}
                      y2={markerPoint.y}
                      stroke={isPrimary ? 'rgba(31,31,31,0.24)' : 'rgba(31,31,31,0.14)'}
                      strokeWidth={isPrimary ? 1 : 0.85}
                    />
                    <circle cx={anchorPoint.x} cy={anchorPoint.y} r={isPrimary ? 2.4 : 2} fill="rgba(31,31,31,0.42)" />
                    <circle
                      cx={markerPoint.x}
                      cy={markerPoint.y}
                      r={isPrimary ? 15 : 12.4}
                      fill={isPrimary ? 'rgba(255,252,248,0.99)' : 'rgba(252,249,244,0.99)'}
                      stroke={isPrimary ? 'rgba(107,92,68,0.22)' : 'rgba(176,158,131,0.26)'}
                      strokeWidth="0.95"
                    />
                    {!isPrimary ? (
                      <circle
                        cx={markerPoint.x}
                        cy={markerPoint.y}
                        r="8"
                        fill="rgba(247,240,230,0.94)"
                      />
                    ) : null}
                    <text
                      x={markerPoint.x}
                      y={markerPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="rgba(44,39,33,0.96)"
                      style={{
                        fontFamily: ASTRO_FONT_STACK,
                        fontSize: markerGlyph.length > 2 ? (isPrimary ? 6.7 : 5.9) : isPrimary ? 12.9 : 10.7,
                        fontWeight: 400,
                        letterSpacing: markerGlyph.length > 2 ? '0.03em' : '0',
                      }}
                    >
                      {markerGlyph}
                    </text>
                  </motion.g>
                );
              })}

              {primaryPlacements.map((placement, index) => {
                const slot = PRIMARY_CALLOUT_SLOTS[placement.key];
                const markerPoint = polarPoint(placement.longitude, placement.orbitRadius, wheelRotation);
                const textOffset =
                  slot.anchor === 'start' ? 12 : slot.anchor === 'end' ? -12 : 0;

                return (
                  <motion.g
                    key={`callout-${placement.key}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: placement.key === 'rising' ? 6 : -6 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0.18 : 0.48,
                      delay: shouldReduceMotion ? 0 : 0.36 + index * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <path
                      d={`M ${markerPoint.x} ${markerPoint.y} L ${slot.connectorX} ${slot.connectorY} L ${slot.x} ${slot.y}`}
                      fill="none"
                      stroke="rgba(31,31,31,0.16)"
                      strokeWidth="0.95"
                    />
                    <circle cx={slot.connectorX} cy={slot.connectorY} r="2.3" fill="rgba(31,31,31,0.22)" />
                    <text
                      x={slot.x + textOffset}
                      y={slot.y}
                      textAnchor={slot.anchor}
                      fill="rgba(31,31,31,0.58)"
                      style={{ fontSize: 8.4, letterSpacing: '0.12em', fontWeight: 600 }}
                    >
                      {placement.label[language].toUpperCase()}
                    </text>
                    <text
                      x={slot.x + textOffset}
                      y={slot.y + 14}
                      textAnchor={slot.anchor}
                      fill="#1f1f1f"
                      style={{ fontSize: 11.5, fontWeight: 600 }}
                    >
                      {placement.signLabel}
                      {placement.degreeLabel ? ` ${placement.degreeLabel}` : ''}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </motion.div>

          <AnimatePresence initial={false}>
            {isInfoOpen ? (
              <motion.p
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                transition={{ duration: shouldReduceMotion ? 0.18 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto max-w-[18.5rem] pt-2 text-center text-[11px] leading-[1.6] text-text-main/74"
              >
                {getInfoText(language)}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-x-3 gap-y-4 px-1">
          {primaryPlacements.map((placement) => (
            <div key={`primary-${placement.key}`} className="min-h-[5.6rem] min-w-0 text-center">
              <span
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(156,140,113,0.14)] bg-[rgba(247,241,233,0.92)] text-[#1f1f1f]"
                style={{
                  fontFamily: ASTRO_FONT_STACK,
                  fontSize: placement.key === 'rising' ? '11px' : '17px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.025)',
                }}
              >
                {placement.key === 'rising' ? 'ASC' : placement.symbol}
              </span>
              <span className="mt-1.5 block text-[9px] uppercase tracking-[0.16em] text-text-muted/82">
                {placement.label[language]}
              </span>
              <span className="mt-1 block min-h-[2rem] text-[13px] font-medium leading-[1.15] text-text-main">
                {placement.signLabel}
              </span>
              {placement.degreeLabel ? (
                <span className="mt-0.5 block text-[10px] leading-none text-text-muted/78">
                  {placement.degreeLabel}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {secondaryPlacements.length ? (
          <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-4 px-2 pt-0.5">
            {secondaryPlacements.map((placement) => (
              <div
                key={`secondary-${placement.key}`}
                className="min-h-[4.95rem] min-w-[4.15rem] max-w-[4.5rem] flex-1 basis-[4.15rem] text-center"
              >
                <span
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(156,140,113,0.12)] bg-[rgba(248,243,236,0.94)] text-[#1f1f1f]"
                  style={{
                    fontFamily: ASTRO_FONT_STACK,
                    fontSize: placement.key === 'rising' ? '9px' : '13px',
                  }}
                >
                  {placement.key === 'rising' ? 'ASC' : placement.symbol}
                </span>
                <span className="mt-1 block text-[8px] uppercase tracking-[0.14em] text-text-muted/78">
                  {placement.label[language]}
                </span>
                <span className="mt-1 block min-h-[1.65rem] text-[11px] font-medium leading-tight text-text-main">
                  {placement.shortSignLabel}
                </span>
                {placement.degreeLabel ? (
                  <span className="mt-0.5 block text-[9px] leading-none text-text-muted/72">
                    {placement.degreeLabel}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <LumiaButton className="min-h-[48px] w-full" variant="primary" onClick={onOpenChart}>
          {getText(language, 'dashboard.natal_preview_cta')}
        </LumiaButton>
      </div>
    );
  }
);

TrueNatalWheelHero.displayName = 'TrueNatalWheelHero';
