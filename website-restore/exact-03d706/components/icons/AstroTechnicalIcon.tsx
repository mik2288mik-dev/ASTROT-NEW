import React from 'react';

export type AstroTechnicalIconKey =
  | `house-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile'
  | 'quincunx'
  | 'transit'
  | 'retrograde'
  | 'synastry'
  | 'arrow'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'pointer'
  | 'route';

type Props = {
  icon: AstroTechnicalIconKey;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  label?: string;
};

const HOUSE_PATTERN = /^house-(\d{1,2})$/u;

function HouseIcon({ house }: { house: number }) {
  return (
    <>
      <path d="M4 10.5 12 4l8 6.5V20H4Z" />
      <text
        x="12"
        y="16.2"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize={house > 9 ? 6.7 : 8}
        fontWeight="700"
      >
        {house}
      </text>
    </>
  );
}

const PATHS: Record<Exclude<AstroTechnicalIconKey, `house-${number}`>, React.ReactNode> = {
  conjunction: (
    <>
      <circle cx="10" cy="12" r="5" />
      <circle cx="16.5" cy="7.5" r="2.5" />
    </>
  ),
  opposition: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 16 16 8" />
      <circle cx="18" cy="6" r="2.5" />
    </>
  ),
  trine: <path d="M12 4 21 20H3Z" />,
  square: <rect x="5" y="5" width="14" height="14" />,
  sextile: (
    <>
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </>
  ),
  quincunx: (
    <>
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="17" r="2" />
      <path d="M7.7 15.9 12 7l4.3 8.9M9 7h6" />
    </>
  ),
  transit: (
    <>
      <circle cx="8" cy="12" r="4.5" />
      <path d="M12.5 12h7M16.5 8l3.5 4-3.5 4" />
    </>
  ),
  retrograde: (
    <>
      <path d="M7 19V5h5.5a4 4 0 0 1 0 8H7M12 13l5 6" />
      <path d="M20 8a8 8 0 0 0-13-3L4 8M4 8V3M4 8h5" />
    </>
  ),
  synastry: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
      <path d="M12 7.1a6 6 0 0 1 0 9.8" />
    </>
  ),
  arrow: <path d="M4 12h16M14 6l6 6-6 6" />,
  circle: <circle cx="12" cy="12" r="7.5" />,
  triangle: <path d="M12 4 21 20H3Z" />,
  line: <path d="M4 12h16" />,
  pointer: (
    <>
      <path d="M5 5l13 5.5-6 2-2 6Z" />
      <circle cx="18.5" cy="5.5" r="1.5" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="M7 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h1" />
    </>
  ),
};

export function AstroTechnicalIcon({
  icon,
  size = 18,
  stroke = 'currentColor',
  strokeWidth = 1.45,
  className = '',
  label,
}: Props) {
  const houseMatch = HOUSE_PATTERN.exec(icon);
  const content = houseMatch
    ? <HouseIcon house={Number(houseMatch[1])} />
    : PATHS[icon as Exclude<AstroTechnicalIconKey, `house-${number}`>];

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
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {content}
    </svg>
  );
}
