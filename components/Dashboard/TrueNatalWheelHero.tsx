import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import { getZodiacSign } from '../../constants';
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
import { PlanetSymbolIcon } from './AstroWheelIcons';

const INTRO_TOTAL_MS = 760;
const HOLD_DURATION_MS = 920;
const WHEEL_MEDALLION_SRC = '/zodiac_wheel_transparent_optimized.webp';
const PLANET_TOUCH_RADIUS = 33;
const LEADER_LINE_TARGET_RADIUS = 106;
const OUTER_LABEL_OUTER_RADIUS = OUTER_RIM_RADIUS;
const ZODIAC_BAND_INNER_RADIUS = 114;
const ZODIAC_LABEL_RADIUS = 148.6;
const ZODIAC_HIT_INNER_RADIUS = ZODIAC_BAND_INNER_RADIUS;
const ZODIAC_HIT_OUTER_RADIUS = OUTER_LABEL_OUTER_RADIUS;
const HOUSE_HIT_INNER_RADIUS = INNER_CENTER_RADIUS + 3;
const HOUSE_HIT_OUTER_RADIUS = HOUSE_RING_RADIUS - 2;
const HOUSE_LABEL_RADIUS = HOUSE_RING_RADIUS - 10;
const ZODIAC_SECTOR_HALF_SPAN = 15;
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

type WheelHouseSegment = {
  house: number;
  rawLongitude: number;
  endLongitude: number;
  labelLongitude: number;
  sign: string;
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

const angularDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

function buildIdleHint(language: Language) {
  return language === 'en'
    ? 'Tap a sign, planet, house, or aspect line. The wheel will show the exact layer you touched without opening the full reading.'
    : 'Нажми знак, планету, дом или линию аспекта. Круг сразу покажет тот слой, которого ты коснулся, без перехода в полный разбор.';
}

function buildHoldHint(language: Language) {
  return language === 'en'
    ? 'For the deeper interpretation, open the full natal card.'
    : 'Глубокий разбор оставим для полной натальной карты.';
}

function buildIdleTitle(language: Language) {
  return language === 'en' ? 'Interactive Natal Wheel' : 'Интерактивное колесо';
}

function buildLayerLabels(language: Language) {
  return language === 'en'
    ? ['Signs', 'Planets', 'Houses', 'Aspects']
    : ['Знаки', 'Планеты', 'Дома', 'Аспекты'];
}

function getEntityKicker(language: Language, insight: WheelInsight) {
  if (language === 'en') {
    if (insight.entityType === 'planet') return 'Planet';
    if (insight.entityType === 'zodiac') return 'Zodiac sign';
    if (insight.entityType === 'house') return 'House';
    return 'Aspect';
  }
  if (insight.entityType === 'planet') return 'Планета';
  if (insight.entityType === 'zodiac') return 'Знак';
  if (insight.entityType === 'house') return 'Дом';
  return 'Аспект';
}

function buildWheelMicroBody(language: Language, insight: WheelInsight) {
  if (language === 'en') {
    if (insight.entityType === 'zodiac') {
      return 'This is the tone of a sector. Look at the highlighted planets: they show where this sign speaks louder in the chart.';
    }
    if (insight.entityType === 'planet') {
      return 'This point carries a specific function. The sign shows its style, the house shows the life area, and the lines show its connections.';
    }
    if (insight.entityType === 'house') {
      return 'This is a life stage of the chart. Planets inside show what is active here, while the sign on the cusp sets the opening tone.';
    }
    return 'This line is a dialogue between two planets. Soft links show flow, tense links show a theme that asks for tuning.';
  }

  if (insight.entityType === 'zodiac') {
    return 'Это тон сектора. Смотри на подсвеченные планеты: они показывают, где этот знак в твоей карте звучит заметнее.';
  }
  if (insight.entityType === 'planet') {
    return 'Это активная точка карты. Знак показывает стиль, дом — сферу жизни, а линии — связи с другими частями карты.';
  }
  if (insight.entityType === 'house') {
    return 'Это жизненная сцена карты. Планеты внутри показывают, что здесь включено, а знак на входе задает тон темы.';
  }
  return 'Эта линия показывает диалог двух планет. Мягкие связи дают поток, напряженные помогают увидеть настройку.';
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
  if (planet === 'sun') return 15.8;
  if (planet === 'moon' || planet === 'rising') return 14.6;
  if (planet === 'chiron') return 12.4;
  return 13.2;
}

function getZodiacLongLabel(language: Language, sign: ZodiacSign) {
  return getZodiacSign(language, sign).toUpperCase();
}

function getZodiacFontSize(label: string) {
  if (label.length >= 10) return 7.1;
  if (label.length >= 8) return 7.45;
  if (label.length >= 6) return 7.9;
  return 8.45;
}

function getZodiacSectorAngles(index: number) {
  const center = normalizeDegrees(index * 30);
  return {
    center,
    start: normalizeDegrees(center - ZODIAC_SECTOR_HALF_SPAN),
    end: normalizeDegrees(center + ZODIAC_SECTOR_HALF_SPAN),
  };
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

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, shouldAnimateIntro = false, onIntroComplete, onOpenChart }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);

    const holdFrameRef = useRef<number | null>(null);
    const holdPointerIdRef = useRef<number | null>(null);
    const holdStartRef = useRef(0);
    const holdTriggeredRef = useRef(false);

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

    const houseSegments = useMemo<WheelHouseSegment[]>(() => {
      return houseCusps.map((house, index) => {
        const next = houseCusps[(index + 1) % houseCusps.length] || house;
        const span = normalizeDegrees(next.rawLongitude - house.rawLongitude) || 30;
        return {
          ...house,
          endLongitude: next.rawLongitude,
          labelLongitude: normalizeDegrees(house.rawLongitude + span / 2),
        };
      });
    }, [houseCusps]);

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
              angularDistance(prev.rawLongitude, planet.rawLongitude) < 10.5
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
      selectedEntity?.entityType === 'house' && Number.isFinite(Number(selectedEntity.entityId))
        ? Number(selectedEntity.entityId)
        : null;
    const selectedAspect =
      selectedEntity?.entityType === 'aspect'
        ? aspectLines.find((aspect) => aspect.entityId === selectedEntity.entityId) || null
        : null;

    const highlightedHouseNumbers = useMemo(() => {
      const houses = new Set<number>();
      if (selectedHouseNumber != null) houses.add(selectedHouseNumber);
      if (selectedPlanetKey) {
        const house = displayPlanetMap.get(selectedPlanetKey)?.house;
        if (house != null) houses.add(house);
      }
      if (selectedAspect) {
        if (selectedAspect.from.house != null) houses.add(selectedAspect.from.house);
        if (selectedAspect.to.house != null) houses.add(selectedAspect.to.house);
      }
      if (selectedZodiacSign) {
        displayPlanets.forEach((planet) => {
          if (planet.sign === selectedZodiacSign && planet.house != null) houses.add(planet.house);
        });
      }
      return houses;
    }, [displayPlanetMap, displayPlanets, selectedAspect, selectedHouseNumber, selectedPlanetKey, selectedZodiacSign]);

    const linkedAspectLines = useMemo(() => {
      if (selectedPlanetKey) {
        return aspectLines.filter((aspect) => aspect.from.key === selectedPlanetKey || aspect.to.key === selectedPlanetKey);
      }
      if (selectedAspect) {
        return [selectedAspect];
      }
      if (selectedZodiacSign) {
        return aspectLines.filter(
          (aspect) => aspect.from.sign === selectedZodiacSign || aspect.to.sign === selectedZodiacSign
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

    const cancelHold = useCallback(() => {
      stopHoldLoop();
      holdPointerIdRef.current = null;
      holdTriggeredRef.current = false;
      setIsHolding(false);
      setHoldProgress(0);
    }, [stopHoldLoop]);

    const stopHoldAndPropagation = useCallback((event: React.PointerEvent<SVGElement>) => {
      event.stopPropagation();
      cancelHold();
    }, [cancelHold]);

    const activateSelection = useCallback(
      (selection: SelectedEntity) => {
        cancelHold();
        setSelectedEntity(selection);
      },
      [cancelHold]
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
    const activeInsight = selectionPreview;
    const selectedInsightKicker = activeInsight ? getEntityKicker(language, activeInsight) : null;
    const selectedInsightBody = activeInsight ? buildWheelMicroBody(language, activeInsight) : null;
    const layerLabels = buildLayerLabels(language);

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[25.5rem]">
              <div
                className="relative aspect-square w-full select-none"
                onPointerDown={handleWheelPointerDown}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerCancel}
                onPointerLeave={cancelHold}
              >
                <motion.div
                  className="relative h-full w-full"
                  initial={introEnabled ? { opacity: 0, scale: 0.986, y: 10 } : false}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={introTransition}
                >
                  <div className="absolute inset-0">
                    <img
                      src={WHEEL_MEDALLION_SRC}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                    />
                    <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="absolute inset-0 h-full w-full overflow-visible">
                      {ZODIAC_SIGNS.map((sign, index) => {
                        const { start, end, center: labelDeg } = getZodiacSectorAngles(index);
                        const label = getZodiacLongLabel(language, sign as ZodiacSign);
                        const point = polarPoint(labelDeg, ZODIAC_LABEL_RADIUS);
                        const flip = labelDeg > 90 && labelDeg < 270;
                        const rotation = flip ? labelDeg + 180 : labelDeg;
                        const isActive = selectedZodiacSign === sign;
                        return (
                          <g key={`zodiac-${sign}`}>
                            {isActive ? (
                              <path
                                d={describeRingSegment(start, end, ZODIAC_HIT_INNER_RADIUS, ZODIAC_HIT_OUTER_RADIUS)}
                                fill="rgba(30,74,126,0.10)"
                                stroke="rgba(30,74,126,0.38)"
                                strokeWidth="0.9"
                              />
                            ) : null}
                            <text
                              x={point.x}
                              y={point.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${rotation} ${point.x} ${point.y})`}
                              fill={isActive ? '#111827' : '#163762'}
                              stroke="rgba(255,255,255,0.74)"
                              strokeWidth="0.55"
                              paintOrder="stroke"
                              style={{ fontSize: getZodiacFontSize(label), fontWeight: 800, letterSpacing: '0.03em' }}
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
                      {houseSegments.map((segment) => {
                        const active = highlightedHouseNumbers.has(segment.house);
                        const labelPoint = polarPoint(segment.labelLongitude, HOUSE_LABEL_RADIUS);
                        return (
                          <g
                            key={`house-zone-${segment.house}`}
                            data-wheel-entity="true"
                            onPointerDown={stopHoldAndPropagation}
                            onPointerUp={(event) => {
                              event.stopPropagation();
                              activateSelection({ entityType: 'house', entityId: String(segment.house) });
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {active ? (
                              <motion.path
                                d={describeRingSegment(segment.rawLongitude, segment.endLongitude, HOUSE_HIT_INNER_RADIUS, HOUSE_HIT_OUTER_RADIUS)}
                                fill="rgba(255,244,214,0.11)"
                                stroke="rgba(255,230,176,0.42)"
                                strokeWidth="0.7"
                                initial={false}
                                animate={{ opacity: [0.62, 0.92, 0.62] }}
                                transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                              />
                            ) : (
                              <path
                                d={describeRingSegment(segment.rawLongitude, segment.endLongitude, HOUSE_HIT_INNER_RADIUS, HOUSE_HIT_OUTER_RADIUS)}
                                fill="transparent"
                              />
                            )}
                            <circle
                              cx={labelPoint.x}
                              cy={labelPoint.y}
                              r={active ? 5.8 : 5.2}
                              fill={active ? 'rgba(255,250,238,0.96)' : 'rgba(255,255,255,0.74)'}
                              stroke={active ? 'rgba(226,177,84,0.82)' : 'rgba(214,229,252,0.48)'}
                              strokeWidth={active ? 0.86 : 0.58}
                            />
                            <text
                              x={labelPoint.x}
                              y={labelPoint.y + 0.2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill={active ? '#8A5B18' : 'rgba(235,242,255,0.86)'}
                              style={{ fontSize: 5.6, fontWeight: 700 }}
                            >
                              {segment.house}
                            </text>
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
                            stroke="rgba(214,229,252,0.34)"
                            strokeWidth={house.house % 3 === 1 ? 0.86 : 0.48}
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
                              opacity={active ? 0.88 : dimmed ? 0.07 : 0.22}
                              style={{ filter: active ? `drop-shadow(0 0 3px ${style.stroke})` : undefined }}
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
                        const iconSize = planet.visualRadius * 1.18;
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
          <div className="mx-auto mt-2.5 w-full max-w-[23.5rem] px-3">
            <AnimatePresence mode="wait" initial={false}>
              {!activeInsight ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-2 text-left"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7B5EA7]">{buildIdleTitle(language)}</p>
                    <p className="mt-1 text-[14px] leading-[1.55] text-text-main/78">{buildIdleHint(language)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {layerLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-[#F4F6FA] px-2.5 py-1 text-[10.5px] font-medium leading-tight text-text-muted"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-muted/76">{buildHoldHint(language)}</p>
                </motion.div>
              ) : (
                <motion.div
                  key={`${activeInsight.entityType}-${activeInsight.entityId}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7B5EA7]">{selectedInsightKicker}</p>
                    <p className="mt-0.5 truncate text-[22px] font-semibold leading-tight text-text-main">{activeInsight.title}</p>
                    <p className="mt-1 text-[13px] leading-snug text-text-muted">{activeInsight.subtitle}</p>
                  </div>
                  <p className="text-[14.5px] leading-[1.55] text-text-main/82">{selectedInsightBody}</p>
                  {activeInsight.tags?.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeInsight.tags.map((tag) => (
                        <span key={tag.id} className="rounded-full bg-[#F4F6FA] px-2.5 py-1 text-[11.5px] leading-tight text-text-muted/86">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {activeInsight.legend?.length ? (
                    <div className="grid gap-1.5 pt-0.5 text-[12px] text-text-muted/82">
                      {activeInsight.legend.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: item.color || '#7B5EA7' }} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[12px] leading-relaxed text-text-muted/72">{buildHoldHint(language)}</p>
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
