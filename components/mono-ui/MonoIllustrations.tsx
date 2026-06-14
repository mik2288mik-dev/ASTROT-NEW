import React from 'react';

type SvgProps = { className?: string; size?: number };

function strokeProps(size: number) {
  return { width: size, height: size, viewBox: '0 0 120 120', fill: 'none' as const };
}

/** Person reading / personal day */
export function MonoIllustPersonal({ className, size = 88 }: SvgProps) {
  return (
    <svg {...strokeProps(size)} className={className} aria-hidden="true">
      <circle cx="78" cy="28" r="14" stroke="#111" strokeWidth="2" />
      <path d="M78 42v28M66 58h24M58 86c8-12 28-12 40 0" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <rect x="18" y="52" width="36" height="48" rx="6" stroke="#111" strokeWidth="2" />
      <path d="M26 64h20M26 74h14" stroke="#111" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Two people — compatibility */
export function MonoIllustCouple({ className, size = 96 }: SvgProps) {
  return (
    <svg {...strokeProps(size)} className={className} aria-hidden="true">
      <circle cx="38" cy="34" r="12" stroke="#fff" strokeWidth="2" />
      <path d="M38 46v22M28 58h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="82" cy="34" r="12" stroke="#fff" strokeWidth="2" />
      <path d="M82 46v22M72 58h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 78c6 8 14 8 20 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Sun / horoscope */
export function MonoIllustHoroscope({ className, size = 80 }: SvgProps) {
  return (
    <svg {...strokeProps(size)} className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="18" stroke="#111" strokeWidth="2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1={60 + Math.cos((deg * Math.PI) / 180) * 26}
          y1={60 + Math.sin((deg * Math.PI) / 180) * 26}
          x2={60 + Math.cos((deg * Math.PI) / 180) * 34}
          y2={60 + Math.sin((deg * Math.PI) / 180) * 34}
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** Natal wheel */
export function MonoIllustChart({ className, size = 80 }: SvgProps) {
  return (
    <svg {...strokeProps(size)} className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="32" stroke="#111" strokeWidth="2" />
      <circle cx="60" cy="60" r="18" stroke="#111" strokeWidth="1.5" />
      <path d="M60 28v64M28 60h64M42 42l36 36M78 42 42 78" stroke="#111" strokeWidth="1.5" />
    </svg>
  );
}

/** Onboarding welcome */
export function MonoIllustWelcome({ className, size = 140 }: SvgProps) {
  return (
    <svg {...strokeProps(size)} className={className} aria-hidden="true">
      <circle cx="60" cy="44" r="18" stroke="#111" strokeWidth="2.2" />
      <path d="M60 62v36M44 78h32" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 108h72" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 98c8-10 44-10 52 0" stroke="#111" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
