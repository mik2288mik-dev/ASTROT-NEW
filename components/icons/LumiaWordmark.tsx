import React from 'react';

/**
 * Логотип LUMIA как вектор — монолинейные геометрические буквы с широкой
 * разрядкой и фирменной «A» уголком без перекладины (как на загрузочном экране).
 * Цвет берётся из currentColor, поэтому на белом фоне главной он тёмный,
 * а на тёмном — светлый. Толщина штриха тонкая, чтобы совпадать со сплэшем.
 */
export const LumiaWordmark: React.FC<{ className?: string; height?: number }> = ({
  className,
  height = 23,
}) => (
  <svg
    className={className}
    viewBox="-8 -8 374 100"
    style={{ height, width: 'auto', display: 'block' }}
    role="img"
    aria-label="LUMIA"
    fill="none"
    stroke="currentColor"
    strokeWidth={9.5}
    strokeLinecap="butt"
    strokeLinejoin="miter"
    strokeMiterlimit={8}
  >
    {/* L */}
    <path d="M0 0 L0 84 L42 84" />
    {/* U — со скруглённым низом */}
    <path d="M72 0 L72 56 Q72 84 99 84 Q126 84 126 56 L126 0" />
    {/* M — геометрическая, средняя вершина чуть выше центра */}
    <path d="M156 84 L156 0 L195 50 L234 0 L234 84" />
    {/* I */}
    <path d="M264 0 L264 84" />
    {/* A — уголок без перекладины */}
    <path d="M294 84 L326 0 L358 84" />
  </svg>
);
