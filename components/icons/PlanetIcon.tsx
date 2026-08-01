import React from 'react';

/**
 * Monochrome SVG icons for planets, lunar nodes, Asc/MC and Chiron.
 * Mirrors the standard astrological glyphs but rendered as clean line art —
 * no Unicode glyphs, no emoji.
 */

export type PlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'chiron' | 'lilith' | 'north-node' | 'south-node'
  | 'asc' | 'desc' | 'mc' | 'ic';

const ALIASES: Record<string, PlanetKey> = {
  Sun: 'sun', Солнце: 'sun',
  Moon: 'moon', Луна: 'moon',
  Mercury: 'mercury', Меркурий: 'mercury',
  Venus: 'venus', Венера: 'venus',
  Mars: 'mars', Марс: 'mars',
  Jupiter: 'jupiter', Юпитер: 'jupiter',
  Saturn: 'saturn', Сатурн: 'saturn',
  Uranus: 'uranus', Уран: 'uranus',
  Neptune: 'neptune', Нептун: 'neptune',
  Pluto: 'pluto', Плутон: 'pluto',
  Chiron: 'chiron', Хирон: 'chiron',
  Lilith: 'lilith', Лилит: 'lilith', 'Black Moon': 'lilith',
  'North Node': 'north-node', 'Северный Узел': 'north-node',
  'South Node': 'south-node', 'Южный Узел': 'south-node',
  Ascendant: 'asc', Асцендент: 'asc', ASC: 'asc',
  Descendant: 'desc', Десцендент: 'desc', DSC: 'desc', DESC: 'desc',
  Midheaven: 'mc', МС: 'mc', MC: 'mc',
  'Imum Coeli': 'ic', IC: 'ic',
};

export function resolvePlanetKey(input?: string | null): PlanetKey | null {
  if (!input) return null;
  return ALIASES[input.trim()] || null;
}

type Props = {
  planet: string | PlanetKey | null | undefined;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

const PATHS: Record<PlanetKey, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  moon: (
    <path d="M14 6 A6 6 0 1 0 14 18 A4.5 4.5 0 1 1 14 6 Z" />
  ),
  mercury: (
    <>
      <path d="M8 5 Q12 8 16 5" />
      <circle cx="12" cy="11" r="3" />
      <path d="M12 14 V19 M9 17 H15" />
    </>
  ),
  venus: (
    <>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M12 12.2 V19 M9 16 H15" />
    </>
  ),
  mars: (
    <>
      <circle cx="11" cy="13" r="3.2" />
      <path d="M13.4 10.6 L19 5 M19 5 H14.5 M19 5 V9.5" />
    </>
  ),
  jupiter: (
    <>
      <path d="M5 9 H13" />
      <path d="M9 7 V17" />
      <path d="M9 17 Q14 17 14 13" />
    </>
  ),
  saturn: (
    <>
      <path d="M8 5 V18 Q8 19.5 11 19.5" />
      <path d="M5 8 H11" />
      <path d="M11 11 Q15 11 15 15 Q15 19 11.5 19" />
    </>
  ),
  uranus: (
    <>
      <path d="M7 6 V13 M17 6 V13" />
      <path d="M7 9 H17" />
      <path d="M12 9 V18" />
      <circle cx="12" cy="20" r="1.5" />
    </>
  ),
  neptune: (
    <>
      <path d="M5 7 V12 Q5 17 12 17 Q19 17 19 12 V7" />
      <path d="M12 5 V19" />
      <path d="M9 18 H15" />
    </>
  ),
  pluto: (
    <>
      <circle cx="12" cy="8" r="2.2" />
      <path d="M12 10.2 V19" />
      <path d="M8 14 Q12 11.8 16 14" />
    </>
  ),
  chiron: (
    <>
      <circle cx="12" cy="6.5" r="1.8" />
      <path d="M12 8.3 V19" />
      <path d="M8 11 L16 14 M16 11 L8 14" />
    </>
  ),
  lilith: (
    <>
      <path d="M15.5 5.5 A6 6 0 1 0 15.5 15.5 A4.7 4.7 0 1 1 15.5 5.5 Z" />
      <path d="M12 16 V21 M9 19 H15" />
    </>
  ),
  'north-node': (
    <path d="M5 16 Q5 7 12 7 Q19 7 19 16 Q19 18 17 18 Q15 18 15 16 M5 16 Q5 18 7 18 Q9 18 9 16" />
  ),
  'south-node': (
    <path d="M5 8 Q5 17 12 17 Q19 17 19 8 Q19 6 17 6 Q15 6 15 8 M5 8 Q5 6 7 6 Q9 6 9 8" />
  ),
  asc: (
    <>
      <path d="M12 4 V20" />
      <path d="M7 9 L12 4 L17 9" />
    </>
  ),
  desc: (
    <>
      <path d="M12 4 V20" />
      <path d="M7 15 L12 20 L17 15" />
    </>
  ),
  mc: (
    <>
      <path d="M5 17 V8 L9 14 L13 8 V17" />
      <path d="M16 17 V8 Q19 8 19 11 Q19 14 16 14" />
    </>
  ),
  ic: (
    <>
      <path d="M7 6 V18" />
      <path d="M11 6 V18 M11 6 H16 Q19 6 19 9 Q19 12 16 12 H11" />
    </>
  ),
};

export const PlanetIcon: React.FC<Props> = ({
  planet,
  size = 16,
  stroke = 'currentColor',
  strokeWidth = 1.4,
  className = '',
}) => {
  const key =
    typeof planet === 'string'
      ? resolvePlanetKey(planet) || (planet in PATHS ? (planet as PlanetKey) : null)
      : planet ?? null;

  if (!key || !(key in PATHS)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
        <circle cx="12" cy="12" r="3" fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[key]}
    </svg>
  );
};
