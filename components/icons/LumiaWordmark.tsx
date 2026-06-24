import React from 'react';

/**
 * Логотип LUMIA как вектор — монолинейные геометрические буквы с широкой
 * разрядкой и фирменной «A» уголком без перекладины (как на загрузочном экране).
 * Цвет берётся из currentColor, поэтому на белом фоне главной он тёмный,
 * а на тёмном — светлый. Толщина штриха тонкая, чтобы совпадать со сплэшем.
 */
export const LumiaWordmark: React.FC<{ className?: string; height?: number }> = ({
  className,
  height = 28,
}) => (
  <svg
    className={className}
    viewBox="-6 -6 460 112"
    style={{ height, width: 'auto', display: 'block' }}
    role="img"
    aria-label="LUMIA"
    fill="none"
    stroke="currentColor"
    strokeWidth={4.5}
    strokeLinecap="butt"
    strokeLinejoin="miter"
    strokeMiterlimit={8}
  >
    {/* L */}
    <path d="M0 0 L0 100 L46 100" />
    {/* U — тонкая со скруглённым низом */}
    <path d="M96 0 L96 72 Q96 100 124 100 Q152 100 152 72 L152 0" />
    {/* M — геометрическая, средний вершина чуть ниже центра */}
    <path d="M202 100 L202 0 L241 58 L280 0 L280 100" />
    {/* I */}
    <path d="M330 0 L330 100" />
    {/* A — уголок без перекладины */}
    <path d="M384 100 L416 0 L448 100" />
  </svg>
);
