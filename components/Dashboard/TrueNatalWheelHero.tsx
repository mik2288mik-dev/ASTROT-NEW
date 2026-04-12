import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp, Info, Lock, RefreshCw, Sparkles } from 'lucide-react';
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
import { cn } from '../../lib/cn';
import { buildPlanetInsight } from '../../lib/planetInsightContent';
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
  type NatalLayerMode,
  type NatalPlanetKey,
} from '../../lib/natalWheel';
import { ZODIAC_SIGNS, type ZodiacSign } from '../../lib/zodiac-utils';
import { getCachedPlanetInsight, getPlanetInsight } from '../../services/astrologyService';
import { PlanetSymbolIcon } from './AstroWheelIcons';

const LOCKED_PLANET_RADIUS = 7;
const HOUSE_LABEL_RADIUS = 60;
const PLANET_TOUCH_RADIUS = 22;
const PLANET_DEGREE_RADIUS_OFFSET = 18;
const LEADER_LINE_TARGET_RADIUS = 98;
const DEFAULT_PANEL_HEIGHT = 164;
const EXPANDED_PANEL_HEIGHT = 284;
const INTRO_TOTAL_MS = 980;
const DEFAULT_PANEL_MIN_HEIGHT = 150;
const ZODIAC_LABEL_RADIUS = OUTER_RIM_RADIUS - 6;
const WHEEL_MEDALLION_SRC = '/brand/natal-wheel-luxe-medallion.svg';

const MAJOR_ASPECTS: NatalAspectData['type'][] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

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

type ToastState = { message: string; cta?: string };

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

const aspectStyles: Record<NatalAspectData['type'], { stroke: string; width: number; dash?: string }> = {
  conjunction: { stroke: '#7B5EA7', width: 1.2 },
  opposition: { stroke: '#E53935', width: 1.0 },
  square: { stroke: '#E53935', width: 0.8 },
  trine: { stroke: '#43A047', width: 1.0 },
  sextile: { stroke: '#1E88E5', width: 0.72 },
};

const zodiacShortLabels: Record<Language, Record<ZodiacSign, string>> = {
  ru: {
    Aries: 'ОВН',
    Taurus: 'ТЕЛ',
    Gemini: 'БЛЗ',
    Cancer: 'РАК',
    Leo: 'ЛЕВ',
    Virgo: 'ДЕВ',
    Libra: 'ВЕС',
    Scorpio: 'СКО',
    Sagittarius: 'СТР',
    Capricorn: 'КОЗ',
    Aquarius: 'ВОД',
    Pisces: 'РЫБ',
  },
  en: {
    Aries: 'ARI',
    Taurus: 'TAU',
    Gemini: 'GEM',
    Cancer: 'CAN',
    Leo: 'LEO',
    Virgo: 'VIR',
    Libra: 'LIB',
    Scorpio: 'SCO',
    Sagittarius: 'SAG',
    Capricorn: 'CAP',
    Aquarius: 'AQU',
    Pisces: 'PIS',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toRadians(degree: number) {
  return (degree * Math.PI) / 180;
}

function polarPoint(degree: number, radius: number) {
  const radians = toRadians(degree);
  return {
    x: WHEEL_CENTER + Math.cos(radians) * radius,
    y: WHEEL_CENTER + Math.sin(radians) * radius,
  };
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
  return normalizeDegrees(signIndex * 30 + (typeof position.degree === 'number' ? position.degree : 0));
}

function resolveHouseLongitude(house: NatalHouseData) {
  if (typeof house.longitude === 'number' && Number.isFinite(house.longitude)) {
    return normalizeDegrees(house.longitude);
  }
  const signIndex = ZODIAC_SIGNS.indexOf(String(house.sign || '') as ZodiacSign);
  return normalizeDegrees(Math.max(signIndex, 0) * 30 + (house.degree || 0));
}

function formatDegree(degree: number | null) {
  return degree == null ? '—' : `${Math.round(degree)}°`;
}

function formatSignAndDegree(language: Language, sign: string, degree: number | null) {
  return `${getZodiacSign(language, sign)} ${formatDegree(degree)}`;
}

function getZodiacShortLabel(language: Language, sign: ZodiacSign) {
  return zodiacShortLabels[language][sign];
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

function getAspectOpacity(focusedPlanet: NatalPlanetKey | null, from: NatalPlanetKey, to: NatalPlanetKey) {
  if (!focusedPlanet) return 0.74;
  return focusedPlanet === from || focusedPlanet === to ? 1 : 0.18;
}

function buildDefaultHint(language: Language, isPremium: boolean, mode: NatalLayerMode) {
  if (language === 'en') {
    return mode === 'details' && isPremium
      ? 'Tap any planet to see how it speaks in your chart.'
      : 'Tap the Sun, Moon, or ASC to see what they mean in your chart.';
  }
  return mode === 'details' && isPremium
    ? 'Нажми на любую планету, чтобы увидеть её смысл в твоей карте.'
    : 'Нажми на Солнце, Луну или ASC, чтобы увидеть их смысл в твоей карте.';
}

function loadingInsightLabel(language: Language) {
  return language === 'en' ? 'Preparing your insight…' : 'Собираем твой инсайт…';
}

function detailsTeaserCopy(language: Language) {
  return language === 'en'
    ? {
        title: 'Details open the full chart',
        body: 'More planets, aspect lines, all house numbers, and deeper personal meanings.',
        cta: 'Open Premium',
      }
    : {
        title: 'Детали открывают полную карту',
        body: 'Больше планет, аспектные линии, все номера домов и более глубокие личные смыслы.',
        cta: 'Открыть Premium',
      };
}

function renderPlanetIcon(planet: NatalPlanetKey, x: number, y: number, size: number, color: string, muted?: boolean) {
  return (
    <PlanetSymbolIcon
      planet={planet}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      stroke={color}
      strokeWidth={muted ? 1.5 : 1.85}
      opacity={muted ? 0.9 : 1}
    />
  );
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId, isPremium, onRequestPremium, shouldAnimateIntro = false, onIntroComplete }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [layerMode, setLayerMode] = useState<NatalLayerMode>('overview');
    const [selectedPlanet, setSelectedPlanet] = useState<NatalPlanetKey | null>(null);
    const [insightState, setInsightState] = useState<InsightState>({
      status: 'idle',
      planetId: null,
      content: null,
      isFallback: false,
    });
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isDetailsTeaserVisible, setIsDetailsTeaserVisible] = useState(false);
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
    const introTransition = shouldReduceMotion
      ? { duration: 0.24 }
      : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

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
      const base =
        Array.isArray(chartData.houses) && chartData.houses.length >= 12
          ? [...chartData.houses].sort((a, b) => a.house - b.house)
          : buildFallbackHouseCusps(chartData);
      return base.map((house) => ({ house: house.house, rawLongitude: resolveHouseLongitude(house) }));
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
        } as DisplayPlanet;
      }).filter(Boolean) as DisplayPlanet[];

      const resolved: DisplayPlanet[] = [];
      [...base].sort((a, b) => a.adjustedDeg - b.adjustedDeg).forEach((planet) => {
        let radiusIndex = 0;
        while (
          radiusIndex < PLANET_COLLISION_RADII.length - 1 &&
          resolved.some(
            (prev) =>
              prev.displayRadius === PLANET_COLLISION_RADII[radiusIndex] &&
              angularDistance(prev.adjustedDeg, planet.adjustedDeg) < 7
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

      return resolved.sort((a, b) => getPlanetMeta(a.key).order - getPlanetMeta(b.key).order);
    }, [chartData, isPremium, language, layerMode, rotationOffset]);

    const displayPlanetMap = useMemo(() => new Map(displayPlanets.map((planet) => [planet.key, planet])), [displayPlanets]);

    const aspectLines = useMemo<WheelAspectLine[]>(() => {
      if (layerMode !== 'details' || !isPremium || !Array.isArray(chartData.aspects)) return [];
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
    }, [chartData.aspects, displayPlanetMap, isPremium, layerMode]);

    const handleLayerChange = useCallback(
      (nextMode: NatalLayerMode) => {
        if (nextMode === 'details' && !isPremium) {
          setIsDetailsTeaserVisible(true);
          return;
        }
        setLayerMode(nextMode);
        setIsDetailsTeaserVisible(false);
        if (nextMode === 'overview') {
          setActiveMiniTab('natal');
          setFocusedAspectPlanet(null);
        }
      },
      [isPremium]
    );

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

    const handlePlanetTap = useCallback(
      (planetKey: NatalPlanetKey) => {
        const planet = displayPlanetMap.get(planetKey);
        if (!planet) return;
        if (planet.locked) {
          setIsDetailsTeaserVisible(true);
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

    const handlePlanetPressStart = useCallback((planetKey: NatalPlanetKey, interactive: boolean) => {
      if (!interactive) return;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => setFocusedAspectPlanet(planetKey), 420);
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
      setZoomScale(clamp(pinchStartScaleRef.current * (nextDistance / pinchStartDistanceRef.current), 1, 2.5));
    }, []);

    const handleWheelTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length < 2) {
        pinchStartDistanceRef.current = null;
        pinchStartScaleRef.current = zoomScale;
      }
      if (isPinchingRef.current) {
        if (event.touches.length === 0) isPinchingRef.current = false;
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('[data-planet-touch="true"]')) return;
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
    const detailsCopy = detailsTeaserCopy(language);
    const visibleToast = toast && !isDetailsTeaserVisible ? toast : null;

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-1">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-black/[0.05] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
            {([
              { id: 'overview', label: language === 'en' ? 'Overview' : 'Обзор', locked: false },
              { id: 'details', label: language === 'en' ? 'Details' : 'Детали', locked: !isPremium },
            ] as Array<{ id: NatalLayerMode; label: string; locked: boolean }>).map((item) => {
              const active = layerMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLayerChange(item.id)}
                  className={cn(
                    'inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-all',
                    active
                      ? 'bg-white text-text-main shadow-[0_6px_16px_rgba(0,0,0,0.08)]'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  <span>{item.label}</span>
                  {item.locked ? <Lock className="h-3.5 w-3.5" strokeWidth={2} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[19.75rem]">
              <div
                className="relative aspect-square w-full touch-none"
                onTouchStart={handleWheelTouchStart}
                onTouchMove={handleWheelTouchMove}
                onTouchEnd={handleWheelTouchEnd}
                onDoubleClick={() => setZoomScale(1)}
                style={{ touchAction: 'none' }}
              >
                <div className="pointer-events-none absolute inset-[5%] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,208,125,0.18),rgba(123,94,167,0.12)_32%,rgba(49,122,196,0.1)_54%,rgba(255,255,255,0)_74%)] blur-[26px]" />
                <motion.div
                  animate={{ scale: zoomScale }}
                  transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="relative h-full w-full"
                  style={{ transformOrigin: '50% 50%' }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ transform: `rotate(${-rotationOffset}deg)` }}
                  >
                    <motion.img
                      src={WHEEL_MEDALLION_SRC}
                      alt=""
                      draggable={false}
                      initial={introEnabled ? { opacity: 0, scale: 0.985 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={introTransition}
                      className="h-full w-full select-none object-contain"
                    />
                  </div>

                  <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="absolute inset-0 h-full w-full overflow-visible">
                    {ZODIAC_SIGNS.map((sign, index) => {
                      const midDeg = normalizeDegrees(index * 30 + 15 - rotationOffset);
                      const labelPoint = polarPoint(midDeg, ZODIAC_LABEL_RADIUS);
                      const dotPoint = polarPoint(midDeg, OUTER_RIM_RADIUS - 20);
                      const style = getZodiacElementStyle(sign);
                      return (
                        <g key={`sign-label-${sign}`}>
                          <text
                            x={labelPoint.x}
                            y={labelPoint.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#344A6A"
                            style={{ fontSize: 6.9, fontWeight: 700, letterSpacing: '0.08em' }}
                          >
                            {getZodiacShortLabel(language, sign as ZodiacSign)}
                          </text>
                          <circle cx={dotPoint.x} cy={dotPoint.y} r={1.35} fill={style.text} opacity={0.45} />
                        </g>
                      );
                    })}

                    {houseCusps.map((house, index) => {
                      const adjustedDeg = normalizeDegrees(house.rawLongitude - rotationOffset);
                      const from = polarPoint(adjustedDeg, INNER_CENTER_RADIUS + 2);
                      const to = polarPoint(adjustedDeg, HOUSE_RING_RADIUS - 2);
                      const emphatic = house.house === 1 || house.house === 4 || house.house === 7 || house.house === 10;
                      return (
                        <motion.line
                          key={`house-line-${house.house}-${index}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={emphatic ? 'rgba(243,248,255,0.95)' : 'rgba(215,225,242,0.74)'}
                          strokeWidth={emphatic ? 1.05 : 0.58}
                          initial={introEnabled ? { pathLength: 0, opacity: 0.1 } : false}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.22 : 0 }}
                        />
                      );
                    })}

                    {aspectLines.map((aspect) => {
                      const style = aspectStyles[aspect.type];
                      const from = polarPoint(aspect.from.adjustedDeg, aspect.from.displayRadius);
                      const to = polarPoint(aspect.to.adjustedDeg, aspect.to.displayRadius);
                      const opacity = getAspectOpacity(focusedAspectPlanet, aspect.from.key, aspect.to.key) * 0.72;
                      return (
                        <motion.line
                          key={aspect.id}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={style.stroke}
                          strokeWidth={style.width + (aspect.orb < 1 ? 0.2 : 0)}
                          strokeDasharray={style.dash}
                          opacity={opacity}
                          initial={introEnabled ? { opacity: 0 } : false}
                          animate={{ opacity }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.68 : 0 }}
                        />
                      );
                    })}

                    {displayPlanets.map((planet) => {
                      if (planet.lineTargetRadius == null) return null;
                      const from = polarPoint(planet.adjustedDeg, planet.displayRadius + Math.max(planet.visualRadius - 1.8, 8));
                      const to = polarPoint(planet.adjustedDeg, planet.lineTargetRadius);
                      return (
                        <line
                          key={`leader-${planet.key}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="#DCE5F6"
                          strokeWidth="0.8"
                          strokeDasharray="2 2.4"
                          opacity="0.72"
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
                            fill="rgba(246,250,255,0.88)"
                            style={{ fontSize: 8, fontWeight: 600 }}
                          >
                            {house.house}
                          </text>
                        );
                      })}

                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={HOUSE_DOTTED_RADIUS} fill="none" stroke="rgba(224,233,247,0.82)" strokeWidth="0.8" strokeDasharray="2 3.8" />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={INNER_CENTER_RADIUS} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.42)" strokeWidth="0.72" />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={3.2} fill="rgba(255,255,255,0.82)" />

                    {displayPlanets.map((planet, index) => {
                      const meta = getPlanetMeta(planet.key);
                      const point = polarPoint(planet.adjustedDeg, planet.displayRadius);
                      const active = selectedPlanet === planet.key;
                      const chipRadius = planet.locked ? 6.8 : Math.max(planet.visualRadius - 1.8, 8.5);
                      const chipStroke = planet.locked ? '#D6DDEA' : meta.color;
                      const chipFill = planet.locked ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.98)';
                      const iconSize = chipRadius * (planet.locked ? 1.04 : 1.14);
                      return (
                        <g key={planet.key}>
                          {active ? (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={chipRadius + 4}
                              fill="none"
                              stroke={`${meta.color}33`}
                              strokeWidth="3"
                            />
                          ) : null}
                          <motion.circle
                            cx={point.x}
                            cy={point.y}
                            r={chipRadius}
                            fill={chipFill}
                            stroke={chipStroke}
                            strokeWidth={planet.locked ? 1.05 : active ? 1.7 : 1.25}
                            style={{ filter: 'drop-shadow(0 2px 7px rgba(5,19,46,0.18))' }}
                            initial={introEnabled ? { opacity: 0, scale: 0.82 } : false}
                            animate={{ opacity: 1, scale: active ? 1.03 : 1 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: introEnabled ? 0.38 + index * 0.055 : 0 }}
                          />
                          {renderPlanetIcon(planet.key, point.x, point.y, iconSize, planet.locked ? '#AEB9CC' : meta.color, planet.locked)}
                          {planet.retrograde ? (
                            <>
                              <circle cx={point.x + chipRadius - 0.6} cy={point.y - chipRadius + 0.8} r={4} fill="white" stroke="#F6D9D8" strokeWidth="0.6" />
                              <text x={point.x + chipRadius - 0.6} y={point.y - chipRadius + 0.8} textAnchor="middle" dominantBaseline="middle" fill="#E53935" style={{ fontSize: 6, fontWeight: 700 }}>
                                R
                              </text>
                            </>
                          ) : null}
                          {zoomScale > 1.5 && planet.degree != null ? (
                            <text
                              x={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).x}
                              y={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(246,250,255,0.92)"
                              style={{ fontSize: 7.3, fontWeight: 600 }}
                            >
                              {formatDegree(planet.degree)}
                            </text>
                          ) : null}
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={PLANET_TOUCH_RADIUS}
                            fill="transparent"
                            data-planet-touch="true"
                            onPointerDown={() => handlePlanetPressStart(planet.key, !planet.locked)}
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

          {layerMode === 'details' && isPremium ? (
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
                          showToast({ message: language === 'en' ? `${tab.label} will appear here later` : `${tab.label} появятся здесь позже` });
                          return;
                        }
                        setActiveMiniTab(tab.id);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all',
                        active ? 'bg-white text-text-main shadow-[0_4px_10px_rgba(0,0,0,0.06)]' : 'text-text-muted'
                      )}
                    >
                      <span>{tab.label}</span>
                      {tab.locked ? <Lock className="h-3 w-3" strokeWidth={2} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {!isPremium && isDetailsTeaserVisible ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22 }}
                className="mx-auto mt-3 w-full max-w-[19.5rem] rounded-[22px] border border-black/[0.04] bg-white/92 px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#F5F0FB] text-[#7B5EA7]">
                    <Info className="h-4 w-4" strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-tight text-text-main">{detailsCopy.title}</p>
                    <p className="mt-1 text-[12px] leading-[1.5] text-text-muted">{detailsCopy.body}</p>
                    <button
                      type="button"
                      onClick={onRequestPremium}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#7B5EA7]/14 bg-[#F7F2FD] px-3 py-1.5 text-[12px] font-medium text-[#7B5EA7]"
                    >
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                      {detailsCopy.cta}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {visibleToast ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mx-auto mt-3 w-full max-w-[19.5rem] rounded-[18px] border border-black/[0.04] bg-white/94 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] leading-relaxed text-text-main">{visibleToast.message}</p>
                  {visibleToast.cta ? (
                    <button type="button" onClick={onRequestPremium} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#7B5EA7]">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                      {visibleToast.cta}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className="mt-3 min-h-0 overflow-hidden rounded-t-[24px] border border-black/[0.04] bg-white/92 shadow-[0_-8px_28px_rgba(0,0,0,0.05)]"
            style={{ height: isPanelExpanded ? EXPANDED_PANEL_HEIGHT : DEFAULT_PANEL_HEIGHT, minHeight: DEFAULT_PANEL_MIN_HEIGHT }}
            onTouchStart={handlePanelTouchStart}
            onTouchEnd={handlePanelTouchEnd}
          >
            <button type="button" onClick={() => setIsPanelExpanded((current) => !current)} className="flex w-full items-center justify-center px-5 pb-2 pt-3">
              <span className="h-1.5 w-10 rounded-full bg-black/[0.08]" />
              <span className="sr-only">{language === 'en' ? 'Expand insight' : 'Развернуть инсайт'}</span>
            </button>

            <div className="flex h-[calc(100%-2rem)] flex-col px-5 pb-5">
              {insightState.status === 'idle' || !selectedPlanet || !selectedPlanetMeta || !selectedPlanetData ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F0FB] text-[#7B5EA7]">
                    <Sparkles className="h-5 w-5" strokeWidth={2.1} />
                  </div>
                  <p className="max-w-[16rem] text-[14px] leading-relaxed text-text-muted">{buildDefaultHint(language, isPremium, layerMode)}</p>
                </div>
              ) : insightState.status === 'loading' ? (
                <div className="flex h-full flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={selectedPlanetMeta.color} strokeWidth={1.9} />
                    </div>
                    <div>
                      <p className="text-[17px] font-medium text-text-main">{selectedPlanetData.label}</p>
                      <p className="text-[13px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedPlanetData.sign, selectedPlanetData.degree)}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-2 text-[13px] text-text-muted">
                      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-black/[0.08] border-t-[#7B5EA7]" />
                      {loadingInsightLabel(language)}
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-black/[0.04]" />
                      <div className="h-3 w-[92%] rounded-full bg-black/[0.035]" />
                      <div className="h-3 w-[76%] rounded-full bg-black/[0.03]" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white" style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}>
                      <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={selectedPlanetMeta.color} strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[17px] font-medium text-text-main">{selectedInsight?.title}</p>
                          <p className="text-[13px] text-[#7B5EA7]">{selectedInsight ? formatSignAndDegree(language, selectedInsight.sign, selectedInsight.degree) : ''}</p>
                          <p className="mt-1 text-[12px] text-[#A0A5B1]">
                            {selectedInsight?.house ? (language === 'en' ? `House ${selectedInsight.house}` : `${selectedInsight.house} дом`) : (language === 'en' ? 'House is hidden' : 'Дом скрыт')}
                          </p>
                        </div>
                        <button type="button" onClick={() => setIsPanelExpanded((current) => !current)} className="shrink-0 text-text-muted" aria-label={language === 'en' ? 'Expand insight' : 'Развернуть инсайт'}>
                          {isPanelExpanded ? <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2} /> : <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={cn('mt-4 min-h-0', isPanelExpanded ? 'overflow-y-auto pr-1' : 'overflow-hidden')}>
                    {insightState.isFallback ? (
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[#F7F2FD] px-3 py-2.5 text-[12px] text-[#7B5EA7]">
                        <p className="leading-relaxed">
                          {language === 'en'
                            ? 'Showing a base insight for now. You can refresh for a fuller version.'
                            : 'Пока показываем базовый инсайт. Можно обновить и попробовать получить более полный вариант.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPlanet) void fetchInsightForPlanet(selectedPlanet);
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#7B5EA7]/14 bg-white px-2.5 py-1 text-[11px] font-medium text-[#7B5EA7]"
                        >
                          <RefreshCw className="h-3 w-3" strokeWidth={2} />
                          {language === 'en' ? 'Retry' : 'Повторить'}
                        </button>
                      </div>
                    ) : null}
                    <p className="text-[14px] leading-[1.62] text-[#3A3A3C]">{selectedInsight?.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedInsight?.tags.map((tag) => (
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

      </div>
    );
  }
);

TrueNatalWheelHero.displayName = 'TrueNatalWheelHero';
