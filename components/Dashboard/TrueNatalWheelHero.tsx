import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getZodiacSign } from '../../constants';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  NatalHouseData,
  PlanetInsight,
  PlanetInsightTag,
  UserProfile,
} from '../../types';
import { getPlanetInsight } from '../../services/astrologyService';
import { cn } from '../../lib/cn';
import {
  getPlanetDisplayName,
  getPlanetMeta,
  getPlanetPositionFromChart,
  getZodiacElementStyle,
  isPlanetInteractive,
  normalizePlanetKey,
  PLANET_BASE_RADIUS,
  PLANET_COLLISION_RADII,
  HOUSE_DOTTED_RADIUS,
  HOUSE_RING_RADIUS,
  INNER_CENTER_RADIUS,
  NATAL_PLANET_ORDER,
  OUTER_RIM_RADIUS,
  WHEEL_CENTER,
  WHEEL_VIEWBOX,
  ZODIAC_GLYPHS,
  ZODIAC_OUTER_RADIUS,
  type NatalLayerMode,
  type NatalPlanetKey,
} from '../../lib/natalWheel';
import { ZODIAC_SIGNS, type ZodiacSign } from '../../lib/zodiac-utils';

const ASTRO_FONT_STACK =
  '"Noto Sans Symbols 2 Local","Noto Sans Symbols 2","Segoe UI Symbol",sans-serif';

const LOCKED_PLANET_RADIUS = 7;
const HOUSE_LABEL_RADIUS = 60;
const PLANET_TOUCH_RADIUS = 22;
const PLANET_DEGREE_RADIUS_OFFSET = 20;
const LEADER_LINE_TARGET_RADIUS = 100;
const DEFAULT_PANEL_HEIGHT = 156;
const EXPANDED_PANEL_HEIGHT = 288;
const INTRO_TOTAL_MS = 900;
const MAJOR_ASPECTS: NatalAspectData['type'][] = [
  'conjunction',
  'opposition',
  'square',
  'trine',
  'sextile',
];

type DisplayPlanet = {
  key: NatalPlanetKey;
  rawLongitude: number;
  adjustedDeg: number;
  displayRadius: number;
  visualRadius: number;
  interactive: boolean;
  locked: boolean;
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

type ToastState = {
  message: string;
  cta?: string;
};

type TrueNatalWheelHeroProps = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  isPremium: boolean;
  onRequestPremium: () => void;
  shouldAnimateIntro?: boolean;
  onIntroComplete?: () => void;
};

const toneClassMap: Record<NonNullable<PlanetInsightTag['tone']>, string> = {
  water: 'bg-[#F5F8FF] text-[#2980B9]',
  fire: 'bg-[#FFF5F5] text-[#C0392B]',
  earth: 'bg-[#F5FFF7] text-[#27AE60]',
  air: 'bg-[#FFFEF5] text-[#F39C12]',
  neutral: 'bg-black/[0.04] text-text-muted',
};

const aspectStyles: Record<
  NatalAspectData['type'],
  { stroke: string; width: number; dash?: string }
> = {
  conjunction: { stroke: '#7B5EA7', width: 1.2 },
  opposition: { stroke: '#E53935', width: 1 },
  square: { stroke: '#E53935', width: 0.8 },
  trine: { stroke: '#43A047', width: 1 },
  sextile: { stroke: '#1E88E5', width: 0.7 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toRadians(degree: number): number {
  return (degree * Math.PI) / 180;
}

function polarPoint(degree: number, radius: number) {
  const radians = toRadians(degree);
  return {
    x: WHEEL_CENTER + Math.cos(radians) * radius,
    y: WHEEL_CENTER + Math.sin(radians) * radius,
  };
}

function createRingSegmentPath(startDeg: number, endDeg: number, innerRadius: number, outerRadius: number) {
  const outerStart = polarPoint(startDeg, outerRadius);
  const outerEnd = polarPoint(endDeg, outerRadius);
  const innerEnd = polarPoint(endDeg, innerRadius);
  const innerStart = polarPoint(startDeg, innerRadius);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function angularDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function midpointDegree(start: number, end: number) {
  const normalizedStart = normalizeDegrees(start);
  const span = normalizeDegrees(end - normalizedStart);
  return normalizeDegrees(normalizedStart + span / 2);
}

function distanceBetweenTouches(first: React.Touch | Touch, second: React.Touch | Touch) {
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.hypot(dx, dy);
}

function resolveLongitude(position: { longitude?: number; sign?: string; degree?: number } | null | undefined) {
  if (!position) return null;
  if (typeof position.longitude === 'number' && Number.isFinite(position.longitude)) {
    return normalizeDegrees(position.longitude);
  }
  const signIndex = ZODIAC_SIGNS.indexOf(String(position.sign || '') as ZodiacSign);
  if (signIndex < 0) return null;
  const degree = typeof position.degree === 'number' ? position.degree : 0;
  return normalizeDegrees(signIndex * 30 + degree);
}

function resolveHouseLongitude(house: NatalHouseData) {
  if (typeof house.longitude === 'number' && Number.isFinite(house.longitude)) {
    return normalizeDegrees(house.longitude);
  }
  const signIndex = ZODIAC_SIGNS.indexOf(String(house.sign || '') as ZodiacSign);
  return normalizeDegrees((Math.max(signIndex, 0) * 30) + (house.degree || 0));
}

function formatDegree(degree: number | null) {
  return degree == null ? '—' : `${Math.round(degree)}°`;
}

function formatSignAndDegree(language: Language, sign: string, degree: number | null) {
  return `${getZodiacSign(language, sign)} ${formatDegree(degree)}`;
}

function buildFallbackHouseCusps(chartData: NatalChartData): NatalHouseData[] {
  const risingLongitude = resolveLongitude(chartData.rising) ?? 180;
  return Array.from({ length: 12 }, (_, index) => {
    const longitude = normalizeDegrees(risingLongitude + index * 30);
    const signIndex = Math.floor(longitude / 30) % 12;
    return {
      house: index + 1,
      sign: ZODIAC_SIGNS[signIndex],
      degree: longitude % 30,
      longitude,
    };
  });
}

function getOverviewHouseVisibility(house: number, mode: NatalLayerMode, isPremium: boolean) {
  if (mode === 'details' && isPremium) return true;
  return house === 1 || house === 4 || house === 7 || house === 10;
}

function getAspectOpacity(
  focusedPlanet: NatalPlanetKey | null,
  from: NatalPlanetKey,
  to: NatalPlanetKey
) {
  if (!focusedPlanet) return 0.76;
  return focusedPlanet === from || focusedPlanet === to ? 1 : 0.2;
}

function defaultInsightHint(language: Language) {
  return language === 'en'
    ? 'Tap a planet to see what it means in your chart'
    : 'Нажми на планету, чтобы увидеть, что она значит в твоей карте';
}

function loadingInsightLabel(language: Language) {
  return language === 'en' ? 'Preparing insight…' : 'Готовим инсайт…';
}

function errorInsightLabel(language: Language) {
  return language === 'en'
    ? 'The insight did not load yet. Try again.'
    : 'Инсайт пока не загрузился. Попробуй ещё раз.';
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({
    profile,
    chartData,
    chartId,
    isPremium,
    onRequestPremium,
    shouldAnimateIntro = false,
    onIntroComplete,
  }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [layerMode, setLayerMode] = useState<NatalLayerMode>('overview');
    const [selectedPlanet, setSelectedPlanet] = useState<NatalPlanetKey | null>(null);
    const [insightState, setInsightState] = useState<{
      status: 'idle' | 'loading' | 'ready' | 'error';
      planetId: NatalPlanetKey | null;
      content: PlanetInsight | null;
    }>({
      status: 'idle',
      planetId: null,
      content: null,
    });
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isLockSheetOpen, setIsLockSheetOpen] = useState(false);
    const [focusedAspectPlanet, setFocusedAspectPlanet] = useState<NatalPlanetKey | null>(null);
    const [zoomScale, setZoomScale] = useState(1);
    const [activeMiniTab, setActiveMiniTab] = useState<'natal' | 'transits' | 'synastry'>('natal');

    const insightCacheRef = useRef<Partial<Record<NatalPlanetKey, PlanetInsight>>>({});
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelTouchStartRef = useRef<number | null>(null);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartScaleRef = useRef<number>(1);
    const isPinchingRef = useRef(false);
    const lastTapTimestampRef = useRef(0);
    const latestInsightRequestRef = useRef(0);

    const introEnabled = shouldAnimateIntro && !shouldReduceMotion;

    useEffect(() => {
      if (!introEnabled || !onIntroComplete) return;
      const timer = setTimeout(() => onIntroComplete(), INTRO_TOTAL_MS);
      return () => clearTimeout(timer);
    }, [introEnabled, onIntroComplete]);

    useEffect(
      () => () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      },
      []
    );

    const showToast = useCallback((nextToast: ToastState) => {
      setToast(nextToast);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 3200);
    }, []);

    const houseCusps = useMemo(() => {
      const base = Array.isArray(chartData.houses) && chartData.houses.length >= 12
        ? [...chartData.houses].sort((left, right) => left.house - right.house)
        : buildFallbackHouseCusps(chartData);

      return base.map((house) => ({
        house: house.house,
        rawLongitude: resolveHouseLongitude(house),
      }));
    }, [chartData]);

    const ascDegree = useMemo(() => resolveLongitude(chartData.rising) ?? 180, [chartData.rising]);
    const rotationOffset = useMemo(() => normalizeDegrees(ascDegree - 180), [ascDegree]);

    const houseLabels = useMemo(
      () =>
        houseCusps.map((house, index) => {
          const nextHouse = houseCusps[(index + 1) % houseCusps.length];
          return {
            house: house.house,
            adjustedDeg: midpointDegree(
              normalizeDegrees(house.rawLongitude - rotationOffset),
              normalizeDegrees(nextHouse.rawLongitude - rotationOffset)
            ),
          };
        }),
      [houseCusps, rotationOffset]
    );

    const displayPlanets = useMemo<DisplayPlanet[]>(() => {
      const base = NATAL_PLANET_ORDER.map((planetKey) => {
        const position = getPlanetPositionFromChart(chartData, planetKey);
        const rawLongitude = resolveLongitude(position);
        if (rawLongitude == null || !position) return null;

        const interactive = isPlanetInteractive(planetKey, layerMode, isPremium);
        const house =
          typeof position.house === 'number'
            ? position.house
            : typeof position.house === 'string' && position.house.trim()
              ? Number(position.house)
              : null;

        return {
          key: planetKey,
          rawLongitude,
          adjustedDeg: normalizeDegrees(rawLongitude - rotationOffset),
          displayRadius: PLANET_BASE_RADIUS,
          visualRadius: interactive ? getPlanetMeta(planetKey).radius : LOCKED_PLANET_RADIUS,
          interactive,
          locked: !interactive,
          label: getPlanetDisplayName(planetKey, language),
          sign: position.sign,
          degree: typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : null,
          house: Number.isFinite(house) ? house : null,
          retrograde: !!position.retrograde,
          lineTargetRadius: null,
        } satisfies DisplayPlanet;
      }).filter(Boolean) as DisplayPlanet[];

      const resolved: DisplayPlanet[] = [];
      [...base]
        .sort((left, right) => left.adjustedDeg - right.adjustedDeg)
        .forEach((planet) => {
          let radiusIndex = 0;
          while (
            radiusIndex < PLANET_COLLISION_RADII.length - 1 &&
            resolved.some(
              (previous) =>
                previous.displayRadius === PLANET_COLLISION_RADII[radiusIndex] &&
                angularDistance(previous.adjustedDeg, planet.adjustedDeg) < 7
            )
          ) {
            radiusIndex += 1;
          }

          const displayRadius = PLANET_COLLISION_RADII[radiusIndex];
          resolved.push({
            ...planet,
            displayRadius,
            lineTargetRadius: displayRadius !== PLANET_BASE_RADIUS ? LEADER_LINE_TARGET_RADIUS : null,
          });
        });

      return resolved.sort(
        (left, right) => getPlanetMeta(left.key).order - getPlanetMeta(right.key).order
      );
    }, [chartData, isPremium, language, layerMode, rotationOffset]);

    const displayPlanetMap = useMemo(
      () => new Map(displayPlanets.map((planet) => [planet.key, planet])),
      [displayPlanets]
    );

    const aspectLines = useMemo<WheelAspectLine[]>(() => {
      if (layerMode !== 'details' || !isPremium || !Array.isArray(chartData.aspects)) {
        return [];
      }

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
            id: `${fromKey}-${toKey}-${aspect.type}`,
            type: aspect.type,
            orb: aspect.orb,
            from,
            to,
          };
        })
        .filter(Boolean) as WheelAspectLine[];
    }, [chartData.aspects, displayPlanetMap, isPremium, layerMode]);

    const handleLayerChange = useCallback(
      (nextMode: NatalLayerMode) => {
        if (nextMode === 'details' && !isPremium) {
          setIsLockSheetOpen(true);
          return;
        }

        setLayerMode(nextMode);
        if (nextMode === 'overview') {
          setActiveMiniTab('natal');
          setFocusedAspectPlanet(null);
        }
      },
      [isPremium]
    );

    const fetchInsightForPlanet = useCallback(
      async (planetKey: NatalPlanetKey) => {
        const cached = insightCacheRef.current[planetKey];
        if (cached) {
          setInsightState({ status: 'ready', planetId: planetKey, content: cached });
          return;
        }

        if (!profile.id) {
          setInsightState({ status: 'error', planetId: planetKey, content: null });
          return;
        }

        const requestId = latestInsightRequestRef.current + 1;
        latestInsightRequestRef.current = requestId;
        setInsightState({ status: 'loading', planetId: planetKey, content: null });

        try {
          const insight = await getPlanetInsight(profile, chartData, planetKey, chartId);
          insightCacheRef.current[planetKey] = insight;
          if (latestInsightRequestRef.current === requestId) {
            setInsightState({ status: 'ready', planetId: planetKey, content: insight });
          }
        } catch {
          if (latestInsightRequestRef.current === requestId) {
            setInsightState({ status: 'error', planetId: planetKey, content: null });
          }
        }
      },
      [chartData, chartId, profile]
    );

    const handlePlanetTap = useCallback(
      (planetKey: NatalPlanetKey) => {
        const planet = displayPlanetMap.get(planetKey);
        if (!planet) return;

        if (planet.locked) {
          showToast({
            message:
              language === 'en'
                ? `Unlock Premium to explore ${planet.label}`
                : `Открой Premium, чтобы изучить ${planet.label}`,
            cta: language === 'en' ? 'Open Premium' : 'Открыть Premium',
          });
          return;
        }

        setSelectedPlanet(planetKey);
        setFocusedAspectPlanet(null);
        void fetchInsightForPlanet(planetKey);
      },
      [displayPlanetMap, fetchInsightForPlanet, language, showToast]
    );

    const handlePlanetPressStart = useCallback((planetKey: NatalPlanetKey) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        setFocusedAspectPlanet(planetKey);
      }, 440);
    }, []);

    const clearPlanetPress = useCallback(() => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      setFocusedAspectPlanet(null);
    }, []);

    const handleWheelTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 2) {
        pinchStartDistanceRef.current = distanceBetweenTouches(event.touches[0], event.touches[1]);
        pinchStartScaleRef.current = zoomScale;
        isPinchingRef.current = true;
      }
    }, [zoomScale]);

    const handleWheelTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2 || pinchStartDistanceRef.current == null) return;
      event.preventDefault();
      const nextDistance = distanceBetweenTouches(event.touches[0], event.touches[1]);
      const ratio = nextDistance / pinchStartDistanceRef.current;
      setZoomScale(clamp(pinchStartScaleRef.current * ratio, 1, 2.5));
    }, []);

    const handleWheelTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length < 2) {
        pinchStartDistanceRef.current = null;
        pinchStartScaleRef.current = zoomScale;
      }

      if (isPinchingRef.current) {
        if (event.touches.length === 0) {
          isPinchingRef.current = false;
        }
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('[data-planet-touch=\"true\"]')) return;

      const now = Date.now();
      if (now - lastTapTimestampRef.current < 280) {
        setZoomScale(1);
        lastTapTimestampRef.current = 0;
      } else {
        lastTapTimestampRef.current = now;
      }
    }, [zoomScale]);

    const handlePanelTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      panelTouchStartRef.current = event.touches[0]?.clientY ?? null;
    }, []);

    const handlePanelTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (panelTouchStartRef.current == null) return;
      const endY = event.changedTouches[0]?.clientY ?? panelTouchStartRef.current;
      const delta = endY - panelTouchStartRef.current;
      if (delta < -24) setIsPanelExpanded(true);
      if (delta > 24) setIsPanelExpanded(false);
      panelTouchStartRef.current = null;
    }, []);

    const selectedInsight = insightState.content;
    const selectedPlanetMeta = selectedPlanet ? getPlanetMeta(selectedPlanet) : null;
    const selectedPlanetData = selectedPlanet ? displayPlanetMap.get(selectedPlanet) || null : null;
    const introTransition = shouldReduceMotion
      ? { duration: 0.24 }
      : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-1">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-black/[0.05] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
            {([
              { id: 'overview', label: language === 'en' ? 'Overview' : 'Обзор' },
              { id: 'details', label: language === 'en' ? 'Details 🔒' : 'Детали 🔒' },
            ] as Array<{ id: NatalLayerMode; label: string }>).map((item) => {
              const active = layerMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLayerChange(item.id)}
                  className={cn(
                    'min-w-[7.1rem] rounded-full px-4 py-2 text-[13px] font-medium transition-all',
                    active
                      ? 'bg-white text-text-main shadow-[0_6px_16px_rgba(0,0,0,0.08)]'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-[15rem] flex-1 items-center justify-center">
            <div className="relative mx-auto flex w-full max-w-[22.375rem] items-center justify-center">
              <div
                className="relative aspect-square w-full touch-none"
                onTouchStart={handleWheelTouchStart}
                onTouchMove={handleWheelTouchMove}
                onTouchEnd={handleWheelTouchEnd}
                onDoubleClick={() => setZoomScale(1)}
                style={{ touchAction: 'none' }}
              >
                <motion.div
                  animate={{ scale: zoomScale }}
                  transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full w-full"
                  style={{ transformOrigin: '50% 50%' }}
                >
                  <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="h-full w-full overflow-visible">
                    {ZODIAC_SIGNS.map((sign, index) => {
                      const startRaw = index * 30;
                      const endRaw = (index + 1) * 30;
                      const startDeg = normalizeDegrees(startRaw - rotationOffset);
                      const endDeg = normalizeDegrees(endRaw - rotationOffset);
                      const midDeg = normalizeDegrees(startRaw + 15 - rotationOffset);
                      const style = getZodiacElementStyle(sign);
                      const glyphPoint = polarPoint(midDeg, (HOUSE_RING_RADIUS + ZODIAC_OUTER_RADIUS) / 2);

                      return (
                        <g key={sign}>
                          <motion.path
                            d={createRingSegmentPath(startDeg, endDeg, HOUSE_RING_RADIUS, ZODIAC_OUTER_RADIUS)}
                            fill={style.fill}
                            stroke={style.border}
                            strokeWidth="0.5"
                            initial={introEnabled ? { opacity: 0 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ ...introTransition, delay: introEnabled ? 0.1 : 0 }}
                          />
                          <motion.text
                            x={glyphPoint.x}
                            y={glyphPoint.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={style.text}
                            style={{ fontFamily: ASTRO_FONT_STACK, fontSize: 10 }}
                            initial={introEnabled ? { opacity: 0 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ ...introTransition, delay: introEnabled ? 0.12 : 0 }}
                          >
                            {ZODIAC_GLYPHS[sign as ZodiacSign]}
                          </motion.text>
                        </g>
                      );
                    })}

                    {ZODIAC_SIGNS.map((_, index) => {
                      const degree = normalizeDegrees(index * 30 - rotationOffset);
                      const inner = polarPoint(degree, HOUSE_RING_RADIUS);
                      const outer = polarPoint(degree, ZODIAC_OUTER_RADIUS);
                      return (
                        <line
                          key={`separator-${index}`}
                          x1={inner.x}
                          y1={inner.y}
                          x2={outer.x}
                          y2={outer.y}
                          stroke="#E5E5EA"
                          strokeWidth="0.5"
                        />
                      );
                    })}

                    <motion.circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={OUTER_RIM_RADIUS}
                      fill="none"
                      stroke="#E5E5EA"
                      strokeWidth="1"
                      initial={introEnabled ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={introTransition}
                    />
                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={HOUSE_RING_RADIUS}
                      fill="none"
                      stroke="#E5E5EA"
                      strokeWidth="0.5"
                    />

                    {houseCusps.map((house, index) => {
                      const adjustedDeg = normalizeDegrees(house.rawLongitude - rotationOffset);
                      const from = polarPoint(adjustedDeg, INNER_CENTER_RADIUS);
                      const to = polarPoint(adjustedDeg, HOUSE_RING_RADIUS);
                      const emphatic = house.house === 1 || house.house === 4 || house.house === 7 || house.house === 10;

                      return (
                        <motion.line
                          key={`house-line-${house.house}-${index}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={emphatic ? '#BDBDBD' : '#E5E5EA'}
                          strokeWidth={emphatic ? 1 : 0.5}
                          initial={introEnabled ? { pathLength: 0, opacity: 0.1 } : false}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.25 : 0 }}
                        />
                      );
                    })}

                    {houseLabels
                      .filter((house) => getOverviewHouseVisibility(house.house, layerMode, isPremium))
                      .map((house) => {
                        const point = polarPoint(house.adjustedDeg, HOUSE_LABEL_RADIUS);
                        return (
                          <text
                            key={`house-label-${house.house}`}
                            x={point.x}
                            y={point.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#BDBDBD"
                            style={{ fontSize: 8, fontWeight: 500 }}
                          >
                            {house.house}
                          </text>
                        );
                      })}

                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={HOUSE_DOTTED_RADIUS}
                      fill="none"
                      stroke="#E5E5EA"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                    />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={INNER_CENTER_RADIUS} fill="white" />

                    {aspectLines.map((aspect) => {
                      const style = aspectStyles[aspect.type];
                      const from = polarPoint(aspect.from.adjustedDeg, aspect.from.displayRadius);
                      const to = polarPoint(aspect.to.adjustedDeg, aspect.to.displayRadius);
                      const opacity = getAspectOpacity(focusedAspectPlanet, aspect.from.key, aspect.to.key);
                      return (
                        <motion.line
                          key={aspect.id}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={style.stroke}
                          strokeWidth={style.width + (aspect.orb < 1 ? 0.3 : 0)}
                          strokeDasharray={style.dash}
                          initial={introEnabled ? { opacity: 0 } : false}
                          animate={{ opacity }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.7 : 0 }}
                        />
                      );
                    })}

                    {displayPlanets.map((planet) => {
                      if (planet.lineTargetRadius == null) return null;
                      const from = polarPoint(planet.adjustedDeg, planet.displayRadius + planet.visualRadius);
                      const to = polarPoint(planet.adjustedDeg, planet.lineTargetRadius);
                      return (
                        <line
                          key={`leader-${planet.key}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#E5E5EA"
                          strokeWidth="0.8"
                          strokeDasharray="2 2"
                        />
                      );
                    })}

                    {displayPlanets.map((planet, index) => {
                      const meta = getPlanetMeta(planet.key);
                      const point = polarPoint(planet.adjustedDeg, planet.displayRadius);
                      const active = selectedPlanet === planet.key;
                      const chipStroke = planet.locked ? '#E0E0E0' : meta.color;
                      const glyphColor = planet.locked ? '#BDBDBD' : meta.color;
                      return (
                        <g key={planet.key}>
                          <motion.circle
                            cx={point.x}
                            cy={point.y}
                            r={planet.visualRadius}
                            fill="white"
                            stroke={chipStroke}
                            strokeWidth={planet.locked ? 1 : 1.5}
                            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.10))' }}
                            initial={introEnabled ? { opacity: 0, scale: 0.84 } : false}
                            animate={{ opacity: 1, scale: active ? 1.03 : 1 }}
                            transition={{
                              duration: 0.26,
                              ease: [0.22, 1, 0.36, 1],
                              delay: introEnabled ? 0.4 + index * 0.06 : 0,
                            }}
                          />
                          <text
                            x={point.x}
                            y={point.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={glyphColor}
                            style={{ fontFamily: ASTRO_FONT_STACK, fontSize: planet.visualRadius * 1.08, fontWeight: 500 }}
                          >
                            {meta.glyph}
                          </text>
                          {planet.retrograde && (
                            <>
                              <circle
                                cx={point.x + planet.visualRadius - 1}
                                cy={point.y - planet.visualRadius + 1}
                                r={4}
                                fill="white"
                                stroke="#F6D9D8"
                                strokeWidth="0.6"
                              />
                              <text
                                x={point.x + planet.visualRadius - 1}
                                y={point.y - planet.visualRadius + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#E53935"
                                style={{ fontSize: 6, fontWeight: 700 }}
                              >
                                R
                              </text>
                            </>
                          )}
                          {zoomScale > 1.5 && planet.degree != null && (
                            <text
                              x={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).x}
                              y={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#6E6E73"
                              style={{ fontSize: 7.5, fontWeight: 500 }}
                            >
                              {formatDegree(planet.degree)}
                            </text>
                          )}
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={PLANET_TOUCH_RADIUS}
                            fill="transparent"
                            data-planet-touch="true"
                            onPointerDown={() => handlePlanetPressStart(planet.key)}
                            onPointerUp={clearPlanetPress}
                            onPointerLeave={clearPlanetPress}
                            onPointerCancel={clearPlanetPress}
                            onClick={() => handlePlanetTap(planet.key)}
                            style={{ cursor: 'pointer' }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </motion.div>
              </div>
            </div>
          </div>

          {layerMode === 'details' && isPremium && (
            <div className="mt-2 flex justify-center">
              <div className="inline-flex gap-2 rounded-full bg-black/[0.04] px-1.5 py-1">
                {([
                  { id: 'natal', label: language === 'en' ? 'Natal' : 'Натальная', locked: false },
                  { id: 'transits', label: language === 'en' ? 'Transits' : 'Транзиты', locked: true },
                  { id: 'synastry', label: language === 'en' ? 'Synastry' : 'Синастрия', locked: true },
                ] as const).map((tab) => {
                  const active = activeMiniTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        if (tab.locked) {
                          showToast({
                            message:
                              language === 'en'
                                ? `${tab.label} will appear here later`
                                : `${tab.label} появятся здесь позже`,
                          });
                          return;
                        }
                        setActiveMiniTab(tab.id);
                      }}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
                        active ? 'bg-white text-text-main shadow-[0_4px_10px_rgba(0,0,0,0.06)]' : 'text-text-muted'
                      )}
                    >
                      {tab.label}
                      {tab.locked ? ' 🔒' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="mt-4 overflow-hidden rounded-t-[20px] bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
            style={{ height: isPanelExpanded ? EXPANDED_PANEL_HEIGHT : DEFAULT_PANEL_HEIGHT }}
            onTouchStart={handlePanelTouchStart}
            onTouchEnd={handlePanelTouchEnd}
          >
            <button
              type="button"
              onClick={() => setIsPanelExpanded((current) => !current)}
              className="flex w-full items-center justify-center px-5 pb-2 pt-3"
            >
              <span className="h-1.5 w-10 rounded-full bg-black/[0.08]" />
              <span className="sr-only">{language === 'en' ? 'Expand insight' : 'Развернуть инсайт'}</span>
            </button>

            <div className="flex h-[calc(100%-2rem)] flex-col px-5 pb-5">
              {insightState.status === 'idle' || !selectedPlanet || !selectedPlanetMeta || !selectedPlanetData ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-lg text-text-muted">☞</div>
                  <p className="max-w-[15.5rem] text-[14px] leading-relaxed text-text-muted">{defaultInsightHint(language)}</p>
                </div>
              ) : insightState.status === 'loading' ? (
                <div className="flex h-full flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <span style={{ fontFamily: ASTRO_FONT_STACK }}>{selectedPlanetMeta.glyph}</span>
                    </div>
                    <div>
                      <p className="text-[17px] font-medium text-text-main">{selectedPlanetData.label}</p>
                      <p className="text-[13px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedPlanetData.sign, selectedPlanetData.degree)}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-[14px] leading-relaxed text-text-muted">{loadingInsightLabel(language)}</p>
                </div>
              ) : insightState.status === 'error' || !selectedInsight ? (
                <div className="flex h-full flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <span style={{ fontFamily: ASTRO_FONT_STACK }}>{selectedPlanetMeta.glyph}</span>
                    </div>
                    <div>
                      <p className="text-[17px] font-medium text-text-main">{selectedPlanetData.label}</p>
                      <p className="text-[13px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedPlanetData.sign, selectedPlanetData.degree)}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-[14px] leading-relaxed text-text-muted">{errorInsightLabel(language)}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <span style={{ fontFamily: ASTRO_FONT_STACK, fontSize: 18 }}>{selectedPlanetMeta.glyph}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[17px] font-medium text-text-main">{selectedInsight.title}</p>
                          <p className="text-[13px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedInsight.sign, selectedInsight.degree)}</p>
                          <p className="mt-1 text-[12px] text-[#AEAEB2]">
                            {selectedInsight.house ? (language === 'en' ? `House ${selectedInsight.house}` : `${selectedInsight.house} дом`) : (language === 'en' ? 'House is hidden' : 'Дом скрыт')}
                          </p>
                        </div>
                        <button type="button" onClick={() => setIsPanelExpanded((current) => !current)} className="shrink-0 text-[15px] text-text-muted">
                          {isPanelExpanded ? '↘' : '↗'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={cn('mt-4 min-h-0', isPanelExpanded ? 'overflow-y-auto pr-1' : 'overflow-hidden')}>
                    <p className="text-[14px] leading-[1.6] text-[#3A3A3C]">{selectedInsight.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedInsight.tags.map((tag) => (
                        <span key={tag.id} className={cn('rounded-full px-3 py-1 text-[11px] font-medium', toneClassMap[tag.tone || 'neutral'])}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-none absolute inset-x-3 bottom-[calc(156px+0.75rem)] z-30 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] leading-relaxed text-text-main">{toast.message}</p>
                {toast.cta && (
                  <button
                    type="button"
                    onClick={onRequestPremium}
                    className="pointer-events-auto shrink-0 text-[12px] font-medium text-[#7B5EA7]"
                  >
                    {toast.cta}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isLockSheetOpen && (
            <>
              <motion.button
                type="button"
                className="absolute inset-0 z-40 bg-black/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLockSheetOpen(false)}
              />
              <motion.div
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-3 bottom-3 z-50 rounded-[28px] bg-white px-5 pb-5 pt-4 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                      {language === 'en' ? 'Premium layer' : 'Премиум-слой'}
                    </p>
                    <h3 className="mt-2 text-[22px] font-semibold leading-tight text-text-main">
                      {language === 'en' ? 'Details open the full chart' : 'Детали открывают полную карту'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLockSheetOpen(false)}
                    className="text-[18px] text-text-muted"
                    aria-label={language === 'en' ? 'Close sheet' : 'Закрыть'}
                  >
                    ×
                  </button>
                </div>
                <p className="mt-3 text-[14px] leading-[1.6] text-text-muted">
                  {language === 'en'
                    ? 'Inside Details you will see all planets, major aspects, all house numbers, and deeper personal interpretations.'
                    : 'Внутри Деталей откроются все планеты, мажорные аспекты, все номера домов и более глубокие персональные интерпретации.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLockSheetOpen(false);
                    onRequestPremium();
                  }}
                  className="mt-5 w-full rounded-full bg-text-main px-5 py-3 text-[14px] font-medium text-white"
                >
                  {language === 'en' ? 'Open Premium' : 'Открыть Premium'}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

TrueNatalWheelHero.displayName = 'TrueNatalWheelHero';
