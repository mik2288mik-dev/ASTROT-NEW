import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getZodiacSign } from '../../constants';
import type { Language, NatalAspectData, NatalChartData, NatalHouseData, PlanetInsight, UserProfile } from '../../types';
import { buildPlanetInsight } from '../../lib/planetInsightContent';
import {
  getPlanetDisplayName,
  getPlanetMeta,
  getPlanetPositionFromChart,
  normalizePlanetKey,
  PLANET_COLLISION_RADII,
  HOUSE_DOTTED_RADIUS,
  HOUSE_RING_RADIUS,
  INNER_CENTER_RADIUS,
  NATAL_PLANET_ORDER,
  OUTER_RIM_RADIUS,
  WHEEL_CENTER,
  WHEEL_VIEWBOX,
  type NatalPlanetKey,
} from '../../lib/natalWheel';
import { ZODIAC_SIGNS, type ZodiacSign } from '../../lib/zodiac-utils';
import { getCachedPlanetInsight, getPlanetInsight } from '../../services/astrologyService';
import { PlanetSymbolIcon } from './AstroWheelIcons';

const HOUSE_LABEL_RADIUS = 61;
const PLANET_TOUCH_RADIUS = 24;
const LEADER_LINE_TARGET_RADIUS = 98;
const INTRO_TOTAL_MS = 760;
const ZODIAC_LABEL_RADIUS = OUTER_RIM_RADIUS - 9;
const WHEEL_MEDALLION_SRC = '/brand/natal-wheel-luxe-medallion.svg';
const HOLD_DURATION_MS = 920;
const PREVIEW_BODY_MAX = 188;

const MAJOR_ASPECTS: NatalAspectData['type'][] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];
const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);

type DisplayPlanet = {
  key: NatalPlanetKey;
  rawLongitude: number;
  displayRadius: number;
  visualRadius: number;
  label: string;
  sign: string;
  degree: number | null;
  house: number | null;
  retrograde: boolean;
  lineTargetRadius: number | null;
};

type WheelAspectLine = {
  id: string;
  type: NatalAspectData['type'];
  orb: number;
  from: DisplayPlanet;
  to: DisplayPlanet;
};

type InsightState = {
  status: 'idle' | 'loading' | 'ready';
  planetId: NatalPlanetKey | null;
  content: PlanetInsight | null;
  isFallback: boolean;
};

type TrueNatalWheelHeroProps = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  shouldAnimateIntro?: boolean;
  onIntroComplete?: () => void;
  onOpenChart: () => void;
};

const aspectStyles: Record<NatalAspectData['type'], { stroke: string; width: number; dash?: string }> = {
  conjunction: { stroke: '#A287D4', width: 1.06 },
  opposition: { stroke: '#E17366', width: 0.84 },
  square: { stroke: '#E17366', width: 0.74 },
  trine: { stroke: '#60B189', width: 0.82 },
  sextile: { stroke: '#79A8F9', width: 0.68 },
};

const normalizeDegrees = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const toRadians = (degree: number) => ((degree - 90) * Math.PI) / 180;

const polarPoint = (degree: number, radius: number) => ({
  x: WHEEL_CENTER + Math.cos(toRadians(degree)) * radius,
  y: WHEEL_CENTER + Math.sin(toRadians(degree)) * radius,
});

const midpointDegree = (start: number, end: number) => {
  const normalizedStart = normalizeDegrees(start);
  const span = normalizeDegrees(end - normalizedStart);
  return normalizeDegrees(normalizedStart + span / 2);
};

const angularDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

function resolveLongitude(position: { longitude?: number; sign?: string; degree?: number } | null | undefined) {
  if (!position) return null;
  if (typeof position.longitude === 'number' && Number.isFinite(position.longitude)) {
    return normalizeDegrees(position.longitude);
  }
  const signIndex = ZODIAC_SIGNS.indexOf(String(position.sign || '') as ZodiacSign);
  if (signIndex < 0) return null;
  return normalizeDegrees(signIndex * 30 + (typeof position.degree === 'number' ? position.degree : 0));
}

function resolveHouseLongitude(house: NatalHouseData) {
  if (typeof house.longitude === 'number' && Number.isFinite(house.longitude)) {
    return normalizeDegrees(house.longitude);
  }
  const signIndex = ZODIAC_SIGNS.indexOf(String(house.sign || '') as ZodiacSign);
  return normalizeDegrees(Math.max(signIndex, 0) * 30 + (house.degree || 0));
}

function buildFallbackHouseCusps(chartData: NatalChartData): NatalHouseData[] {
  const risingLongitude = resolveLongitude(chartData.rising) ?? 180;
  return Array.from({ length: 12 }, (_, index) => {
    const longitude = normalizeDegrees(risingLongitude + index * 30);
    const signIndex = Math.floor(longitude / 30) % 12;
    return { house: index + 1, sign: ZODIAC_SIGNS[signIndex], degree: longitude % 30, longitude };
  });
}

const formatDegree = (degree: number | null) => (degree == null ? '—' : `${Math.round(degree)}°`);

const formatSignAndDegree = (language: Language, sign: string, degree: number | null) =>
  `${getZodiacSign(language, sign)} ${formatDegree(degree)}`;

function previewText(body: string, maxLength = PREVIEW_BODY_MAX) {
  const normalized = String(body || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const firstTwo = normalized.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim();
  if (firstTwo && firstTwo.length <= maxLength + 28) return firstTwo;
  const slice = normalized.slice(0, maxLength).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const safeCut = lastSpace > Math.floor(maxLength * 0.65) ? lastSpace : maxLength;
  return `${slice.slice(0, safeCut).trim()}…`;
}

const buildIdleHint = (language: Language) =>
  language === 'en'
    ? 'Tap a planet to feel how it sounds in your chart.'
    : 'Нажми на планету, чтобы почувствовать, как она звучит в твоей карте.';

const buildHoldHint = (language: Language) =>
  language === 'en'
    ? 'Hold the wheel to open your full natal card.'
    : 'Удерживай круг, чтобы открыть полную натальную карту.';

const getChipRadius = (planet: NatalPlanetKey) => {
  if (planet === 'sun') return 11.2;
  if (planet === 'moon' || planet === 'rising') return 10.2;
  return 8.3;
};

const getZodiacLongLabel = (language: Language, sign: ZodiacSign) => getZodiacSign(language, sign).toUpperCase();

const renderPlanetIcon = (planet: NatalPlanetKey, x: number, y: number, size: number, color: string) => (
  <PlanetSymbolIcon
    planet={planet}
    x={x - size / 2}
    y={y - size / 2}
    width={size}
    height={size}
    stroke={color}
    strokeWidth={1.72}
  />
);

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId, shouldAnimateIntro = false, onIntroComplete, onOpenChart }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [selectedPlanet, setSelectedPlanet] = useState<NatalPlanetKey | null>(null);
    const [insightState, setInsightState] = useState<InsightState>({
      status: 'idle',
      planetId: null,
      content: null,
      isFallback: false,
    });
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);

    const holdFrameRef = useRef<number | null>(null);
    const holdPointerIdRef = useRef<number | null>(null);
    const holdStartRef = useRef(0);
    const holdTriggeredRef = useRef(false);
    const latestInsightRequestRef = useRef(0);
    const insightCacheRef = useRef<Partial<Record<NatalPlanetKey, PlanetInsight>>>({});

    const introEnabled = shouldAnimateIntro && !shouldReduceMotion;
    const introTransition = shouldReduceMotion
      ? { duration: 0.22 }
      : { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    useEffect(() => {
      if (!introEnabled || !onIntroComplete) return;
      const timer = window.setTimeout(() => onIntroComplete(), INTRO_TOTAL_MS);
      return () => window.clearTimeout(timer);
    }, [introEnabled, onIntroComplete]);

    const stopHoldLoop = useCallback(() => {
      if (holdFrameRef.current != null) {
        cancelAnimationFrame(holdFrameRef.current);
        holdFrameRef.current = null;
      }
    }, []);

    useEffect(() => () => stopHoldLoop(), [stopHoldLoop]);

    const houseCusps = useMemo(() => {
      const base =
        Array.isArray(chartData.houses) && chartData.houses.length >= 12
          ? [...chartData.houses].sort((a, b) => a.house - b.house)
          : buildFallbackHouseCusps(chartData);
      return base.map((house) => ({ house: house.house, rawLongitude: resolveHouseLongitude(house) }));
    }, [chartData]);

    const ascDegree = useMemo(() => resolveLongitude(chartData.rising) ?? 180, [chartData.rising]);
    const wheelRotationDeg = useMemo(() => -(ascDegree - 180), [ascDegree]);

    const houseLabels = useMemo(
      () =>
        houseCusps.map((house, index) => {
          const nextHouse = houseCusps[(index + 1) % houseCusps.length];
          return { house: house.house, rawLongitude: midpointDegree(house.rawLongitude, nextHouse.rawLongitude) };
        }),
      [houseCusps]
    );

    const displayPlanets = useMemo<DisplayPlanet[]>(() => {
      const planets = NATAL_PLANET_ORDER.map((planetKey) => {
        const position = getPlanetPositionFromChart(chartData, planetKey);
        const rawLongitude = resolveLongitude(position);
        if (rawLongitude == null || !position) return null;

        const house =
          typeof position.house === 'number'
            ? position.house
            : typeof position.house === 'string' && position.house.trim()
              ? Number(position.house)
              : null;

        return {
          key: planetKey,
          rawLongitude,
          displayRadius: PLANET_COLLISION_RADII[0],
          visualRadius: getChipRadius(planetKey),
          label: getPlanetDisplayName(planetKey, language),
          sign: position.sign,
          degree: typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : null,
          house: Number.isFinite(house) ? house : null,
          retrograde: !!position.retrograde,
          lineTargetRadius: null,
        } as DisplayPlanet;
      }).filter(Boolean) as DisplayPlanet[];

      const resolved: DisplayPlanet[] = [];
      [...planets].sort((a, b) => a.rawLongitude - b.rawLongitude).forEach((planet) => {
        let radiusIndex = 0;
        while (
          radiusIndex < PLANET_COLLISION_RADII.length - 1 &&
          resolved.some(
            (prev) =>
              prev.displayRadius === PLANET_COLLISION_RADII[radiusIndex] &&
              angularDistance(prev.rawLongitude, planet.rawLongitude) < 7
          )
        ) {
          radiusIndex += 1;
        }

        const displayRadius = PLANET_COLLISION_RADII[radiusIndex];
        resolved.push({
          ...planet,
          displayRadius,
          lineTargetRadius: displayRadius !== PLANET_COLLISION_RADII[0] ? LEADER_LINE_TARGET_RADIUS : null,
        });
      });

      return resolved.sort((a, b) => getPlanetMeta(a.key).order - getPlanetMeta(b.key).order);
    }, [chartData, language]);

    const displayPlanetMap = useMemo(() => new Map(displayPlanets.map((planet) => [planet.key, planet])), [displayPlanets]);

    const aspectLines = useMemo<WheelAspectLine[]>(() => {
      if (!Array.isArray(chartData.aspects)) return [];
      return chartData.aspects
        .filter((aspect) => MAJOR_ASPECTS.includes(aspect.type))
        .map((aspect) => {
          const fromKey = normalizePlanetKey(aspect.from);
          const toKey = normalizePlanetKey(aspect.to);
          if (!fromKey || !toKey || fromKey === toKey) return null;
          const from = displayPlanetMap.get(fromKey);
          const to = displayPlanetMap.get(toKey);
          if (!from || !to) return null;
          return { id: `${fromKey}-${toKey}-${aspect.type}`, type: aspect.type, orb: aspect.orb, from, to };
        })
        .filter(Boolean) as WheelAspectLine[];
    }, [chartData.aspects, displayPlanetMap]);

    const selectedAspectLines = useMemo(() => {
      if (!selectedPlanet) return [];
      return aspectLines.filter((aspect) => aspect.from.key === selectedPlanet || aspect.to.key === selectedPlanet);
    }, [aspectLines, selectedPlanet]);

    const fetchInsightForPlanet = useCallback(
      async (planetKey: NatalPlanetKey) => {
        const cachedLocal = insightCacheRef.current[planetKey];
        if (cachedLocal) {
          setInsightState({ status: 'ready', planetId: planetKey, content: cachedLocal, isFallback: false });
          return;
        }

        const fallbackInsight = buildPlanetInsight(chartData, planetKey, language);
        if (!profile.id) {
          setInsightState({ status: 'ready', planetId: planetKey, content: fallbackInsight, isFallback: true });
          return;
        }

        const requestId = latestInsightRequestRef.current + 1;
        latestInsightRequestRef.current = requestId;
        setInsightState({ status: 'loading', planetId: planetKey, content: null, isFallback: false });

        try {
          const cached = await getCachedPlanetInsight(String(profile.id), planetKey, language, chartId);
          if (cached && latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[planetKey] = cached;
            setInsightState({ status: 'ready', planetId: planetKey, content: cached, isFallback: false });
            return;
          }
        } catch {
          // Continue to generation.
        }

        try {
          const insight = await getPlanetInsight(profile, chartData, planetKey, chartId);
          insightCacheRef.current[planetKey] = insight;
          if (latestInsightRequestRef.current === requestId) {
            setInsightState({ status: 'ready', planetId: planetKey, content: insight, isFallback: false });
          }
        } catch {
          if (latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[planetKey] = fallbackInsight;
            setInsightState({ status: 'ready', planetId: planetKey, content: fallbackInsight, isFallback: true });
          }
        }
      },
      [chartData, chartId, language, profile]
    );

    const activatePlanet = useCallback(
      (planetKey: NatalPlanetKey) => {
        setSelectedPlanet(planetKey);
        void fetchInsightForPlanet(planetKey);
      },
      [fetchInsightForPlanet]
    );

    const beginHold = useCallback(
      (pointerId: number) => {
        stopHoldLoop();
        holdPointerIdRef.current = pointerId;
        holdStartRef.current = performance.now();
        holdTriggeredRef.current = false;
        setIsHolding(true);
        setHoldProgress(0);

        const tick = (now: number) => {
          const progress = Math.min((now - holdStartRef.current) / HOLD_DURATION_MS, 1);
          setHoldProgress(progress);
          if (progress >= 1) {
            holdTriggeredRef.current = true;
            setIsHolding(false);
            setHoldProgress(1);
            holdFrameRef.current = null;
            onOpenChart();
            return;
          }
          holdFrameRef.current = requestAnimationFrame(tick);
        };

        holdFrameRef.current = requestAnimationFrame(tick);
      },
      [onOpenChart, stopHoldLoop]
    );

    const cancelHold = useCallback(() => {
      stopHoldLoop();
      holdPointerIdRef.current = null;
      holdTriggeredRef.current = false;
      setIsHolding(false);
      setHoldProgress(0);
    }, [stopHoldLoop]);

    const handleWheelPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('[data-planet-touch=\"true\"]')) return;
        beginHold(event.pointerId);
      },
      [beginHold]
    );

    const handleWheelPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (holdPointerIdRef.current !== event.pointerId) return;
        if (!holdTriggeredRef.current) cancelHold();
      },
      [cancelHold]
    );

    const handleWheelPointerCancel = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (holdPointerIdRef.current !== event.pointerId) return;
        cancelHold();
      },
      [cancelHold]
    );

    const selectedPlanetMeta = selectedPlanet ? getPlanetMeta(selectedPlanet) : null;
    const selectedPlanetData = selectedPlanet ? displayPlanetMap.get(selectedPlanet) || null : null;
    const selectedInsight = insightState.content;
    const holdCircumference = 2 * Math.PI * (OUTER_RIM_RADIUS - 1.5);

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[20.25rem]">
              <div
                className="relative aspect-square w-full select-none"
                onPointerDown={handleWheelPointerDown}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerCancel}
                onPointerLeave={cancelHold}
              >
                <div className="pointer-events-none absolute inset-[2.5%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,205,102,0.20),rgba(70,103,164,0.12)_38%,rgba(255,255,255,0)_74%)] blur-[22px]" />

                <motion.div
                  className="relative h-full w-full"
                  initial={introEnabled ? { opacity: 0, scale: 0.986, y: 10 } : false}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={introTransition}
                >
                  <div className="absolute inset-0" style={{ transform: `rotate(${wheelRotationDeg}deg)` }}>
                    <img
                      src={WHEEL_MEDALLION_SRC}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                    />

                    <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="absolute inset-0 h-full w-full overflow-visible">
                      {ZODIAC_SIGNS.map((sign, index) => {
                        const labelDeg = index * 30 + 15;
                        const point = polarPoint(labelDeg, ZODIAC_LABEL_RADIUS);
                        const flip = labelDeg > 90 && labelDeg < 270;
                        const rotation = flip ? labelDeg + 270 : labelDeg + 90;
                        return (
                          <text
                            key={`sign-label-${sign}`}
                            x={point.x}
                            y={point.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${rotation} ${point.x} ${point.y})`}
                            fill="rgba(255,255,255,0.96)"
                            style={{ fontSize: 7.1, fontWeight: 700, letterSpacing: '0.12em' }}
                          >
                            {getZodiacLongLabel(language, sign as ZodiacSign)}
                          </text>
                        );
                      })}

                      {houseCusps.map((house, index) => {
                        const from = polarPoint(house.rawLongitude, INNER_CENTER_RADIUS + 1.5);
                        const to = polarPoint(house.rawLongitude, HOUSE_RING_RADIUS - 2);
                        const emphatic = ANGULAR_HOUSES.has(house.house);
                        return (
                          <motion.line
                            key={`house-line-${house.house}-${index}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke={emphatic ? 'rgba(255,255,255,0.78)' : 'rgba(215,230,251,0.36)'}
                            strokeWidth={emphatic ? 0.96 : 0.48}
                            initial={introEnabled ? { pathLength: 0, opacity: 0 } : false}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ ...introTransition, delay: introEnabled ? 0.16 : 0 }}
                          />
                        );
                      })}

                      {houseLabels
                        .filter((house) => ANGULAR_HOUSES.has(house.house))
                        .map((house) => {
                          const point = polarPoint(house.rawLongitude, HOUSE_LABEL_RADIUS);
                          return (
                            <text
                              key={`house-label-${house.house}`}
                              x={point.x}
                              y={point.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(249,252,255,0.68)"
                              style={{ fontSize: 8, fontWeight: 600 }}
                            >
                              {house.house}
                            </text>
                          );
                        })}

                      {selectedAspectLines.map((aspect) => {
                        const style = aspectStyles[aspect.type];
                        const from = polarPoint(aspect.from.rawLongitude, aspect.from.displayRadius);
                        const to = polarPoint(aspect.to.rawLongitude, aspect.to.displayRadius);
                        return (
                          <motion.line
                            key={aspect.id}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke={style.stroke}
                            strokeWidth={style.width + (aspect.orb < 1 ? 0.14 : 0)}
                            strokeDasharray={style.dash}
                            opacity={0.7}
                            initial={introEnabled ? { opacity: 0 } : false}
                            animate={{ opacity: 0.7 }}
                            transition={{ ...introTransition, delay: introEnabled ? 0.46 : 0 }}
                          />
                        );
                      })}

                      {displayPlanets.map((planet) => {
                        if (planet.lineTargetRadius == null) return null;
                        const from = polarPoint(planet.rawLongitude, planet.displayRadius + Math.max(planet.visualRadius - 1.2, 8));
                        const to = polarPoint(planet.rawLongitude, planet.lineTargetRadius);
                        return (
                          <line
                            key={`leader-${planet.key}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="rgba(223,233,248,0.62)"
                            strokeWidth="0.72"
                            strokeDasharray="2 2.3"
                          />
                        );
                      })}

                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={HOUSE_DOTTED_RADIUS} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.74" strokeDasharray="2 4" />
                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={INNER_CENTER_RADIUS} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.32)" strokeWidth="0.6" />
                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={2.7} fill="rgba(255,255,255,0.82)" />

                      {displayPlanets.map((planet, index) => {
                        const meta = getPlanetMeta(planet.key);
                        const point = polarPoint(planet.rawLongitude, planet.displayRadius);
                        const active = selectedPlanet === planet.key;
                        const iconSize = planet.visualRadius * 1.1;
                        return (
                          <g key={planet.key}>
                            {active ? (
                              <motion.circle
                                cx={point.x}
                                cy={point.y}
                                r={planet.visualRadius + 4.6}
                                fill="none"
                                stroke={`${meta.color}42`}
                                strokeWidth="3"
                                initial={false}
                                animate={{ opacity: [0.54, 0.94, 0.54] }}
                                transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                              />
                            ) : null}

                            <motion.circle
                              cx={point.x}
                              cy={point.y}
                              r={planet.visualRadius}
                              fill="rgba(255,255,255,0.98)"
                              stroke={meta.color}
                              strokeWidth={active ? 1.56 : 1.1}
                              style={{ filter: 'drop-shadow(0 2px 6px rgba(12,24,52,0.18))' }}
                              initial={introEnabled ? { opacity: 0, scale: 0.82 } : false}
                              animate={{ opacity: 1, scale: active ? 1.05 : 1 }}
                              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: introEnabled ? 0.24 + index * 0.05 : 0 }}
                            />

                            {renderPlanetIcon(planet.key, point.x, point.y, iconSize, meta.color)}

                            {planet.retrograde ? (
                              <>
                                <circle cx={point.x + planet.visualRadius - 0.4} cy={point.y - planet.visualRadius + 0.5} r={3.7} fill="white" stroke="#F6D9D8" strokeWidth="0.56" />
                                <text x={point.x + planet.visualRadius - 0.4} y={point.y - planet.visualRadius + 0.5} textAnchor="middle" dominantBaseline="middle" fill="#E53935" style={{ fontSize: 5.7, fontWeight: 700 }}>R</text>
                              </>
                            ) : null}

                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={PLANET_TOUCH_RADIUS}
                              fill="transparent"
                              data-planet-touch="true"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                cancelHold();
                              }}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                activatePlanet(planet.key);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,252,203,0.34),rgba(255,192,79,0.18)_46%,rgba(255,255,255,0)_74%)]"
                    animate={shouldReduceMotion ? { opacity: 0.88, scale: 1 } : { opacity: [0.78, 0.95, 0.78], scale: [1, 1.032, 1] }}
                    transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 5.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                  />

                  <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="pointer-events-none absolute inset-0 h-full w-full">
                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={OUTER_RIM_RADIUS - 1.5}
                      fill="none"
                      stroke="rgba(123,94,167,0.36)"
                      strokeWidth="2.2"
                      strokeDasharray={holdCircumference}
                      strokeDashoffset={holdCircumference * (1 - holdProgress)}
                      strokeLinecap="round"
                      opacity={isHolding || holdProgress > 0 ? 1 : 0}
                      transform={`rotate(-90 ${WHEEL_CENTER} ${WHEEL_CENTER})`}
                    />
                  </svg>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-3.5 w-full max-w-[20.5rem] px-1">
            <AnimatePresence mode="wait" initial={false}>
              {insightState.status === 'idle' || !selectedPlanet || !selectedPlanetMeta || !selectedPlanetData ? (
                <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} className="space-y-2.5 py-1 text-center">
                  <p className="mx-auto max-w-[18rem] text-[14px] leading-[1.72] text-text-main/78">{buildIdleHint(language)}</p>
                  <p className="mx-auto max-w-[18rem] text-[12px] leading-relaxed text-text-muted/78">{buildHoldHint(language)}</p>
                </motion.div>
              ) : insightState.status === 'loading' ? (
                <motion.div key="loading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} className="space-y-3 py-1">
                  <div className="flex items-center justify-center gap-3">
                    <div className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-full border bg-white" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <PlanetSymbolIcon planet={selectedPlanet} width={18} height={18} stroke={selectedPlanetMeta.color} strokeWidth={1.82} />
                    </div>
                    <div className="text-left">
                      <p className="text-[16px] font-medium text-text-main">{selectedPlanetData.label}</p>
                      <p className="text-[12.5px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedPlanetData.sign, selectedPlanetData.degree)}</p>
                    </div>
                  </div>
                  <div className="mx-auto flex w-fit items-center gap-2 text-[12px] text-text-muted">
                    <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/[0.08] border-t-[#7B5EA7]" />
                    {language === 'en' ? 'Preparing your insight…' : 'Собираем твой инсайт…'}
                  </div>
                  <div className="mx-auto max-w-[18rem] space-y-2">
                    <div className="h-3 rounded-full bg-black/[0.04]" />
                    <div className="h-3 w-[90%] rounded-full bg-black/[0.035]" />
                    <div className="h-3 w-[73%] rounded-full bg-black/[0.03]" />
                  </div>
                </motion.div>
              ) : (
                <motion.div key={selectedPlanet} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24 }} className="space-y-3 py-1">
                  <div className="flex items-center justify-center gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={selectedPlanetMeta.color} strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[17px] font-medium text-text-main">{selectedInsight?.title}</p>
                      <p className="text-[12.5px] text-[#7B5EA7]">
                        {selectedInsight ? formatSignAndDegree(language, selectedInsight.sign, selectedInsight.degree) : ''}
                        {selectedInsight?.house ? ` · ${language === 'en' ? `House ${selectedInsight.house}` : `${selectedInsight.house} дом`}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="mx-auto max-w-[18.5rem] text-center text-[14.5px] leading-[1.74] text-text-main/84">{previewText(selectedInsight?.body || '')}</p>
                  <p className="mx-auto max-w-[18rem] text-center text-[12px] leading-relaxed text-text-muted/76">{buildHoldHint(language)}</p>
                  {insightState.isFallback ? (
                    <button type="button" onClick={() => { if (selectedPlanet) void fetchInsightForPlanet(selectedPlanet); }} className="mx-auto block text-[12px] font-medium text-[#7B5EA7]">
                      {language === 'en' ? 'Refresh this text' : 'Обновить этот текст'}
                    </button>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }
);

TrueNatalWheelHero.displayName = 'TrueNatalWheelHero';
