import React from 'react';
import type { NatalPlanetKey } from '../../lib/natalWheel';
import type { ZodiacSign } from '../../lib/zodiac-utils';

type BaseIconProps = {
  className?: string;
  stroke?: string;
  strokeWidth?: number;
} & Omit<React.SVGProps<SVGSVGElement>, 'stroke' | 'strokeWidth'>;

function SvgWrap({
  className,
  children,
  stroke = 'currentColor',
  strokeWidth = 1.8,
  ...svgProps
}: React.PropsWithChildren<BaseIconProps>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...svgProps}
    >
      {children}
    </svg>
  );
}

export function PlanetSymbolIcon({
  planet,
  className,
  stroke = 'currentColor',
  strokeWidth = 1.8,
}: BaseIconProps & { planet: NatalPlanetKey }) {
  switch (planet) {
    case 'sun':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="12" cy="12" r="5.2" />
          <circle cx="12" cy="12" r="1.4" fill={stroke} stroke="none" />
          <path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
        </SvgWrap>
      );
    case 'moon':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M15.7 4.8A7.5 7.5 0 1 0 15.9 19c-3.5-1-5.9-4.1-5.9-7.7 0-2.8 1.5-5.3 3.9-6.5.6-.3 1.2-.6 1.8-.8Z" />
        </SvgWrap>
      );
    case 'rising':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M12 19V7" />
          <path d="M8 11l4-4 4 4" />
          <path d="M6.5 19a5.5 5.5 0 0 1 11 0" />
        </SvgWrap>
      );
    case 'mercury':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="12" cy="10" r="4.1" />
          <path d="M9.1 4.8C9.5 3 10.6 2 12 2c1.4 0 2.5 1 2.9 2.8" />
          <path d="M7.8 5.5c.8-1.5 2.2-2.3 4.2-2.3 2 0 3.4.8 4.2 2.3" />
          <path d="M12 14.2v6" />
          <path d="M9 17.3h6" />
        </SvgWrap>
      );
    case 'venus':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="12" cy="9" r="4.2" />
          <path d="M12 13.2V21" />
          <path d="M8.8 17.2h6.4" />
        </SvgWrap>
      );
    case 'mars':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="10" cy="14" r="4.2" />
          <path d="M13.1 10.9 19.5 4.5" />
          <path d="M15.7 4.5h3.8v3.8" />
        </SvgWrap>
      );
    case 'jupiter':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M9 6.2c3.5 0 5.4 1.9 5.4 4.6 0 2.5-1.8 4.3-4.9 4.3H7" />
          <path d="M13.8 14.4v5.4" />
          <path d="M10.9 17.1h5.8" />
        </SvgWrap>
      );
    case 'saturn':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M13 4.4v12.2" />
          <path d="M9 8.8h8" />
          <path d="M13 10.6c0 4.7 1.7 7 5 7" />
        </SvgWrap>
      );
    case 'uranus':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="12" cy="5.4" r="2.3" />
          <path d="M8.3 7.8v6.5M15.7 7.8v6.5M8.3 11.1h7.4" />
          <path d="M12 7.7v11.2" />
          <path d="M9.3 16.5h5.4" />
        </SvgWrap>
      );
    case 'neptune':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M7 8c.5 4 2.7 6.2 5 6.2 2.3 0 4.5-2.2 5-6.2" />
          <path d="M12 4.1v13.8" />
          <path d="M9 17.2h6" />
        </SvgWrap>
      );
    case 'pluto':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M12 4.4c2.9 0 4.8 1.8 4.8 4.4S14.9 13.2 12 13.2 7.2 11.4 7.2 8.8 9.1 4.4 12 4.4Z" />
          <path d="M12 13.2v6.3" />
          <path d="M9.2 16.6h5.6" />
        </SvgWrap>
      );
    case 'chiron':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="8.3" cy="7.2" r="2.4" />
          <path d="M10.2 8.9 16.3 4.4" />
          <path d="M12.8 7.3v11.2" />
          <path d="M9.9 12.1h5.8" />
        </SvgWrap>
      );
    default:
      return null;
  }
}

export function ZodiacIllustrationIcon({
  sign,
  className,
  stroke = 'currentColor',
  strokeWidth = 1.65,
}: BaseIconProps & { sign: ZodiacSign }) {
  switch (sign) {
    case 'Aries':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M4.8 18c.8-4.8 2.8-8 7.2-8 4.4 0 6.4 3.2 7.2 8" />
          <path d="M9.4 10c-1.5-2.1-2.3-4.2-2.3-6.2" />
          <path d="M14.6 10c1.5-2.1 2.3-4.2 2.3-6.2" />
        </SvgWrap>
      );
    case 'Taurus':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="12" cy="14" r="4.6" />
          <path d="M6.6 7.8C7.8 4.7 9.6 3.4 12 3.4c2.4 0 4.2 1.3 5.4 4.4" />
        </SvgWrap>
      );
    case 'Gemini':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M7 5.5h10M7 18.5h10" />
          <path d="M9 5.5c.5 3.1.5 6.7 0 13M15 5.5c-.5 3.1-.5 6.7 0 13" />
        </SvgWrap>
      );
    case 'Cancer':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="8.3" cy="9" r="2.1" />
          <circle cx="15.7" cy="15" r="2.1" />
          <path d="M6.2 9.2c0 3.7 2.9 6.5 6.4 6.5" />
          <path d="M17.8 14.8c0-3.7-2.9-6.5-6.4-6.5" />
        </SvgWrap>
      );
    case 'Leo':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <circle cx="8.2" cy="9.6" r="2.2" />
          <path d="M10.5 9.4c2.9 0 5-2.2 5-4.9 0-1.1-.3-2-.9-2.8" />
          <path d="M10.4 10c3.8 0 6.6 2.7 6.6 6.2 0 1.6-.6 2.9-1.7 4" />
        </SvgWrap>
      );
    case 'Virgo':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M6 18V7.1M10 18V7.1M14 18V7.1" />
          <path d="M6 11.2c.7-1 1.8-1.5 3-1.5 1.3 0 2.3.5 3 1.5.7-1 1.8-1.5 3-1.5 1.4 0 2.5.7 3.4 2.1" />
          <path d="M18.2 11.8v3.6c0 1.8-.9 3.3-2.7 4.2" />
        </SvgWrap>
      );
    case 'Libra':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M4.8 16.8h14.4" />
          <path d="M7 12.7a5 5 0 0 1 10 0" />
          <path d="M4.8 14.2h14.4" />
        </SvgWrap>
      );
    case 'Scorpio':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M6 18V7.1M10 18V7.1M14 18V7.1" />
          <path d="M6 11.2c.7-1 1.8-1.5 3-1.5 1.3 0 2.3.5 3 1.5.7-1 1.8-1.5 3-1.5 1.5 0 2.7.7 3.6 2.1" />
          <path d="M17.1 17.1h2.6v-2.6" />
          <path d="M16.1 18.1 19.7 14.5" />
        </SvgWrap>
      );
    case 'Sagittarius':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M5.4 18.6 18.6 5.4" />
          <path d="M12.1 5.4h6.5v6.5" />
          <path d="M9.3 9.3h4.6v4.6" />
        </SvgWrap>
      );
    case 'Capricorn':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M6 17.4c0-5 1.8-8 4.7-8 2.3 0 3.8 1.7 3.8 4.1 0 2.1-1.4 3.8-3.3 3.8-1.7 0-2.9-1-3.4-2.3 1 2.8 3.6 4.6 6.8 4.6 1.6 0 2.9-.4 4.1-1.3" />
        </SvgWrap>
      );
    case 'Aquarius':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M5.2 9.3c1.4-1.6 2.7-2.4 4-2.4 1.7 0 2.7 1.8 4.3 1.8 1.4 0 2.6-.8 4.1-2.4" />
          <path d="M5.2 15.9c1.4-1.6 2.7-2.4 4-2.4 1.7 0 2.7 1.8 4.3 1.8 1.4 0 2.6-.8 4.1-2.4" />
        </SvgWrap>
      );
    case 'Pisces':
      return (
        <SvgWrap className={className} stroke={stroke} strokeWidth={strokeWidth}>
          <path d="M7.3 6.3c2 1.5 3.4 3.5 3.4 5.7s-1.4 4.2-3.4 5.7" />
          <path d="M16.7 6.3c-2 1.5-3.4 3.5-3.4 5.7s1.4 4.2 3.4 5.7" />
          <path d="M4.6 12h14.8" />
        </SvgWrap>
      );
    default:
      return null;
  }
}
