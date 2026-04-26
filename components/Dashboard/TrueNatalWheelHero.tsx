import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  PlanetInsightTag,
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
const WHEEL_MEDALLION_SRC = '/zodiac_wheel_transparent_optimized.webp';
const ZODIAC_HIT_INNER_RADIUS = 107;
const ZODIAC_HIT_OUTER_RADIUS = 166;
const ZODIAC_LABEL_RADIUS = 151.8;
const ZODIAC_ICON_PRESS_RADIUS = 129;
const ZODIAC_SECTOR_HALF_SPAN = 15;
const PLANET_TOUCH_RADIUS = 25;
const SUN_TOUCH_RADIUS = 31;
const ASPECT_TOUCH_RADIUS = 5.3;
const PLANET_MIN_GAP = 5.5;
const MAJOR_ASPECTS: NatalAspectData['type'][] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

type InteractiveEntityType = Extract<WheelInsightEntityType, 'planet' | 'zodiac' | 'aspect'>;

type SelectedEntity = {
  entityType: InteractiveEntityType;
  entityId: string;
};

type WheelPoint = {
  x: number;
  y: number;
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
  point: WheelPoint;
};

type WheelAspectLine = {
  entityId: string;
  type: NatalAspectData['type'];
  orb: number;
  from: DisplayPlanet;
  to: DisplayPlanet;
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
  opposition: { stroke: '#E17366', width: 0.92 },
  square: { stroke: '#E17366', width: 0.86 },
  trine: { stroke: '#54A86F', width: 0.94 },
  sextile: { stroke: '#6E9EF5', width: 0.84, dash: '2.8 2.4' },
};

const PLANET_ORBIT_LANES = [58, 80, 102, 68, 91, 108] as const;

const PLANET_PREFERRED_LANE: Record<NatalPlanetKey, number> = {
  sun: 0,
  moon: 0,
  rising: 5,
  mercury: 1,
  venus: 2,
  mars: 3,
  jupiter: 4,
  saturn: 1,
  uranus: 2,
  neptune: 3,
  pluto: 4,
  chiron: 0,
};

const FORBIDDEN_TAG_WORDS = [
  'mutable',
  'fixed',
  'cardinal',
  'active point',
  'активн',
  'мутаб',
  'фиксирован',
  'кардин',
];

const normalizeDegrees = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const toRadians = (degree: number) => ((degree - 90) * Math.PI) / 180;

const polarPoint = (degree: number, radius: number): WheelPoint => ({
  x: WHEEL_CENTER + Math.cos(toRadians(degree)) * radius,
  y: WHEEL_CENTER + Math.sin(toRadians(degree)) * radius,
});

const distance = (a: WheelPoint, b: WheelPoint) => Math.hypot(a.x - b.x, a.y - b.y);

const angularDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

function distanceToSegment(point: WheelPoint, start: WheelPoint, end: WheelPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);
  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function angleFromPoint(point: WheelPoint) {
  const radians = Math.atan2(point.y - WHEEL_CENTER, point.x - WHEEL_CENTER);
  return normalizeDegrees((radians * 180) / Math.PI + 90);
}

function buildIdleHint(language: Language) {
  return language === 'en'
    ? 'Tap a sign, planet, or aspect line right on the wheel. A short reading for that layer appears here.'
    : 'Нажимай знак, планету или линию аспекта прямо на колесе. Здесь появится короткое объяснение этого слоя в твоей карте.';
}

function buildIdleTitle(language: Language) {
  return language === 'en' ? 'Natal wheel' : 'Натальное колесо';
}

function buildOpenChartLabel(language: Language) {
  return language === 'en' ? 'Open full chart' : 'Открыть карту';
}

function buildLayerLabels(language: Language) {
  return language === 'en'
    ? ['Signs', 'Planets', 'Aspects']
    : ['Знаки', 'Планеты', 'Аспекты'];
}

function getEntityKicker(language: Language, insight: WheelInsight) {
  if (language === 'en') {
    if (insight.entityType === 'planet') return insight.entityId === 'rising' ? 'Point' : 'Planet';
    if (insight.entityType === 'zodiac') return 'Sign';
    if (insight.entityType === 'aspect') return 'Aspect line';
    return 'Layer';
  }
  if (insight.entityType === 'planet') return insight.entityId === 'rising' ? 'Точка' : 'Планета';
  if (insight.entityType === 'zodiac') return 'Знак';
  if (insight.entityType === 'aspect') return 'Линия аспекта';
  return 'Слой';
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

function getPlanetVisualRadius(planet: NatalPlanetKey) {
  if (planet === 'sun') return 22;
  if (planet === 'moon' || planet === 'rising') return 12.8;
  if (planet === 'chiron') return 10.6;
  return 11.6;
}

function getZodiacLongLabel(language: Language, sign: ZodiacSign) {
  return getZodiacSign(language, sign).toUpperCase();
}

function getZodiacFontSize(label: string) {
  if (label.length >= 10) return 7.45;
  if (label.length >= 8) return 7.85;
  if (label.length >= 6) return 8.35;
  return 8.9;
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

function resolveZodiacFromPoint(point: WheelPoint): ZodiacSign | null {
  const radius = distance(point, { x: WHEEL_CENTER, y: WHEEL_CENTER });
  if (radius < ZODIAC_HIT_INNER_RADIUS || radius > ZODIAC_HIT_OUTER_RADIUS) return null;
  const angle = angleFromPoint(point);
  const index = Math.floor((angle + ZODIAC_SECTOR_HALF_SPAN) / 30) % ZODIAC_SIGNS.length;
  return ZODIAC_SIGNS[index];
}

function visibleTags(tags: PlanetInsightTag[] | undefined) {
  return (tags || [])
    .filter((tag) => {
      const label = tag.label.toLowerCase();
      return !FORBIDDEN_TAG_WORDS.some((word) => label.includes(word));
    })
    .slice(0, 2);
}

function getPointerInViewBox(event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement | null): WheelPoint | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * WHEEL_VIEWBOX,
    y: ((event.clientY - rect.top) / rect.height) * WHEEL_VIEWBOX,
  };
}

function resolveSelectionFromPoint(
  point: WheelPoint,
  planets: DisplayPlanet[],
  aspects: WheelAspectLine[]
): SelectedEntity | null {
  const planetHit = planets
    .map((planet) => {
      const hitRadius = planet.key === 'sun' ? SUN_TOUCH_RADIUS : PLANET_TOUCH_RADIUS;
      return {
        planet,
        distance: distance(point, planet.point),
        hitRadius,
      };
    })
    .filter((item) => item.distance <= item.hitRadius)
    .sort((a, b) => a.distance - b.distance)[0];

  if (planetHit) {
    return { entityType: 'planet', entityId: planetHit.planet.key };
  }

  const aspectHit = aspects
    .map((aspect) => ({
      aspect,
      distance: distanceToSegment(point, aspect.from.point, aspect.to.point),
    }))
    .filter((item) => item.distance <= ASPECT_TOUCH_RADIUS)
    .sort((a, b) => a.distance - b.distance)[0];

  if (aspectHit) {
    return { entityType: 'aspect', entityId: aspectHit.aspect.entityId };
  }

  const sign = resolveZodiacFromPoint(point);
  return sign ? { entityType: 'zodiac', entityId: sign } : null;
}

function SelectedBadge({
  insight,
  language,
}: {
  insight: WheelInsight | null;
  language: Language;
}) {
  if (!insight) {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#F4F6FA] text-[18px] font-semibold text-[#7B5EA7]">
        {language === 'en' ? 'L' : 'Л'}
      </div>
    );
  }

  if (insight.entityType === 'planet') {
    const planet = insight.entityId as NatalPlanetKey;
    const meta = getPlanetMeta(planet);
    return (
      <div className="grid h-12 w-12 place-items-center rounded-full border border-white/80 bg-[radial-gradient(circle_at_34%_24%,#ffffff_0%,#f7f2e8_48%,#d6dfec_100%)] shadow-[0_6px_18px_rgba(31,41,55,0.10)]">
        <PlanetSymbolIcon planet={planet} width={27} height={27} stroke={meta.color} strokeWidth={1.75} />
      </div>
    );
  }

  if (insight.entityType === 'zodiac') {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#F5F7FB] text-[#17365F] shadow-[inset_0_0_0_1px_rgba(23,54,95,0.08)]">
        <ZodiacIllustrationIcon sign={insight.entityId as ZodiacSign} width={29} height={29} stroke="#17365F" strokeWidth={1.85} />
      </div>
    );
  }

  return (
    <div className="relative grid h-12 w-12 place-items-center rounded-full bg-[#F8F5FF] shadow-[inset_0_0_0_1px_rgba(123,94,167,0.16)]">
      <span className="absolute h-[2px] w-8 rotate-[-28deg] rounded-full bg-[#7B5EA7]" />
      <span className="absolute left-3 top-4 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#7B5EA7]" />
      <span className="absolute bottom-4 right-3 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#7B5EA7]" />
    </div>
  );
}

function PlanetMedallion({
  planet,
  active,
  related,
  shouldReduceMotion,
  gradientId,
}: {
  planet: DisplayPlanet;
  active: boolean;
  related: boolean;
  shouldReduceMotion: boolean;
  gradientId: string;
}) {
  if (planet.key === 'sun') return null;

  const meta = getPlanetMeta(planet.key);
  const iconSize = planet.visualRadius * 1.45;
  const mutedOpacity = related ? 1 : 0.74;

  return (
    <motion.g
      initial={false}
      animate={{ scale: active ? 1.1 : 1, opacity: mutedOpacity }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: `${planet.point.x}px ${planet.point.y}px` }}
    >
      {active ? (
        <motion.circle
          cx={planet.point.x}
          cy={planet.point.y}
          r={planet.visualRadius + 5.2}
          fill="none"
          stroke={`${meta.color}66`}
          strokeWidth="2.6"
          initial={false}
          animate={shouldReduceMotion ? { opacity: 0.82 } : { opacity: [0.38, 0.9, 0.38] }}
          transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 2.3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
      ) : null}
      <circle
        cx={planet.point.x}
        cy={planet.point.y}
        r={planet.visualRadius + 1.5}
        fill="rgba(255,255,255,0.58)"
        opacity={0.78}
      />
      <circle
        cx={planet.point.x}
        cy={planet.point.y}
        r={planet.visualRadius}
        fill={`url(#${gradientId})`}
        stroke={meta.color}
        strokeWidth={active ? 1.65 : 1.05}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(12,24,52,0.18))' }}
      />
      <circle
        cx={planet.point.x - planet.visualRadius * 0.28}
        cy={planet.point.y - planet.visualRadius * 0.36}
        r={planet.visualRadius * 0.28}
        fill="rgba(255,255,255,0.72)"
      />
      <PlanetSymbolIcon
        planet={planet.key}
        x={planet.point.x - iconSize / 2}
        y={planet.point.y - iconSize / 2}
        width={iconSize}
        height={iconSize}
        stroke={meta.color}
        strokeWidth={1.82}
      />
      {planet.retrograde ? (
        <>
          <circle
            cx={planet.point.x + planet.visualRadius - 0.5}
            cy={planet.point.y - planet.visualRadius + 0.5}
            r={3.3}
            fill="white"
            stroke="#F1D7D2"
            strokeWidth="0.58"
          />
          <text
            x={planet.point.x + planet.visualRadius - 0.5}
            y={planet.point.y - planet.visualRadius + 0.6}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#D94B42"
            style={{ fontSize: 5.2, fontWeight: 800 }}
          >
            R
          </text>
        </>
      ) : null}
    </motion.g>
  );
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId = null, shouldAnimateIntro = false, onIntroComplete, onOpenChart }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const gradientPrefix = useId().replace(/:/g, '');
    const medallionGradientId = `${gradientPrefix}-planet-medallion`;
    const zodiacGlowId = `${gradientPrefix}-zodiac-glow`;
    const wheelRef = useRef<HTMLDivElement | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
    const [remoteInsight, setRemoteInsight] = useState<WheelInsight | null>(null);

    const introEnabled = shouldAnimateIntro && !shouldReduceMotion;
    const introTransition = shouldReduceMotion
      ? { duration: 0.22 }
      : { duration: 0.42, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

    useEffect(() => {
      if (!introEnabled || !onIntroComplete) return;
      const timer = window.setTimeout(() => onIntroComplete(), INTRO_TOTAL_MS);
      return () => window.clearTimeout(timer);
    }, [introEnabled, onIntroComplete]);

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
          displayRadius: planetKey === 'sun' ? 0 : PLANET_ORBIT_LANES[PLANET_PREFERRED_LANE[planetKey]],
          visualRadius: getPlanetVisualRadius(planetKey),
          sign: position.sign,
          degree: typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : null,
          house: Number.isFinite(house) ? house : null,
          retrograde: !!position.retrograde,
          point: planetKey === 'sun' ? { x: WHEEL_CENTER, y: WHEEL_CENTER } : polarPoint(rawLongitude, PLANET_ORBIT_LANES[PLANET_PREFERRED_LANE[planetKey]]),
        } as DisplayPlanet;
      }).filter(Boolean) as DisplayPlanet[];

      const resolved: DisplayPlanet[] = planets.filter((planet) => planet.key === 'sun');

      [...planets]
        .filter((planet) => planet.key !== 'sun')
        .sort((a, b) => a.rawLongitude - b.rawLongitude)
        .forEach((planet) => {
          const preferredLane = PLANET_PREFERRED_LANE[planet.key];
          const lanes = PLANET_ORBIT_LANES.map((_, offset) => (preferredLane + offset) % PLANET_ORBIT_LANES.length);
          let best: DisplayPlanet | null = null;
          let bestScore = -Number.POSITIVE_INFINITY;

          lanes.forEach((laneIndex) => {
            const displayRadius = PLANET_ORBIT_LANES[laneIndex];
            const point = polarPoint(planet.rawLongitude, displayRadius);
            const nearest = resolved
              .filter((prev) => prev.key !== 'sun')
              .reduce((min, prev) => Math.min(min, distance(point, prev.point) - (planet.visualRadius + prev.visualRadius)), Number.POSITIVE_INFINITY);
            const anglePenalty = resolved.some((prev) => prev.key !== 'sun' && angularDistance(prev.rawLongitude, planet.rawLongitude) < 7)
              ? 6
              : 0;
            const score = nearest - Math.abs(laneIndex - preferredLane) * 1.8 - anglePenalty;
            if (score > bestScore) {
              bestScore = score;
              best = {
                ...planet,
                displayRadius,
                point,
              };
            }
          });

          resolved.push(best || planet);
        });

      return resolved
        .map((planet) => {
          if (planet.key === 'sun') return planet;
          const crowded = resolved.some(
            (other) =>
              other.key !== planet.key &&
              other.key !== 'sun' &&
              distance(planet.point, other.point) < planet.visualRadius + other.visualRadius + PLANET_MIN_GAP
          );
          return crowded
            ? {
                ...planet,
                visualRadius: Math.max(10.2, planet.visualRadius - 0.8),
              }
            : planet;
        })
        .sort((a, b) => getPlanetMeta(a.key).order - getPlanetMeta(b.key).order);
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
    const selectedAspect =
      selectedEntity?.entityType === 'aspect'
        ? aspectLines.find((aspect) => aspect.entityId === selectedEntity.entityId) || null
        : null;

    const linkedAspectLines = useMemo(() => {
      if (selectedPlanetKey) {
        return aspectLines.filter((aspect) => aspect.from.key === selectedPlanetKey || aspect.to.key === selectedPlanetKey);
      }
      if (selectedAspect) return [selectedAspect];
      if (selectedZodiacSign) {
        return aspectLines.filter(
          (aspect) => aspect.from.sign === selectedZodiacSign || aspect.to.sign === selectedZodiacSign
        );
      }
      return [];
    }, [aspectLines, selectedAspect, selectedPlanetKey, selectedZodiacSign]);

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

    useEffect(() => {
      setRemoteInsight(null);
      const userId = profile.id;
      if (!selectedEntity || !userId) return;

      let cancelled = false;
      const loadInsight = async () => {
        try {
          const cached = await getCachedWheelInsight(
            userId,
            selectedEntity.entityType,
            selectedEntity.entityId,
            language,
            chartId
          );
          if (cancelled) return;
          if (cached) {
            setRemoteInsight(cached);
            return;
          }

          const generated = await getWheelInsight(
            profile,
            chartData,
            selectedEntity.entityType,
            selectedEntity.entityId,
            chartId
          );
          if (!cancelled) setRemoteInsight(generated);
        } catch {
          if (!cancelled) setRemoteInsight(null);
        }
      };

      void loadInsight();
      return () => {
        cancelled = true;
      };
    }, [chartData, chartId, language, profile, selectedEntity]);

    const handleWheelPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const point = getPointerInViewBox(event, wheelRef.current);
        if (!point) return;
        const selection = resolveSelectionFromPoint(point, displayPlanets, aspectLines);
        if (selection) {
          setSelectedEntity(selection);
        }
      },
      [aspectLines, displayPlanets]
    );

    const activeInsight = remoteInsight || selectionPreview;
    const selectedInsightKicker = activeInsight ? getEntityKicker(language, activeInsight) : null;
    const selectedInsightTags = activeInsight ? visibleTags(activeInsight.tags) : [];
    const layerLabels = buildLayerLabels(language);

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[25.5rem]">
              <div
                ref={wheelRef}
                className="relative aspect-square w-full select-none touch-manipulation"
                onPointerUp={handleWheelPointerUp}
              >
                <motion.div
                  className="relative h-full w-full"
                  initial={introEnabled ? { opacity: 0, scale: 0.986, y: 10 } : false}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={introTransition}
                >
                  <img
                    src={WHEEL_MEDALLION_SRC}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  />
                  <svg
                    viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  >
                    <defs>
                      <radialGradient id={medallionGradientId} cx="34%" cy="26%" r="72%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="48%" stopColor="#F7F2E7" />
                        <stop offset="100%" stopColor="#D9E2EF" />
                      </radialGradient>
                      <filter id={zodiacGlowId} x="-35%" y="-35%" width="170%" height="170%">
                        <feDropShadow dx="0" dy="2.2" stdDeviation="2.8" floodColor="#17365F" floodOpacity="0.18" />
                      </filter>
                    </defs>

                    {selectedZodiacSign ? (
                      (() => {
                        const index = ZODIAC_SIGNS.indexOf(selectedZodiacSign);
                        const { start, end, center } = getZodiacSectorAngles(index);
                        const iconPoint = polarPoint(center, ZODIAC_ICON_PRESS_RADIUS);
                        return (
                          <g>
                            <motion.path
                              d={describeRingSegment(start, end, ZODIAC_HIT_INNER_RADIUS, ZODIAC_HIT_OUTER_RADIUS)}
                              fill="rgba(255,255,255,0.16)"
                              stroke="rgba(23,54,95,0.36)"
                              strokeWidth="1.05"
                              initial={false}
                              animate={{ opacity: [0.74, 0.98, 0.74] }}
                              transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                              filter={`url(#${zodiacGlowId})`}
                            />
                            <motion.circle
                              cx={iconPoint.x}
                              cy={iconPoint.y}
                              r="24"
                              fill="rgba(16,39,74,0.12)"
                              stroke="rgba(221,189,111,0.72)"
                              strokeWidth="1.1"
                              initial={false}
                              animate={{ scale: shouldReduceMotion ? 1 : [0.96, 1, 0.96] }}
                              transition={shouldReduceMotion ? { duration: 0.14 } : { duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                              style={{ transformOrigin: `${iconPoint.x}px ${iconPoint.y}px` }}
                            />
                          </g>
                        );
                      })()
                    ) : null}

                    {ZODIAC_SIGNS.map((sign, index) => {
                      const { center } = getZodiacSectorAngles(index);
                      const label = getZodiacLongLabel(language, sign);
                      const point = polarPoint(center, ZODIAC_LABEL_RADIUS);
                      const flip = center > 90 && center < 270;
                      const rotation = flip ? center + 180 : center;
                      const isActive = selectedZodiacSign === sign;
                      return (
                        <text
                          key={`zodiac-label-${sign}`}
                          x={point.x}
                          y={point.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${rotation} ${point.x} ${point.y})`}
                          fill={isActive ? '#111827' : '#17365F'}
                          stroke="rgba(255,255,255,0.82)"
                          strokeWidth="0.62"
                          paintOrder="stroke"
                          style={{
                            fontSize: getZodiacFontSize(label),
                            fontWeight: 850,
                            letterSpacing: 0,
                          }}
                        >
                          {label}
                        </text>
                      );
                    })}

                    {aspectLines.map((aspect) => {
                      const style = aspectStyles[aspect.type];
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
                        <line
                          key={aspect.entityId}
                          x1={aspect.from.point.x}
                          y1={aspect.from.point.y}
                          x2={aspect.to.point.x}
                          y2={aspect.to.point.y}
                          stroke={style.stroke}
                          strokeWidth={active ? style.width + 0.58 : style.width}
                          strokeDasharray={style.dash}
                          opacity={active ? 0.72 : dimmed ? 0.05 : 0.16}
                          strokeLinecap="round"
                          style={{ filter: active ? `drop-shadow(0 0 3px ${style.stroke})` : undefined }}
                        />
                      );
                    })}

                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={selectedPlanetKey === 'sun' ? 29 : 24}
                      fill={selectedPlanetKey === 'sun' ? 'rgba(255,202,98,0.16)' : 'rgba(255,202,98,0.06)'}
                      stroke={selectedPlanetKey === 'sun' ? 'rgba(236,165,50,0.82)' : 'rgba(236,165,50,0.38)'}
                      strokeWidth={selectedPlanetKey === 'sun' ? 1.8 : 0.82}
                      style={{ filter: selectedPlanetKey === 'sun' ? 'drop-shadow(0 0 8px rgba(236,165,50,0.38))' : undefined }}
                    />

                    {displayPlanets.map((planet) => {
                      const selectedByPlanet = selectedPlanetKey === planet.key;
                      const selectedByAspect = !!selectedAspect && (selectedAspect.from.key === planet.key || selectedAspect.to.key === planet.key);
                      const selectedByZodiac = selectedZodiacSign != null && planet.sign === selectedZodiacSign;
                      const related = !selectedEntity || selectedByPlanet || selectedByAspect || selectedByZodiac;
                      const active = selectedByPlanet || selectedByAspect || selectedByZodiac;
                      return (
                        <PlanetMedallion
                          key={planet.key}
                          planet={planet}
                          active={active}
                          related={related}
                          shouldReduceMotion={!!shouldReduceMotion}
                          gradientId={medallionGradientId}
                        />
                      );
                    })}

                    <circle
                      cx={WHEEL_CENTER}
                      cy={WHEEL_CENTER}
                      r={OUTER_RIM_RADIUS - 1.5}
                      fill="none"
                      stroke="rgba(123,94,167,0.18)"
                      strokeWidth="1"
                      opacity="0.72"
                    />
                  </svg>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-3 w-full max-w-[23.75rem] px-3">
            <AnimatePresence mode="wait" initial={false}>
              {!activeInsight ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <SelectedBadge insight={null} language={language} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7B5EA7]">{buildIdleTitle(language)}</p>
                      <p className="mt-1 text-[14px] leading-[1.5] text-text-main/80">{buildIdleHint(language)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {layerLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-[#F4F6FA] px-2.5 py-1 text-[10.5px] font-medium leading-tight text-text-muted"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onOpenChart}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1F2937] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(31,41,55,0.18)] transition active:scale-[0.98]"
                  >
                    {buildOpenChartLabel(language)}
                    <ArrowRight size={15} strokeWidth={2.2} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={`${activeInsight.entityType}-${activeInsight.entityId}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <SelectedBadge insight={activeInsight} language={language} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7B5EA7]">{selectedInsightKicker}</p>
                      <p className="mt-0.5 text-[23px] font-semibold leading-tight text-text-main">{activeInsight.title}</p>
                      <p className="mt-1 text-[13px] leading-snug text-text-muted">{activeInsight.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-[14.5px] leading-[1.52] text-text-main/84">{activeInsight.body}</p>
                  {selectedInsightTags.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedInsightTags.map((tag) => (
                        <span key={tag.id} className="rounded-full bg-[#F4F6FA] px-2.5 py-1 text-[11.5px] leading-tight text-text-muted/88">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onOpenChart}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1F2937] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(31,41,55,0.18)] transition active:scale-[0.98]"
                  >
                    {buildOpenChartLabel(language)}
                    <ArrowRight size={15} strokeWidth={2.2} />
                  </button>
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
