import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getZodiacSign } from '../../constants';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  NatalHouseData,
  UserProfile,
  WheelInsight,
  WheelInsightEntityType,
} from '../../types';
import {
  buildAspectEntityId,
  buildWheelInsight,
  resolveWheelInsightRequest,
} from '../../lib/wheelInsightContent';
import {
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
import { getCachedWheelInsight, getWheelInsight } from '../../services/astrologyService';
import { PlanetSymbolIcon, ZodiacIllustrationIcon } from './AstroWheelIcons';

const INTRO_TOTAL_MS = 760;
const HOLD_DURATION_MS = 920;
const WHEEL_MEDALLION_SRC = '/brand/natal-wheel-luxe-medallion.svg';
const PLANET_TOUCH_RADIUS = 24;
const LEADER_LINE_TARGET_RADIUS = 98;
const HOUSE_LABEL_RADIUS = 60;
const ZODIAC_LABEL_RADIUS = 151;
const ZODIAC_HIT_INNER_RADIUS = 114;
const ZODIAC_HIT_OUTER_RADIUS = OUTER_RIM_RADIUS - 2;
const HOUSE_HIT_INNER_RADIUS = 28;
const HOUSE_HIT_OUTER_RADIUS = HOUSE_RING_RADIUS - 2;
const MAJOR_ASPECTS: NatalAspectData['type'][] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

type SelectedEntity = {
  entityType: WheelInsightEntityType;
  entityId: string;
};

type DisplayPlanet = {
  key: NatalPlanetKey;
  rawLongitude: number;
  displayRadius: number;
  visualRadius: number;
  sign: string;
  degree: number | null;
  house: number | null;
  retrograde: boolean;
  lineTargetRadius: number | null;
};

type WheelAspectLine = {
  entityId: string;
  type: NatalAspectData['type'];
  orb: number;
  from: DisplayPlanet;
  to: DisplayPlanet;
};

type HouseZone = {
  house: number;
  start: number;
  end: number;
  labelLongitude: number;
};

type InsightState = {
  status: 'idle' | 'loading' | 'ready';
  selection: SelectedEntity | null;
  content: WheelInsight | null;
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
  opposition: { stroke: '#E17366', width: 0.88 },
  square: { stroke: '#E17366', width: 0.78 },
  trine: { stroke: '#60B189', width: 0.86 },
  sextile: { stroke: '#79A8F9', width: 0.72 },
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

function buildIdleHint(language: Language) {
  return language === 'en'
    ? 'Tap a planet, zodiac sign, aspect line, or house to see what it means in your chart.'
    : 'Нажми на планету, знак, аспект или дом, чтобы увидеть, что именно он значит в твоей карте.';
}

function buildHoldHint(language: Language) {
  return language === 'en'
    ? 'Hold the wheel to open your full natal card.'
    : 'Удерживай круг, чтобы открыть полную натальную карту.';
}

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

function getChipRadius(planet: NatalPlanetKey) {
  if (planet === 'sun') return 10.7;
  if (planet === 'moon' || planet === 'rising') return 9.9;
  return 8.1;
}

function getZodiacLongLabel(language: Language, sign: ZodiacSign) {
  return getZodiacSign(language, sign).toUpperCase();
}

function getZodiacFontSize(label: string) {
  if (label.length >= 10) return 4.8;
  if (label.length >= 8) return 5.15;
  if (label.length >= 6) return 5.55;
  return 5.95;
}

function describeRingSegment(start: number, end: number, innerRadius: number, outerRadius: number) {
  const startOuter = polarPoint(start, outerRadius);
  const endOuter = polarPoint(end, outerRadius);
  const startInner = polarPoint(start, innerRadius);
  const endInner = polarPoint(end, innerRadius);
  const span = normalizeDegrees(end - start);
  const largeArc = span > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}

function buildSelectionKey(selection: SelectedEntity) {
  return `${selection.entityType}:${selection.entityId}`;
}

function EntityBadge({
  insight,
  selectedPlanet,
  color,
}: {
  insight: WheelInsight;
  selectedPlanet?: NatalPlanetKey | null;
  color: string;
}) {
  if (insight.entityType === 'planet' && selectedPlanet) {
    return (
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white" style={{ borderColor: color, color }}>
        <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={color} strokeWidth={1.88} />
      </div>
    );
  }

  if (insight.entityType === 'zodiac') {
    return (
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#5C73A6]">
        <ZodiacIllustrationIcon sign={insight.entityId as ZodiacSign} width={20} height={20} stroke="#5C73A6" strokeWidth={1.7} />
      </div>
    );
  }

  if (insight.entityType === 'house') {
    return (
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[15px] font-semibold text-[#7B5EA7]">
        {insight.entityId}
      </div>
    );
  }

  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] bg-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5 overflow-visible" fill="none">
        <circle cx="7" cy="16" r="2.7" fill="#7B5EA7" opacity="0.92" />
        <circle cx="17" cy="8" r="2.7" fill="#60B189" opacity="0.92" />
        <line x1="8.9" y1="14.3" x2="15.2" y2="9.8" stroke="#7B5EA7" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId, shouldAnimateIntro = false, onIntroComplete, onOpenChart }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
    const [insightState, setInsightState] = useState<InsightState>({
      status: 'idle',
      selection: null,
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
    const insightCacheRef = useRef<Record<string, WheelInsight>>({});

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
      return base.map((house) => ({
        house: house.house,
        rawLongitude: resolveHouseLongitude(house),
        sign: house.sign,
      }));
    }, [chartData]);

    const ascDegree = useMemo(() => resolveLongitude(chartData.rising) ?? 180, [chartData.rising]);
    const wheelRotationDeg = useMemo(() => -(ascDegree - 180), [ascDegree]);

    const houseZones = useMemo<HouseZone[]>(
      () =>
        houseCusps.map((house, index) => {
          const nextHouse = houseCusps[(index + 1) % houseCusps.length];
          return {
            house: house.house,
            start: house.rawLongitude,
            end: nextHouse.rawLongitude,
            labelLongitude: midpointDegree(house.rawLongitude, nextHouse.rawLongitude),
          };
        }),
      [houseCusps]
    );

    const displayPlanets = useMemo<DisplayPlanet[]>(() => {
      const planets = NATAL_PLANET_ORDER.map((planetKey) => {
        const position = chartData ? getPlanetPositionFromChart(chartData, planetKey) : null;
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
    }, [chartData]);

    const displayPlanetMap = useMemo(
      () => new Map(displayPlanets.map((planet) => [planet.key, planet])),
      [displayPlanets]
    );

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
          return {
            entityId: buildAspectEntityId(fromKey, toKey, aspect.type),
            type: aspect.type,
            orb: aspect.orb,
            from,
            to,
          };
        })
        .filter(Boolean) as WheelAspectLine[];
    }, [chartData.aspects, displayPlanetMap]);

    const selectedPlanetKey =
      selectedEntity?.entityType === 'planet' ? (selectedEntity.entityId as NatalPlanetKey) : null;
    const selectedZodiacSign =
      selectedEntity?.entityType === 'zodiac' ? (selectedEntity.entityId as ZodiacSign) : null;
    const selectedHouseNumber =
      selectedEntity?.entityType === 'house' ? Number.parseInt(selectedEntity.entityId, 10) : null;
    const selectedAspect =
      selectedEntity?.entityType === 'aspect'
        ? aspectLines.find((aspect) => aspect.entityId === selectedEntity.entityId) || null
        : null;

    const linkedAspectLines = useMemo(() => {
      if (selectedPlanetKey) {
        return aspectLines.filter((aspect) => aspect.from.key === selectedPlanetKey || aspect.to.key === selectedPlanetKey);
      }
      if (selectedAspect) {
        return [selectedAspect];
      }
      if (selectedZodiacSign) {
        return aspectLines.filter(
          (aspect) => aspect.from.sign === selectedZodiacSign && aspect.to.sign === selectedZodiacSign
        );
      }
      if (selectedHouseNumber != null) {
        return aspectLines.filter(
          (aspect) => aspect.from.house === selectedHouseNumber || aspect.to.house === selectedHouseNumber
        );
      }
      return [];
    }, [aspectLines, selectedAspect, selectedHouseNumber, selectedPlanetKey, selectedZodiacSign]);

    const selectionPreview = useMemo(() => {
      if (!selectedEntity) return null;
      try {
        const { request } = resolveWheelInsightRequest(
          chartData,
          selectedEntity.entityType,
          selectedEntity.entityId,
          language
        );
        return buildWheelInsight(chartData, request, language);
      } catch {
        return null;
      }
    }, [chartData, language, selectedEntity]);

    const fetchInsightForSelection = useCallback(
      async (selection: SelectedEntity) => {
        const cacheId = buildSelectionKey(selection);
        if (insightCacheRef.current[cacheId]) {
          setInsightState({
            status: 'ready',
            selection,
            content: insightCacheRef.current[cacheId],
            isFallback: false,
          });
          return;
        }

        let request;
        try {
          request = resolveWheelInsightRequest(chartData, selection.entityType, selection.entityId, language);
        } catch {
          return;
        }

        const fallbackInsight = buildWheelInsight(chartData, request.request, language);
        if (!profile.id) {
          insightCacheRef.current[cacheId] = fallbackInsight;
          setInsightState({ status: 'ready', selection, content: fallbackInsight, isFallback: true });
          return;
        }

        const requestId = latestInsightRequestRef.current + 1;
        latestInsightRequestRef.current = requestId;
        setInsightState({ status: 'loading', selection, content: fallbackInsight, isFallback: false });

        try {
          const cached = await getCachedWheelInsight(
            String(profile.id),
            selection.entityType,
            selection.entityId,
            language,
            chartId
          );
          if (cached && latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[cacheId] = cached;
            setInsightState({ status: 'ready', selection, content: cached, isFallback: false });
            return;
          }
        } catch {}

        try {
          const insight = await getWheelInsight(
            profile,
            chartData,
            selection.entityType,
            selection.entityId,
            chartId
          );
          insightCacheRef.current[cacheId] = insight;
          if (latestInsightRequestRef.current === requestId) {
            setInsightState({ status: 'ready', selection, content: insight, isFallback: false });
          }
        } catch {
          if (latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[cacheId] = fallbackInsight;
            setInsightState({ status: 'ready', selection, content: fallbackInsight, isFallback: true });
          }
        }
      },
      [chartData, chartId, language, profile]
    );

    const stopHoldAndPropagation = useCallback((event: React.PointerEvent<SVGElement>) => {
      event.stopPropagation();
      cancelHold();
    }, []);

    const activateSelection = useCallback(
      (selection: SelectedEntity) => {
        cancelHold();
        setSelectedEntity(selection);
        void fetchInsightForSelection(selection);
      },
      [fetchInsightForSelection]
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
        if ((event.target as HTMLElement).closest('[data-wheel-entity="true"]')) return;
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

    const holdCircumference = 2 * Math.PI * (OUTER_RIM_RADIUS - 1.5);
    const activeInsight = insightState.content || selectionPreview;
    const selectedPlanetMeta = selectedPlanetKey ? getPlanetMeta(selectedPlanetKey) : null;

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[22rem]">
              <div
                className="relative aspect-square w-full select-none"
                onPointerDown={handleWheelPointerDown}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerCancel}
                onPointerLeave={cancelHold}
              >
                <div className="pointer-events-none absolute inset-[1.5%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,197,89,0.14),rgba(62,96,170,0.12)_44%,rgba(255,255,255,0)_74%)] blur-[24px]" />
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
                        const start = index * 30;
                        const end = (index + 1) * 30;
                        const labelDeg = index * 30 + 15;
                        const label = getZodiacLongLabel(language, sign as ZodiacSign);
                        const point = polarPoint(labelDeg, ZODIAC_LABEL_RADIUS);
                        const flip = labelDeg > 90 && labelDeg < 270;
                        const rotation = flip ? labelDeg + 270 : labelDeg + 90;
                        const isActive = selectedZodiacSign === sign;
                        return (
                          <g key={`zodiac-${sign}`}>
                            {isActive ? (
                              <path
                                d={describeRingSegment(start, end, ZODIAC_HIT_INNER_RADIUS, ZODIAC_HIT_OUTER_RADIUS)}
                                fill="rgba(255,255,255,0.11)"
                                stroke="rgba(255,255,255,0.42)"
                                strokeWidth="0.8"
                              />
                            ) : null}
                            <text
                              x={point.x}
                              y={point.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${rotation} ${point.x} ${point.y})`}
                              fill={isActive ? 'rgba(255,244,214,1)' : 'rgba(255,255,255,0.94)'}
                              style={{ fontSize: getZodiacFontSize(label), fontWeight: 700, letterSpacing: '0.08em' }}
                            >
                              {label}
                            </text>
                            <path
                              d={describeRingSegment(start, end, ZODIAC_HIT_INNER_RADIUS, ZODIAC_HIT_OUTER_RADIUS)}
                              fill="transparent"
                              data-wheel-entity="true"
                              onPointerDown={stopHoldAndPropagation}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                activateSelection({ entityType: 'zodiac', entityId: sign });
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </g>
                        );
                      })}
                      {houseZones.map((house) => {
                        const point = polarPoint(house.labelLongitude, HOUSE_LABEL_RADIUS);
                        const isActive = selectedHouseNumber === house.house;
                        return (
                          <g key={`house-${house.house}`}>
                            {isActive ? (
                              <path
                                d={describeRingSegment(house.start, house.end, HOUSE_HIT_INNER_RADIUS, HOUSE_HIT_OUTER_RADIUS)}
                                fill="rgba(255,255,255,0.08)"
                                stroke="rgba(255,255,255,0.18)"
                                strokeWidth="0.6"
                              />
                            ) : null}
                            <text
                              x={point.x}
                              y={point.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill={isActive ? 'rgba(255,250,239,0.96)' : 'rgba(247,252,255,0.56)'}
                              style={{ fontSize: 7.2, fontWeight: 600 }}
                            >
                              {house.house}
                            </text>
                            <path
                              d={describeRingSegment(house.start, house.end, HOUSE_HIT_INNER_RADIUS, HOUSE_HIT_OUTER_RADIUS)}
                              fill="transparent"
                              data-wheel-entity="true"
                              onPointerDown={stopHoldAndPropagation}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                activateSelection({ entityType: 'house', entityId: String(house.house) });
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </g>
                        );
                      })}
                      {houseCusps.map((house) => {
                        const from = polarPoint(house.rawLongitude, INNER_CENTER_RADIUS + 1.5);
                        const to = polarPoint(house.rawLongitude, HOUSE_RING_RADIUS - 2);
                        return (
                          <motion.line
                            key={`house-line-${house.house}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke={selectedHouseNumber === house.house ? 'rgba(255,255,255,0.92)' : 'rgba(214,229,252,0.34)'}
                            strokeWidth={selectedHouseNumber === house.house ? 1.08 : house.house % 3 === 1 ? 0.86 : 0.48}
                            initial={introEnabled ? { pathLength: 0, opacity: 0 } : false}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ ...introTransition, delay: introEnabled ? 0.14 : 0 }}
                          />
                        );
                      })}
                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={HOUSE_DOTTED_RADIUS} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.7" strokeDasharray="2 4" />
                      {aspectLines.map((aspect) => {
                        const style = aspectStyles[aspect.type];
                        const from = polarPoint(aspect.from.rawLongitude, aspect.from.displayRadius);
                        const to = polarPoint(aspect.to.rawLongitude, aspect.to.displayRadius);
                        const active =
                          selectedAspect?.entityId === aspect.entityId ||
                          linkedAspectLines.some((item) => item.entityId === aspect.entityId);
                        const dimmed =
                          !!selectedEntity &&
                          !active &&
                          !(
                            selectedEntity.entityType === 'zodiac' &&
                            (aspect.from.sign === selectedZodiacSign || aspect.to.sign === selectedZodiacSign)
                          );
                        return (
                          <g key={aspect.entityId}>
                            <line
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke={style.stroke}
                              strokeWidth={active ? style.width + 0.38 : style.width}
                              strokeDasharray={style.dash}
                              opacity={active ? 0.82 : dimmed ? 0.08 : 0.18}
                            />
                            <line
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="transparent"
                              strokeWidth={12}
                              data-wheel-entity="true"
                              onPointerDown={stopHoldAndPropagation}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                activateSelection({ entityType: 'aspect', entityId: aspect.entityId });
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </g>
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
                            stroke="rgba(224,233,248,0.56)"
                            strokeWidth="0.72"
                            strokeDasharray="2 2.3"
                          />
                        );
                      })}
                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={INNER_CENTER_RADIUS} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.28)" strokeWidth="0.6" />
                      <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={2.6} fill="rgba(255,255,255,0.84)" />
                      {displayPlanets.map((planet, index) => {
                        const meta = getPlanetMeta(planet.key);
                        const point = polarPoint(planet.rawLongitude, planet.displayRadius);
                        const selectedByPlanet = selectedPlanetKey === planet.key;
                        const selectedByAspect = !!selectedAspect && (selectedAspect.from.key === planet.key || selectedAspect.to.key === planet.key);
                        const selectedByZodiac = selectedZodiacSign != null && planet.sign === selectedZodiacSign;
                        const selectedByHouse = selectedHouseNumber != null && planet.house === selectedHouseNumber;
                        const active = selectedByPlanet || selectedByAspect || selectedByZodiac || selectedByHouse;
                        const iconSize = planet.visualRadius * 1.12;
                        return (
                          <g key={planet.key}>
                            {active ? (
                              <motion.circle
                                cx={point.x}
                                cy={point.y}
                                r={planet.visualRadius + 4.5}
                                fill="none"
                                stroke={`${meta.color}55`}
                                strokeWidth="2.8"
                                initial={false}
                                animate={{ opacity: [0.46, 0.88, 0.46] }}
                                transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                              />
                            ) : null}
                            <motion.circle
                              cx={point.x}
                              cy={point.y}
                              r={planet.visualRadius}
                              fill="rgba(255,255,255,0.985)"
                              stroke={meta.color}
                              strokeWidth={active ? 1.52 : 1.04}
                              style={{ filter: 'drop-shadow(0 2px 6px rgba(12,24,52,0.18))' }}
                              initial={introEnabled ? { opacity: 0, scale: 0.82 } : false}
                              animate={{ opacity: 1, scale: active ? 1.04 : 1 }}
                              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: introEnabled ? 0.22 + index * 0.04 : 0 }}
                            />
                            <PlanetSymbolIcon
                              planet={planet.key}
                              x={point.x - iconSize / 2}
                              y={point.y - iconSize / 2}
                              width={iconSize}
                              height={iconSize}
                              stroke={meta.color}
                              strokeWidth={1.7}
                            />
                            {planet.retrograde ? (
                              <>
                                <circle cx={point.x + planet.visualRadius - 0.3} cy={point.y - planet.visualRadius + 0.5} r={3.6} fill="white" stroke="#F6D9D8" strokeWidth="0.56" />
                                <text x={point.x + planet.visualRadius - 0.3} y={point.y - planet.visualRadius + 0.5} textAnchor="middle" dominantBaseline="middle" fill="#E53935" style={{ fontSize: 5.6, fontWeight: 700 }}>
                                  R
                                </text>
                              </>
                            ) : null}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={PLANET_TOUCH_RADIUS}
                              fill="transparent"
                              data-wheel-entity="true"
                              onPointerDown={stopHoldAndPropagation}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                activateSelection({ entityType: 'planet', entityId: planet.key });
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
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,252,203,0.26),rgba(255,186,62,0.18)_48%,rgba(255,255,255,0)_76%)]"
                    animate={shouldReduceMotion ? { opacity: 0.84, scale: 1 } : { opacity: [0.74, 0.92, 0.74], scale: [1, 1.028, 1] }}
                    transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 6.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                  />
                  <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="pointer-events-none absolute inset-0 h-full w-full">
                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={OUTER_RIM_RADIUS - 1.5}
                      fill="none"
                      stroke="rgba(123,94,167,0.34)"
                      strokeWidth="2.1"
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
          <div className="mx-auto mt-3.5 w-full max-w-[21rem] px-1">
            <AnimatePresence mode="wait" initial={false}>
              {!activeInsight || insightState.status === 'idle' ? (
                <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} className="space-y-2.5 py-1 text-center">
                  <p className="mx-auto max-w-[18.8rem] text-[14px] leading-[1.72] text-text-main/78">{buildIdleHint(language)}</p>
                  <p className="mx-auto max-w-[18rem] text-[12px] leading-relaxed text-text-muted/78">{buildHoldHint(language)}</p>
                </motion.div>
              ) : insightState.status === 'loading' ? (
                <motion.div key={`loading-${activeInsight.entityType}-${activeInsight.entityId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} className="space-y-3 py-1 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <EntityBadge insight={activeInsight} selectedPlanet={selectedPlanetKey} color={selectedPlanetMeta?.color || '#7B5EA7'} />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[17px] font-medium text-text-main">{activeInsight.title}</p>
                      <p className="text-[12.5px] text-[#7B5EA7]">{activeInsight.subtitle}</p>
                    </div>
                  </div>
                  <div className="mx-auto flex w-fit items-center gap-2 text-[12px] text-text-muted">
                    <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/[0.08] border-t-[#7B5EA7]" />
                    {language === 'en' ? 'Saving and loading your explanation…' : 'Сохраняем и подгружаем объяснение…'}
                  </div>
                  <div className="mx-auto max-w-[18rem] space-y-2">
                    <div className="h-3 rounded-full bg-black/[0.04]" />
                    <div className="h-3 w-[92%] rounded-full bg-black/[0.035]" />
                    <div className="h-3 w-[76%] rounded-full bg-black/[0.03]" />
                  </div>
                </motion.div>
              ) : (
                <motion.div key={`${activeInsight.entityType}-${activeInsight.entityId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24 }} className="space-y-3 py-1 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <EntityBadge insight={activeInsight} selectedPlanet={selectedPlanetKey} color={selectedPlanetMeta?.color || '#7B5EA7'} />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[17px] font-medium text-text-main">{activeInsight.title}</p>
                      <p className="text-[12.5px] text-[#7B5EA7]">{activeInsight.subtitle}</p>
                    </div>
                  </div>
                  <p className="mx-auto max-w-[19rem] text-center text-[14.5px] leading-[1.74] text-text-main/84">{activeInsight.body}</p>
                  {activeInsight.tags?.length ? (
                    <div className="mx-auto flex max-w-[19rem] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-text-muted/82">
                      {activeInsight.tags.map((tag) => <span key={tag.id}>{tag.label}</span>)}
                    </div>
                  ) : null}
                  {activeInsight.legend?.length ? (
                    <div className="mx-auto flex max-w-[19rem] flex-col gap-1.5 pt-0.5 text-left text-[12px] text-text-muted/82">
                      {activeInsight.legend.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: item.color || '#7B5EA7' }} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mx-auto max-w-[18rem] text-center text-[12px] leading-relaxed text-text-muted/76">{buildHoldHint(language)}</p>
                  {insightState.isFallback ? (
                    <button type="button" onClick={() => { if (selectedEntity) void fetchInsightForSelection(selectedEntity); }} className="mx-auto block text-[12px] font-medium text-[#7B5EA7]">
                      {language === 'en' ? 'Refresh this explanation' : 'Обновить это объяснение'}
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
