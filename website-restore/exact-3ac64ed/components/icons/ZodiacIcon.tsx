import React from 'react';

/**
 * Monochrome SVG icons for the 12 zodiac signs.
 * Stroke-based, scales cleanly from 12px to 64px.
 *
 * Inputs accept both English ("Aries") and Russian ("Овен") sign names.
 */

export type ZodiacSignKey =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

const SIGN_ALIASES: Record<string, ZodiacSignKey> = {
  Aries: 'aries', Овен: 'aries',
  Taurus: 'taurus', Телец: 'taurus',
  Gemini: 'gemini', Близнецы: 'gemini',
  Cancer: 'cancer', Рак: 'cancer',
  Leo: 'leo', Лев: 'leo',
  Virgo: 'virgo', Дева: 'virgo',
  Libra: 'libra', Весы: 'libra',
  Scorpio: 'scorpio', Скорпион: 'scorpio',
  Sagittarius: 'sagittarius', Стрелец: 'sagittarius',
  Capricorn: 'capricorn', Козерог: 'capricorn',
  Aquarius: 'aquarius', Водолей: 'aquarius',
  Pisces: 'pisces', Рыбы: 'pisces',
};

export function resolveZodiacKey(input?: string | null): ZodiacSignKey | null {
  if (!input) return null;
  return SIGN_ALIASES[input.trim()] || null;
}

type Props = {
  sign: string | ZodiacSignKey | null | undefined;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

const PATHS: Record<ZodiacSignKey, React.ReactNode> = {
  aries: (
    <path d="M5 17 C5 9 9 6 12 12 C15 6 19 9 19 17" />
  ),
  taurus: (
    <>
      <circle cx="12" cy="15.5" r="4" />
      <path d="M5 8 Q12 3 19 8" />
    </>
  ),
  gemini: (
    <>
      <path d="M8 6 V18 M16 6 V18" />
      <path d="M6 6 H18 M6 18 H18" />
    </>
  ),
  cancer: (
    <>
      <circle cx="8" cy="9" r="1.8" />
      <path d="M6.2 9 Q6 4 14 6" />
      <circle cx="16" cy="15" r="1.8" />
      <path d="M17.8 15 Q18 20 10 18" />
    </>
  ),
  leo: (
    <>
      <circle cx="9" cy="11" r="3" />
      <path d="M12 12.5 Q17 13 18 9 Q19 16 14 17 Q12 17 13 19" />
    </>
  ),
  virgo: (
    <path d="M5 8 V18 M5 8 Q8 18 11 8 V18 M11 8 Q14 18 17 13 V18 Q19 17 17 14" />
  ),
  libra: (
    <>
      <path d="M5 17 H19" />
      <path d="M5 13.5 H19" />
      <path d="M8 13.5 Q12 7 16 13.5" />
    </>
  ),
  scorpio: (
    <path d="M4 8 V18 M4 8 Q7 18 10 8 V18 M10 8 Q13 18 16 8 V14 L20 14 L18.5 12.5 M20 14 L18.5 15.5" />
  ),
  sagittarius: (
    <>
      <path d="M6 18 L18 6" />
      <path d="M12 6 H18 V12" />
      <path d="M9 13 L11 11" />
    </>
  ),
  capricorn: (
    <path d="M5 8 V14 M5 8 Q8 15 11 9 L12 12 Q15 8 17.5 13 Q17.5 17 13.5 16 Q11.5 16 13 18.5" />
  ),
  aquarius: (
    <>
      <path d="M5 9 L8 7 L11 9 L14 7 L17 9 L19 8" />
      <path d="M5 14 L8 12 L11 14 L14 12 L17 14 L19 13" />
    </>
  ),
  pisces: (
    <>
      <path d="M7 5 Q9 12 7 19" />
      <path d="M17 5 Q15 12 17 19" />
      <path d="M8 12 H16" />
    </>
  ),
};

export const ZodiacIcon: React.FC<Props> = ({
  sign,
  size = 16,
  stroke = 'currentColor',
  strokeWidth = 1.4,
  className = '',
}) => {
  const key =
    typeof sign === 'string'
      ? resolveZodiacKey(sign) || (sign in PATHS ? (sign as ZodiacSignKey) : null)
      : sign ?? null;

  if (!key || !(key in PATHS)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
        <circle cx="12" cy="12" r="6" fill="none" stroke={stroke} strokeWidth={strokeWidth} />
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
