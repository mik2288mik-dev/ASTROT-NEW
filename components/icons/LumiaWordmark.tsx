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
    viewBox="-7 -7 468 94"
    style={{ height, width: 'auto', display: 'block' }}
    role="img"
    aria-label="LUMIA"
    fill="none"
    stroke="currentColor"
    strokeWidth={7}
    strokeLinecap="butt"
    strokeLinejoin="miter"
    strokeMiterlimit={8}
  >
    {/* L */}
    <path d="M0 0 L0 80 L50 80" />
    {/* U — со скруглённым низом */}
    <path d="M96 0 L96 54 Q96 80 127 80 Q158 80 158 54 L158 0" />
    {/* M — геометрическая, средняя вершина чуть выше центра */}
    <path d="M204 80 L204 0 L247 46 L290 0 L290 80" />
    {/* I */}
    <path d="M336 0 L336 80" />
    {/* A — уголок без перекладины */}
    <path d="M382 80 L418 0 L454 80" />
  </svg>
);
