import React from 'react';
import {
  BookOpen,
  CalendarDays,
  Circle,
  CircleDashed,
  Clock,
  Combine,
  Crosshair,
  Eclipse,
  GitCompareArrows,
  HeartHandshake,
  HelpCircle,
  House,
  Layers2,
  MapPin,
  Moon,
  Orbit,
  Telescope,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { KnowledgeCategoryId } from '../../lib/knowledge';
import { AstroTechnicalIcon, type AstroTechnicalIconKey } from './AstroTechnicalIcon';
import { PlanetIcon, type PlanetKey } from './PlanetIcon';
import { ZodiacIcon, type ZodiacSignKey } from './ZodiacIcon';
import { NatalChartIcon, ZodiacWheelIcon } from './UiIcons';

type KnowledgeArticleIconProps = {
  topicId: string;
  category: KnowledgeCategoryId;
};

const ICON_SIZE = 32;
const ICON_STROKE_WIDTH = 1.5;

const ZODIAC_SIGNS: readonly ZodiacSignKey[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

const PLANETS: readonly PlanetKey[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
];

const ANGLE_ICONS: Readonly<Record<string, PlanetKey>> = {
  ascendant: 'asc',
  descendant: 'desc',
  midheaven: 'mc',
  'imum-coeli': 'ic',
};

const ASPECT_ICONS: Readonly<Record<string, AstroTechnicalIconKey>> = {
  'aspect-conjunction': 'conjunction',
  'aspect-sextile': 'sextile',
  'aspect-square': 'square',
  'aspect-trine': 'trine',
  'aspect-opposition': 'opposition',
};

const TOPIC_PLANET_ICONS: Readonly<Record<string, PlanetKey>> = {
  'node-north': 'north-node',
  'node-south': 'south-node',
  'natal-moon': 'moon',
  'current-moon': 'moon',
  'moon-in-relationships': 'moon',
  'venus-in-relationships': 'venus',
  'mars-in-relationships': 'mars',
  'mercury-in-relationships': 'mercury',
};

const TOPIC_TECHNICAL_ICONS: Readonly<Record<string, AstroTechnicalIconKey>> = {
  'retrograde-motion': 'retrograde',
  'retrograde-natal': 'retrograde',
  'retrograde-transit': 'retrograde',
  'retrograde-station-direct': 'retrograde',
  'retrograde-mercury': 'retrograde',
  'transits-current-sky': 'transit',
  synastry: 'synastry',
  'two-chart-compatibility': 'synastry',
  'interchart-aspects': 'synastry',
};

const TOPIC_LUCIDE_ICONS: Readonly<Record<string, LucideIcon>> = {
  'what-chart-calculates': Crosshair,
  'birth-date-in-chart': CalendarDays,
  'birth-place-in-chart': MapPin,
  'birth-time-in-chart': Clock,
  'unknown-birth-time': HelpCircle,
  'how-to-read-natal-chart': BookOpen,
  'sign-elements': Layers2,
  'sign-modalities': Layers2,
  'zodiac-signs-vs-constellations': Telescope,
  'sign-vs-house': GitCompareArrows,
  'birth-time-and-houses': Clock,
  'aspect-orb': Orbit,
  'aspect-applying-separating': GitCompareArrows,
  'combine-planet-sign': Combine,
  'planet-in-house': Combine,
  'planet-aspects': Waypoints,
  'repeated-chart-themes': Layers2,
  'no-single-indicator': Layers2,
  'same-sign-different-people': Layers2,
  'sign-compatibility': HeartHandshake,
  'compatibility-not-fate': HeartHandshake,
  'natal-vs-current-period': GitCompareArrows,
  'forecast-day-week-month': CalendarDays,
  'forecast-not-guarantee': CalendarDays,
  'moon-phase': Eclipse,
  'new-moon': CircleDashed,
  'full-moon': Circle,
  'waxing-moon': Moon,
  'waning-moon': Moon,
  'lunar-cycle-calendar': CalendarDays,
};

const CATEGORY_LUCIDE_ICONS: Readonly<Partial<Record<KnowledgeCategoryId, LucideIcon>>> = {
  houses: House,
  angles: Crosshair,
  aspects: Waypoints,
  synthesis: Combine,
  compatibility: HeartHandshake,
  forecasts: CalendarDays,
  'moon-cycles': Moon,
};

function lucideIcon(Icon: LucideIcon) {
  return (
    <Icon
      className="knowledge-article-icon"
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE_WIDTH}
      aria-hidden="true"
    />
  );
}

export function KnowledgeArticleIcon({ topicId, category }: KnowledgeArticleIconProps) {
  const zodiacKey = topicId.startsWith('sign-')
    ? topicId.slice('sign-'.length) as ZodiacSignKey
    : null;
  if (zodiacKey && ZODIAC_SIGNS.includes(zodiacKey)) {
    return (
      <ZodiacIcon
        sign={zodiacKey}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const planetKey = topicId.startsWith('planet-')
    ? topicId.slice('planet-'.length) as PlanetKey
    : null;
  if (planetKey && PLANETS.includes(planetKey)) {
    return (
      <PlanetIcon
        planet={planetKey}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const houseMatch = /^house-(1[0-2]|[1-9])$/u.exec(topicId);
  if (houseMatch) {
    return lucideIcon(House);
  }

  const angleIcon = ANGLE_ICONS[topicId];
  if (angleIcon) {
    return (
      <PlanetIcon
        planet={angleIcon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const aspectIcon = ASPECT_ICONS[topicId];
  if (aspectIcon) {
    return (
      <AstroTechnicalIcon
        icon={aspectIcon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const topicPlanetIcon = TOPIC_PLANET_ICONS[topicId];
  if (topicPlanetIcon) {
    return (
      <PlanetIcon
        planet={topicPlanetIcon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const technicalIcon = TOPIC_TECHNICAL_ICONS[topicId];
  if (technicalIcon) {
    return (
      <AstroTechnicalIcon
        icon={technicalIcon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="knowledge-article-icon"
      />
    );
  }

  const topicLucideIcon = TOPIC_LUCIDE_ICONS[topicId];
  if (topicLucideIcon) return lucideIcon(topicLucideIcon);

  if (category === 'start') {
    return <NatalChartIcon className="knowledge-article-icon" size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
  }
  if (category === 'signs') {
    return <ZodiacWheelIcon className="knowledge-article-icon" size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
  }
  if (category === 'planets') {
    return <PlanetIcon planet="sun" className="knowledge-article-icon" size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
  }
  if (category === 'retrogrades') {
    return <AstroTechnicalIcon icon="retrograde" className="knowledge-article-icon" size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
  }
  if (category === 'nodes-points') {
    return <PlanetIcon planet="north-node" className="knowledge-article-icon" size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
  }

  const CategoryIcon = CATEGORY_LUCIDE_ICONS[category] || Orbit;
  return lucideIcon(CategoryIcon);
}
