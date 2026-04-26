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
  WHEEL_CENTER,
  WHEEL_VIEWBOX,
  type NatalPlanetKey,
} from '../../lib/natalWheel';
import { ZODIAC_SIGNS, type ZodiacSign } from '../../lib/zodiac-utils';
import { getCachedWheelInsight, getWheelInsight } from '../../services/astrologyService';
import { ZodiacIllustrationIcon } from './AstroWheelIcons';

const INTRO_TOTAL_MS = 760;
const WHEEL_MEDALLION_SRC = '/zodiac_wheel_transparent_optimized.webp';
const ZODIAC_LABEL_RADIUS = 151.8;
const ZODIAC_SECTOR_HALF_SPAN = 15;
const PLANET_TOUCH_RADIUS = 24;
const SUN_TOUCH_RADIUS = 31;
const ASPECT_TOUCH_RADIUS = 5.3;
const PLANET_MIN_GAP = 6.2;
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

const PLANET_ORBIT_LANES = [36, 48, 60, 72, 84] as const;

const PLANET_PREFERRED_LANE: Record<NatalPlanetKey, number> = {
  sun: 0,
  moon: 2,
  rising: 4,
  mercury: 1,
  venus: 2,
  mars: 3,
  jupiter: 4,
  saturn: 4,
  uranus: 2,
  neptune: 3,
  pluto: 4,
  chiron: 0,
};

const PLANET_ASSETS: Record<NatalPlanetKey, string> = {
  sun: '/astro-planets/sun.webp',
  moon: '/astro-planets/moon.webp',
  rising: '/astro-planets/asc.webp',
  mercury: '/astro-planets/mercury.webp',
  venus: '/astro-planets/venus.webp',
  mars: '/astro-planets/mars.webp',
  jupiter: '/astro-planets/jupiter.webp',
  saturn: '/astro-planets/saturn.webp',
  uranus: '/astro-planets/uranus.webp',
  neptune: '/astro-planets/neptune.webp',
  pluto: '/astro-planets/pluto.webp',
  chiron: '/astro-planets/chiron.webp',
};

const ZODIAC_ICON_TARGETS: Record<ZodiacSign, { x: number; y: number; rx: number; ry: number }> = {
  Aries: { x: 179, y: 91, rx: 31, ry: 34 },
  Taurus: { x: 234, y: 96, rx: 33, ry: 34 },
  Gemini: { x: 274, y: 129, rx: 34, ry: 38 },
  Cancer: { x: 294, y: 179, rx: 38, ry: 35 },
  Leo: { x: 266, y: 231, rx: 38, ry: 36 },
  Virgo: { x: 224, y: 271, rx: 34, ry: 36 },
  Libra: { x: 179, y: 284, rx: 38, ry: 32 },
  Scorpio: { x: 128, y: 272, rx: 35, ry: 37 },
  Sagittarius: { x: 88, y: 235, rx: 34, ry: 38 },
  Capricorn: { x: 68, y: 179, rx: 39, ry: 44 },
  Aquarius: { x: 85, y: 126, rx: 34, ry: 39 },
  Pisces: { x: 126, y: 92, rx: 38, ry: 34 },
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
  if (planet === 'jupiter' || planet === 'saturn') return 12.6;
  if (planet === 'moon' || planet === 'rising') return 11.8;
  if (planet === 'chiron') return 10.4;
  return 11.2;
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

function resolveZodiacFromPoint(point: WheelPoint): ZodiacSign | null {
  return (
    ZODIAC_SIGNS.map((sign) => {
      const target = ZODIAC_ICON_TARGETS[sign];
      const score = ((point.x - target.x) / target.rx) ** 2 + ((point.y - target.y) / target.ry) ** 2;
      return { sign, score };
    })
      .filter((item) => item.score <= 1.18)
      .sort((a, b) => a.score - b.score)[0]?.sign || null
  );
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

function entityKey(entity: SelectedEntity | null) {
  return entity ? `${entity.entityType}:${entity.entityId}` : null;
}

function getInwardPressOffset(point: WheelPoint, distanceAmount: number) {
  const dx = WHEEL_CENTER - point.x;
  const dy = WHEEL_CENTER - point.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: (dx / length) * distanceAmount,
    y: (dy / length) * distanceAmount,
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
  aspect,
}: {
  insight: WheelInsight | null;
  language: Language;
  aspect?: WheelAspectLine | null;
}) {
  if (!insight) {
    return (
      <div className="grid h-10 w-10 place-items-center text-[18px] font-semibold text-[#7B5EA7]">
        {language === 'en' ? 'L' : 'L'}
      </div>
    );
  }

  if (insight.entityType === 'planet') {
    const planet = insight.entityId as NatalPlanetKey;
    return (
      <img
        src={PLANET_ASSETS[planet]}
        alt=""
        draggable={false}
        className="h-14 w-14 object-contain drop-shadow-[0_8px_14px_rgba(31,41,55,0.16)]"
      />
    );
  }

  if (insight.entityType === 'zodiac') {
    return (
      <div className="grid h-12 w-12 place-items-center text-[#17365F]">
        <ZodiacIllustrationIcon sign={insight.entityId as ZodiacSign} width={38} height={38} stroke="#17365F" strokeWidth={1.9} />
      </div>
    );
  }

  if (aspect) {
    return (
      <div className="flex h-12 w-[5.2rem] items-center justify-center">
        <img src={PLANET_ASSETS[aspect.from.key]} alt="" draggable={false} className="h-10 w-10 object-contain drop-shadow-[0_6px_10px_rgba(31,41,55,0.14)]" />
        <span className="-mx-1 h-[2px] w-7 rounded-full bg-[#7B5EA7]/60" />
        <img src={PLANET_ASSETS[aspect.to.key]} alt="" draggable={false} className="h-10 w-10 object-contain drop-shadow-[0_6px_10px_rgba(31,41,55,0.14)]" />
      </div>
    );
  }

  return (
    <div className="relative grid h-12 w-12 place-items-center">
      <span className="absolute h-[2px] w-8 rotate-[-28deg] rounded-full bg-[#7B5EA7]" />
      <span className="absolute left-3 top-4 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#7B5EA7]" />
      <span className="absolute bottom-4 right-3 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-[#7B5EA7]" />
    </div>
  );
}

function PlanetImageButton({
  planet,
  active,
  pressed,
  related,
  shouldReduceMotion,
}: {
  planet: DisplayPlanet;
  active: boolean;
  pressed: boolean;
  related: boolean;
  shouldReduceMotion: boolean;
}) {
  if (planet.key === 'sun') return null;

  const imageSize = planet.visualRadius * 2.72;
  const mutedOpacity = related ? 1 : 0.6;

  return (
    <motion.g
      initial={false}
      animate={{
        scale: pressed ? 0.88 : active ? 1.08 : 1,
        opacity: mutedOpacity,
      }}
      transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: `${planet.point.x}px ${planet.point.y}px` }}
    >
      {active ? (
        <image
          href={PLANET_ASSETS[planet.key]}
          x={planet.point.x - imageSize * 0.58}
          y={planet.point.y - imageSize * 0.58}
          width={imageSize * 1.16}
          height={imageSize * 1.16}
          opacity="0.22"
          style={{ filter: 'blur(2px) saturate(1.08)' }}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
      <image
        href={PLANET_ASSETS[planet.key]}
        x={planet.point.x - imageSize / 2}
        y={planet.point.y - imageSize / 2}
        width={imageSize}
        height={imageSize}
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: pressed ? 'brightness(0.86) contrast(1.08)' : active ? 'brightness(1.08) saturate(1.06)' : undefined }}
      />
    </motion.g>
  );
}

function PressedWheelCutout({
  clipId,
  target,
  active,
  pressed,
}: {
  clipId: string;
  target: WheelPoint;
  active: boolean;
  pressed: boolean;
}) {
  if (!active && !pressed) return null;

  const offset = getInwardPressOffset(target, pressed ? 2.4 : -1.1);
  return (
    <motion.image
      href={WHEEL_MEDALLION_SRC}
      x={0}
      y={0}
      width={WHEEL_VIEWBOX}
      height={WHEEL_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      clipPath={`url(#${clipId})`}
      initial={false}
      animate={{
        x: offset.x,
        y: offset.y,
        scale: pressed ? 0.985 : 1.01,
        opacity: pressed ? 0.94 : 0.98,
      }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{
        transformOrigin: `${target.x}px ${target.y}px`,
        filter: pressed ? 'brightness(0.88) contrast(1.1) saturate(1.02)' : 'brightness(1.08) contrast(1.04) saturate(1.06)',
      }}
    />
  );
}

export const TrueNatalWheelHero = memo<TrueNatalWheelHeroProps>(
  ({ profile, chartData, chartId = null, shouldAnimateIntro = false, onIntroComplete, onOpenChart }) => {
    const language: Language = profile.language === 'en' ? 'en' : 'ru';
    const shouldReduceMotion = useReducedMotion();
    const clipPrefix = useId().replace(/:/g, '');
    const sunClipId = `${clipPrefix}-sun`;
    const wheelRef = useRef<HTMLDivElement | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
    const [pressedEntity, setPressedEntity] = useState<SelectedEntity | null>(null);
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
            const score = nearest - Math.abs(laneIndex - preferredLane) * 1.4 - anglePenalty;
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
        return [];
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

    const handleWheelPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const point = getPointerInViewBox(event, wheelRef.current);
        if (!point) return;
        setPressedEntity(resolveSelectionFromPoint(point, displayPlanets, aspectLines));
      },
      [aspectLines, displayPlanets]
    );

    const handleWheelPointerUp = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const point = getPointerInViewBox(event, wheelRef.current);
        if (!point) {
          setPressedEntity(null);
          return;
        }
        const selection = resolveSelectionFromPoint(point, displayPlanets, aspectLines);
        if (selection) {
          setSelectedEntity(selection);
        }
        window.setTimeout(() => setPressedEntity(null), 130);
      },
      [aspectLines, displayPlanets]
    );

    const activeInsight = remoteInsight || selectionPreview;
    const selectedInsightKicker = activeInsight ? getEntityKicker(language, activeInsight) : null;
    const selectedInsightTags = activeInsight ? visibleTags(activeInsight.tags) : [];
    const layerLabels = buildLayerLabels(language);
    const selectedKey = entityKey(selectedEntity);
    const pressedKey = entityKey(pressedEntity);

    return (
      <div className="relative flex h-full min-h-0 flex-col pb-2">
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <div className="relative mx-auto w-full max-w-[25.5rem]">
              <div
                ref={wheelRef}
                className="relative aspect-square w-full select-none touch-manipulation"
                onPointerDown={handleWheelPointerDown}
                onPointerUp={handleWheelPointerUp}
                onPointerCancel={() => setPressedEntity(null)}
                onPointerLeave={() => setPressedEntity(null)}
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
                      {ZODIAC_SIGNS.map((sign) => {
                        const target = ZODIAC_ICON_TARGETS[sign];
                        return (
                          <clipPath key={`zodiac-clip-${sign}`} id={`${clipPrefix}-zodiac-${sign}`}>
                            <ellipse cx={target.x} cy={target.y} rx={target.rx} ry={target.ry} />
                          </clipPath>
                        );
                      })}
                      <clipPath id={sunClipId}>
                        <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r="35" />
                      </clipPath>
                    </defs>

                    {ZODIAC_SIGNS.map((sign) => {
                      const target = ZODIAC_ICON_TARGETS[sign];
                      return (
                        <PressedWheelCutout
                          key={`zodiac-press-${sign}`}
                          clipId={`${clipPrefix}-zodiac-${sign}`}
                          target={target}
                          active={selectedKey === `zodiac:${sign}`}
                          pressed={pressedKey === `zodiac:${sign}`}
                        />
                      );
                    })}

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
                      const dimmed = !!selectedEntity && !active;
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

                    <PressedWheelCutout
                      clipId={sunClipId}
                      target={{ x: WHEEL_CENTER, y: WHEEL_CENTER }}
                      active={selectedKey === 'planet:sun'}
                      pressed={pressedKey === 'planet:sun'}
                    />

                    {displayPlanets.map((planet) => {
                      const selectedByPlanet = selectedPlanetKey === planet.key;
                      const selectedByAspect = !!selectedAspect && (selectedAspect.from.key === planet.key || selectedAspect.to.key === planet.key);
                      const selectedByZodiac = selectedZodiacSign != null && planet.sign === selectedZodiacSign;
                      const related = !selectedEntity || selectedByPlanet || selectedByAspect || selectedByZodiac;
                      const active = selectedByPlanet || selectedByAspect || selectedByZodiac;
                      const pressed = pressedKey === `planet:${planet.key}`;
                      return (
                        <PlanetImageButton
                          key={planet.key}
                          planet={planet}
                          active={active}
                          pressed={pressed}
                          related={related}
                          shouldReduceMotion={!!shouldReduceMotion}
                        />
                      );
                    })}

                  </svg>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-2 flex w-full max-w-[23.75rem] justify-center px-3">
            <button
              type="button"
              onClick={onOpenChart}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1F2937] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(31,41,55,0.18)] transition active:scale-[0.98]"
            >
              {buildOpenChartLabel(language)}
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
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
                    <SelectedBadge insight={activeInsight} language={language} aspect={selectedAspect} />
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
