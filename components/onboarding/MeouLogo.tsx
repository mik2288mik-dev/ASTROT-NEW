import React from 'react';

type MeouLogoProps = {
  large?: boolean;
  className?: string;
};

export const MeouLogo: React.FC<MeouLogoProps> = ({ large = false, className = '' }) => (
  <div
    className={`meou-wordmark${large ? ' meou-wordmark--large' : ''}${className ? ` ${className}` : ''}`}
    role="img"
    aria-label="MEOU"
  >
    <svg viewBox="0 0 242 62" aria-hidden="true" focusable="false">
      <path d="M3 58V4L27 41L51 4V58" />
      <path d="M106 4H72V58H106M72 31H101" />
      <image href="/assets/brand/personal-horoscope-mark.svg" x="111" y="-1" width="82" height="64" />
      <path d="M198 4V38C198 51 205 58 218 58C231 58 238 51 238 38V4" />
    </svg>
  </div>
);
