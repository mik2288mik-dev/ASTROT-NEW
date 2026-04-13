import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getZodiacSign } from '../../constants';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  NatalHouseData,
  PlanetInsight,
  UserProfile,
} from '../../types';
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

const HOUSE_LABEL_RADIUS = 60;
const PLANET_TOUCH_RADIUS = 24;
const PLANET_DEGREE_RADIUS_OFFSET = 16;
const LEADER_LINE_TARGET_RADIUS = 98;
const INTRO_TOTAL_MS = 980;
const ZODIAC_LABEL_RADIUS = OUTER_RIM_RADIUS - 8;
const WHEEL_MEDALLION_SRC = '/brand/natal-wheel-luxe-medallion.svg';
const FOCUS_SLOT_DEG = 315;
const DRAG_START_THRESHOLD = 1.6;
const INERTIA_STOP_THRESHOLD = 0.006;
const MAX_SPIN_VELOCITY = 0.75;
const PREVIEW_BODY_MAX = 148;

const MAJOR_ASPECTS: NatalAspectData['type'][] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

type DisplayPlanet = {
  key: NatalPlanetKey;
  rawLongitude: number;
  adjustedDeg: number;
  displayRadius: number;
  visualRadius: number;
  label: string;
  sign: string;
  degree: number | null;
  house: number | null;
  retrograde: boolean;
  previewOnly: boolean;
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
  previewOnly: boolean;
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

type DragState = {
  active: boolean;
  pointerId: number | null;
  startAngle: number;
  startRotation: number;
  lastAngle: number;
  lastTimestamp: number;
  velocity: number;
  moved: boolean;
};

const aspectStyles: Record<NatalAspectData['type'], { stroke: string; width: number; dash?: string }> = {
  conjunction: { stroke: '#9F88D4', width: 1.15 },
  opposition: { stroke: '#F26A5C', width: 0.95 },
  square: { stroke: '#F26A5C', width: 0.8 },
  trine: { stroke: '#58B487', width: 0.92 },
  sextile: { stroke: '#6EA7FF', width: 0.72 },
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

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
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

function midpointDegree(start: number, end: number) {
  const normalizedStart = normalizeDegrees(start);
  const span = normalizeDegrees(end - normalizedStart);
  return normalizeDegrees(normalizedStart + span / 2);
}

function angularDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
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

function buildDefaultHint(language: Language) {
  return language === 'en'
    ? 'Rotate the wheel or tap a planet to feel how it sounds in your chart.'
    : 'Прокрути колесо или нажми на планету, чтобы почувствовать, как она звучит в твоей карте.';
}

function buildPremiumMicrocopy(language: Language, previewOnly: boolean, isPremium: boolean) {
  if (isPremium) {
    return language === 'en'
      ? 'This is a live focus of your chart. Deeper readings will open inside the full card next.'
      : 'Это живой фокус твоей карты. Более глубокие чтения мы раскроем уже внутри полной карты.';
  }
  if (previewOnly) {
    return language === 'en'
      ? 'Premium opens the full meaning of this planet and its links with the rest of your chart.'
      : 'Premium раскрывает полный смысл этой планеты и её связи с остальной картой.';
  }
  return language === 'en'
    ? 'The rest of the planets and deeper links between them open in Premium.'
    : 'Остальные планеты и более глубокие связи между ними открываются в Premium.';
}

function loadingInsightLabel(language: Language) {
  return language === 'en' ? 'Preparing your insight…' : 'Собираем твой инсайт…';
}

function previewText(body: string, maxLength = PREVIEW_BODY_MAX) {
  const normalized = String(body || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  const firstTwoSentences = normalized.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim();
  if (firstTwoSentences && firstTwoSentences.length <= maxLength + 24) return firstTwoSentences;
  const slice = normalized.slice(0, maxLength).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const safeCut = lastSpace > Math.floor(maxLength * 0.65) ? lastSpace : maxLength;
  return `${slice.slice(0, safeCut).trim()}…`;
}

function resolvePointerAngle(event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
}

function renderPlanetIcon(planet: NatalPlanetKey, x: number, y: number, size: number, color: string) {
  return (
    <PlanetSymbolIcon
      planet={planet}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      stroke={color}
      strokeWidth={1.8}
    />
  );
}

function getChipRadius(planet: NatalPlanetKey) {
  if (planet === 'sun') return 11.4;
  if (planet === 'moon' || planet === 'rising') return 10.4;
  return 8.6;
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId, isPremium, shouldAnimateIntro = false, onIntroComplete }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const [selectedPlanet, setSelectedPlanet] = useState<NatalPlanetKey | null>(null);
    const [insightState, setInsightState] = useState<InsightState>({
      status: 'idle',
      planetId: null,
      content: null,
      isFallback: false,
      previewOnly: false,
    });

    const wheelRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<DragState>({
      active: false,
      pointerId: null,
      startAngle: 0,
      startRotation: 0,
      lastAngle: 0,
      lastTimestamp: 0,
      velocity: 0,
      moved: false,
    });
    const suppressPlanetTapRef = useRef(false);
    const inertiaFrameRef = useRef<number | null>(null);
    const snapAnimationRef = useRef<ReturnType<typeof animate> | null>(null);
    const insightCacheRef = useRef<Partial<Record<NatalPlanetKey, PlanetInsight>>>({});
    const latestInsightRequestRef = useRef(0);
    const rotationRef = useRef(0);
    const wheelRotation = useMotionValue(0);

    useMotionValueEvent(wheelRotation, 'change', (latest) => {
      rotationRef.current = latest;
    });

    const introEnabled = shouldAnimateIntro && !shouldReduceMotion;
    const introTransition = shouldReduceMotion
      ? { duration: 0.24 }
      : { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    useEffect(() => {
      if (!introEnabled || !onIntroComplete) return;
      const timer = setTimeout(() => onIntroComplete(), INTRO_TOTAL_MS);
      return () => clearTimeout(timer);
    }, [introEnabled, onIntroComplete]);

    useEffect(() => {
      return () => {
        if (inertiaFrameRef.current != null) cancelAnimationFrame(inertiaFrameRef.current);
        snapAnimationRef.current?.stop();
      };
    }, []);

    const stopWheelMotion = useCallback(() => {
      if (inertiaFrameRef.current != null) {
        cancelAnimationFrame(inertiaFrameRef.current);
        inertiaFrameRef.current = null;
      }
      snapAnimationRef.current?.stop();
      snapAnimationRef.current = null;
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
          displayRadius: PLANET_COLLISION_RADII[0],
          visualRadius: getChipRadius(planetKey),
          label: getPlanetDisplayName(planetKey, language),
          sign: position.sign,
          degree: typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : null,
          house: Number.isFinite(house) ? house : null,
          retrograde: !!position.retrograde,
          previewOnly: !isPremium && !getPlanetMeta(planetKey).freeInteractive,
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
          lineTargetRadius: displayRadius !== PLANET_COLLISION_RADII[0] ? LEADER_LINE_TARGET_RADIUS : null,
        });
      });

      return resolved.sort((a, b) => getPlanetMeta(a.key).order - getPlanetMeta(b.key).order);
    }, [chartData, isPremium, language, rotationOffset]);

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
          setInsightState({ status: 'ready', planetId: planetKey, content: cachedLocal, isFallback: false, previewOnly: false });
          return;
        }

        const fallbackInsight = buildPlanetInsight(chartData, planetKey, language);
        if (!profile.id) {
          setInsightState({ status: 'ready', planetId: planetKey, content: fallbackInsight, isFallback: true, previewOnly: false });
          return;
        }

        const requestId = latestInsightRequestRef.current + 1;
        latestInsightRequestRef.current = requestId;
        setInsightState({ status: 'loading', planetId: planetKey, content: null, isFallback: false, previewOnly: false });

        try {
          const cached = await getCachedPlanetInsight(String(profile.id), planetKey, language, chartId);
          if (cached && latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[planetKey] = cached;
            setInsightState({ status: 'ready', planetId: planetKey, content: cached, isFallback: false, previewOnly: false });
            return;
          }
        } catch {
          // Continue to generation.
        }

        try {
          const insight = await getPlanetInsight(profile, chartData, planetKey, chartId);
          insightCacheRef.current[planetKey] = insight;
          if (latestInsightRequestRef.current === requestId) {
            setInsightState({ status: 'ready', planetId: planetKey, content: insight, isFallback: false, previewOnly: false });
          }
        } catch {
          if (latestInsightRequestRef.current === requestId) {
            insightCacheRef.current[planetKey] = fallbackInsight;
            setInsightState({ status: 'ready', planetId: planetKey, content: fallbackInsight, isFallback: true, previewOnly: false });
          }
        }
      },
      [chartData, chartId, language, profile]
    );

    const focusPlanet = useCallback(
      (planetKey: NatalPlanetKey) => {
        const planet = displayPlanetMap.get(planetKey);
        if (!planet) return;
        stopWheelMotion();
        const current = rotationRef.current;
        const target = FOCUS_SLOT_DEG - planet.adjustedDeg;
        const nextRotation = current + shortestAngleDelta(current, target);
        if (shouldReduceMotion) {
          wheelRotation.set(nextRotation);
          return;
        }
        snapAnimationRef.current = animate(wheelRotation, nextRotation, {
          type: 'spring',
          stiffness: 120,
          damping: 20,
          mass: 0.8,
        });
      },
      [displayPlanetMap, shouldReduceMotion, stopWheelMotion, wheelRotation]
    );

    const startInertia = useCallback(
      (initialVelocity: number) => {
        if (shouldReduceMotion || Math.abs(initialVelocity) < INERTIA_STOP_THRESHOLD) return;
        stopWheelMotion();
        let velocity = clamp(initialVelocity, -MAX_SPIN_VELOCITY, MAX_SPIN_VELOCITY);
        let lastTime = performance.now();

        const tick = (now: number) => {
          const dt = now - lastTime;
          lastTime = now;
          wheelRotation.set(rotationRef.current + velocity * dt);
          velocity *= Math.pow(0.93, dt / 16.67);
          if (Math.abs(velocity) <= INERTIA_STOP_THRESHOLD) {
            inertiaFrameRef.current = null;
            return;
          }
          inertiaFrameRef.current = requestAnimationFrame(tick);
        };

        inertiaFrameRef.current = requestAnimationFrame(tick);
      },
      [shouldReduceMotion, stopWheelMotion, wheelRotation]
    );

    const activatePlanet = useCallback(
      (planetKey: NatalPlanetKey) => {
        if (suppressPlanetTapRef.current) return;
        const planet = displayPlanetMap.get(planetKey);
        if (!planet) return;

        setSelectedPlanet(planetKey);
        focusPlanet(planetKey);

        if (planet.previewOnly) {
          const previewInsight = buildPlanetInsight(chartData, planetKey, language);
          setInsightState({
            status: 'ready',
            planetId: planetKey,
            content: previewInsight,
            isFallback: true,
            previewOnly: true,
          });
          return;
        }

        void fetchInsightForPlanet(planetKey);
      },
      [chartData, displayPlanetMap, fetchInsightForPlanet, focusPlanet, language]
    );

    const handleWheelPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (!wheelRef.current) return;
        stopWheelMotion();
        const angle = resolvePointerAngle(event, wheelRef.current);
        suppressPlanetTapRef.current = false;
        dragStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          startAngle: angle,
          startRotation: rotationRef.current,
          lastAngle: angle,
          lastTimestamp: performance.now(),
          velocity: 0,
          moved: false,
        };
        wheelRef.current.setPointerCapture(event.pointerId);
      },
      [stopWheelMotion]
    );

    const handleWheelPointerMove = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId || !wheelRef.current) return;

        const angle = resolvePointerAngle(event, wheelRef.current);
        const deltaFromStart = shortestAngleDelta(drag.startAngle, angle);
        wheelRotation.set(drag.startRotation + deltaFromStart);

        const now = performance.now();
        const deltaFromLast = shortestAngleDelta(drag.lastAngle, angle);
        const dt = Math.max(now - drag.lastTimestamp, 1);
        drag.velocity = clamp(deltaFromLast / dt, -MAX_SPIN_VELOCITY, MAX_SPIN_VELOCITY);
        drag.lastAngle = angle;
        drag.lastTimestamp = now;

        if (!drag.moved && Math.abs(deltaFromStart) > DRAG_START_THRESHOLD) {
          drag.moved = true;
          suppressPlanetTapRef.current = true;
        }
      },
      [wheelRotation]
    );

    const handleWheelPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        drag.active = false;
        drag.pointerId = null;
        try {
          wheelRef.current?.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        if (drag.moved) {
          startInertia(drag.velocity);
          window.setTimeout(() => {
            suppressPlanetTapRef.current = false;
          }, 40);
        }
      },
      [startInertia]
    );

    const handleWheelPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
      suppressPlanetTapRef.current = false;
      try {
        wheelRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }, []);

    const selectedPlanetMeta = selectedPlanet ? getPlanetMeta(selectedPlanet) : null;
    const selectedPlanetData = selectedPlanet ? displayPlanetMap.get(selectedPlanet) || null : null;
    const selectedInsight = insightState.content;
    const insightMicrocopy = useMemo(
      () => buildPremiumMicrocopy(language, insightState.previewOnly, isPremium),
      [insightState.previewOnly, isPremium, language]
    );

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[19.5rem]">
              <div
                ref={wheelRef}
                className="relative aspect-square w-full select-none touch-none"
                style={{ touchAction: 'none' }}
                onPointerDown={handleWheelPointerDown}
                onPointerMove={handleWheelPointerMove}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={handleWheelPointerCancel}
              >
                <div className="pointer-events-none absolute inset-[4%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,210,120,0.20),rgba(130,112,205,0.10)_34%,rgba(91,145,219,0.09)_56%,rgba(255,255,255,0)_78%)] blur-[28px]" />

                <motion.div
                  style={{ rotate: wheelRotation }}
                  className="relative h-full w-full"
                  initial={introEnabled ? { opacity: 0, scale: 0.985 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={introTransition}
                >
                  <img
                    src={WHEEL_MEDALLION_SRC}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  />

                  <svg viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`} className="absolute inset-0 h-full w-full overflow-visible">
                    {ZODIAC_SIGNS.map((sign, index) => {
                      const midDeg = normalizeDegrees(index * 30 + 15 - rotationOffset);
                      const labelPoint = polarPoint(midDeg, ZODIAC_LABEL_RADIUS);
                      return (
                        <text
                          key={`sign-label-${sign}`}
                          x={labelPoint.x}
                          y={labelPoint.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(248,251,255,0.96)"
                          style={{ fontSize: 8.1, fontWeight: 700, letterSpacing: '0.08em' }}
                        >
                          {getZodiacShortLabel(language, sign as ZodiacSign)}
                        </text>
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
                          stroke={emphatic ? 'rgba(246,250,255,0.96)' : 'rgba(214,228,249,0.60)'}
                          strokeWidth={emphatic ? 1.02 : 0.56}
                          initial={introEnabled ? { pathLength: 0, opacity: 0.1 } : false}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.22 : 0 }}
                        />
                      );
                    })}

                    {houseLabels
                      .filter((house) => house.house === 1 || house.house === 4 || house.house === 7 || house.house === 10)
                      .map((house) => {
                        const point = polarPoint(house.adjustedDeg, HOUSE_LABEL_RADIUS);
                        return (
                          <text
                            key={`house-label-${house.house}`}
                            x={point.x}
                            y={point.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="rgba(244,248,255,0.84)"
                            style={{ fontSize: 8, fontWeight: 600 }}
                          >
                            {house.house}
                          </text>
                        );
                      })}

                    {selectedAspectLines.map((aspect) => {
                      const style = aspectStyles[aspect.type];
                      const from = polarPoint(aspect.from.adjustedDeg, aspect.from.displayRadius);
                      const to = polarPoint(aspect.to.adjustedDeg, aspect.to.displayRadius);
                      return (
                        <motion.line
                          key={aspect.id}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={style.stroke}
                          strokeWidth={style.width + (aspect.orb < 1 ? 0.18 : 0)}
                          strokeDasharray={style.dash}
                          opacity={0.72}
                          initial={introEnabled ? { opacity: 0 } : false}
                          animate={{ opacity: 0.72 }}
                          transition={{ ...introTransition, delay: introEnabled ? 0.68 : 0 }}
                        />
                      );
                    })}

                    {displayPlanets.map((planet) => {
                      if (planet.lineTargetRadius == null) return null;
                      const from = polarPoint(planet.adjustedDeg, planet.displayRadius + Math.max(planet.visualRadius - 1.3, 8));
                      const to = polarPoint(planet.adjustedDeg, planet.lineTargetRadius);
                      return (
                        <line
                          key={`leader-${planet.key}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="rgba(220,229,246,0.72)"
                          strokeWidth="0.76"
                          strokeDasharray="2 2.5"
                        />
                      );
                    })}

                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={HOUSE_DOTTED_RADIUS}
                      fill="none"
                      stroke="rgba(225,234,248,0.78)"
                      strokeWidth="0.78"
                      strokeDasharray="2 4"
                    />

                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={INNER_CENTER_RADIUS}
                      fill="rgba(255,255,255,0.18)"
                      stroke="rgba(255,255,255,0.40)"
                      strokeWidth="0.7"
                    />
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={3} fill="rgba(255,255,255,0.86)" />

                    {displayPlanets.map((planet, index) => {
                      const meta = getPlanetMeta(planet.key);
                      const point = polarPoint(planet.adjustedDeg, planet.displayRadius);
                      const active = selectedPlanet === planet.key;
                      const iconSize = planet.visualRadius * 1.14;
                      return (
                        <g key={planet.key}>
                          {active ? (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={planet.visualRadius + 4}
                              fill="none"
                              stroke={`${meta.color}40`}
                              strokeWidth="3"
                            />
                          ) : null}

                          <motion.circle
                            cx={point.x}
                            cy={point.y}
                            r={planet.visualRadius}
                            fill="rgba(255,255,255,0.98)"
                            stroke={meta.color}
                            strokeWidth={active ? 1.7 : 1.2}
                            style={{ filter: 'drop-shadow(0 2px 7px rgba(6,18,42,0.18))' }}
                            initial={introEnabled ? { opacity: 0, scale: 0.82 } : false}
                            animate={{ opacity: 1, scale: active ? 1.04 : 1 }}
                            transition={{
                              duration: 0.28,
                              ease: [0.22, 1, 0.36, 1],
                              delay: introEnabled ? 0.38 + index * 0.055 : 0,
                            }}
                          />

                          {renderPlanetIcon(planet.key, point.x, point.y, iconSize, meta.color)}

                          {planet.retrograde ? (
                            <>
                              <circle
                                cx={point.x + planet.visualRadius - 0.4}
                                cy={point.y - planet.visualRadius + 0.5}
                                r={4}
                                fill="white"
                                stroke="#F6D9D8"
                                strokeWidth="0.6"
                              />
                              <text
                                x={point.x + planet.visualRadius - 0.4}
                                y={point.y - planet.visualRadius + 0.5}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#E53935"
                                style={{ fontSize: 6, fontWeight: 700 }}
                              >
                                R
                              </text>
                            </>
                          ) : null}

                          {selectedPlanet === planet.key && planet.degree != null ? (
                            <text
                              x={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).x}
                              y={polarPoint(planet.adjustedDeg, planet.displayRadius + PLANET_DEGREE_RADIUS_OFFSET).y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(246,250,255,0.94)"
                              style={{ fontSize: 7.1, fontWeight: 600 }}
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
                </motion.div>

                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,250,193,0.35),rgba(255,205,95,0.18)_48%,rgba(255,255,255,0)_72%)]"
                  animate={
                    shouldReduceMotion
                      ? { opacity: 0.82, scale: 1 }
                      : { opacity: [0.78, 0.98, 0.78], scale: [1, 1.045, 1] }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.2 }
                      : { duration: 5.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
                  }
                />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-3 w-full max-w-[20rem] px-2">
            <AnimatePresence mode="wait" initial={false}>
              {insightState.status === 'idle' || !selectedPlanet || !selectedPlanetMeta || !selectedPlanetData ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="py-2 text-center"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F0FB]/75 text-[#7B5EA7]">
                    <Sparkles className="h-4.5 w-4.5" strokeWidth={2.1} />
                  </div>
                  <p className="mx-auto max-w-[17rem] text-[14px] leading-[1.7] text-text-muted">{buildDefaultHint(language)}</p>
                  <p className="mx-auto mt-3 max-w-[18rem] text-[12px] leading-relaxed text-text-muted/85">
                    {buildPremiumMicrocopy(language, false, isPremium)}
                  </p>
                </motion.div>
              ) : insightState.status === 'loading' ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white"
                      style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}
                    >
                      <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={selectedPlanetMeta.color} strokeWidth={1.9} />
                    </div>
                    <div>
                      <p className="text-[17px] font-medium text-text-main">{selectedPlanetData.label}</p>
                      <p className="text-[13px] text-[#7B5EA7]">{formatSignAndDegree(language, selectedPlanetData.sign, selectedPlanetData.degree)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[13px] text-text-muted">
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-black/[0.08] border-t-[#7B5EA7]" />
                    {loadingInsightLabel(language)}
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-3 rounded-full bg-black/[0.04]" />
                    <div className="h-3 w-[88%] rounded-full bg-black/[0.035]" />
                    <div className="h-3 w-[71%] rounded-full bg-black/[0.03]" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={selectedPlanet}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24 }}
                  className="py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white"
                      style={{ borderColor: selectedPlanetMeta.color, color: selectedPlanetMeta.color }}
                    >
                      <PlanetSymbolIcon planet={selectedPlanet} width={20} height={20} stroke={selectedPlanetMeta.color} strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-medium text-text-main">{selectedInsight?.title}</p>
                      <p className="text-[13px] text-[#7B5EA7]">
                        {selectedInsight ? formatSignAndDegree(language, selectedInsight.sign, selectedInsight.degree) : ''}
                        {selectedInsight?.house ? ` · ${language === 'en' ? `House ${selectedInsight.house}` : `${selectedInsight.house} дом`}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[15px] leading-[1.72] text-text-main/86">
                    {previewText(selectedInsight?.body || '')}
                  </p>

                  <p className="mt-3 text-[12px] leading-relaxed text-text-muted/85">{insightMicrocopy}</p>

                  {insightState.isFallback && !insightState.previewOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPlanet) void fetchInsightForPlanet(selectedPlanet);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#7B5EA7]"
                    >
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
