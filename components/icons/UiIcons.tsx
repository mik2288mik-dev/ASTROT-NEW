import React from 'react';

/**
 * Тонкие линейные SVG-иконки интерфейса (НЕ эмодзи).
 * Наследуют currentColor, масштабируются. Используются в быстрых
 * кнопках, секциях и карточках вместо эмодзи.
 */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base(size = 24, props: React.SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

/** Натальная карта — круг с делениями */
export function NatalChartIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

/** Гороскоп — компас/звезда-роза */
export function HoroscopeIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.8 8.2l-2.6 5.4-5.4 2.6 2.6-5.4 5.4-2.6Z" />
    </svg>
  );
}

/** Союз / совместимость — сердце */
export function HeartIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M12 20C6.8 16.6 4 13.5 4 10.4 4 8.1 5.8 6.3 8.1 6.3c1.5 0 2.8.8 3.9 2.2 1.1-1.4 2.4-2.2 3.9-2.2C18.2 6.3 20 8.1 20 10.4c0 3.1-2.8 6.2-8 9.6Z" />
    </svg>
  );
}

/** Чат / спросить — пузырь */
export function ChatIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M5 6.5h14a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H10l-4 3.2V8.5a2 2 0 0 1 2-2Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}

/** Настройки — шестерёнка */
export function SettingsIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2.1 1.2M17.6 15.3l2.1 1.2M4.3 16.5l2.1-1.2M17.6 8.7l2.1-1.2" />
    </svg>
  );
}

/** Стрелка вправо — переходы «Открыть →» */
export function ChevronRightIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Шеврон вниз — раскрытие списков/пикера */
export function ChevronDownIcon({ size, ...rest }: IconProps) {
  return (
    <svg {...base(size, rest)}>
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}
