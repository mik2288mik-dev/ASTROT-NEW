import React from 'react';

const SECTOR_COLORS = ['#F4A261', '#7BC47F', '#7CC6E8', '#5B8DEF'];

/** A small natal wheel: twelve element-colored sectors, house ticks, the axes and a few aspects. */
function PlusWheel() {
  const sectors = Array.from({ length: 12 }, (_, index) => {
    const a0 = (-90 + index * 30) * (Math.PI / 180);
    const a1 = (-90 + (index + 1) * 30) * (Math.PI / 180);
    const p = (r: number, a: number) => `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
    return { d: `M${p(47, a0)}A47 47 0 0 1 ${p(47, a1)}L${p(38, a1)}A38 38 0 0 0 ${p(38, a0)}Z`, fill: SECTOR_COLORS[index % 4] };
  });
  return (
    <svg className="nebo-plus-card-wheel" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,.35)" />
      {sectors.map((sector, index) => <path key={index} d={sector.d} fill={sector.fill} opacity=".38" />)}
      <g fill="none" stroke="#1B2A6B" strokeLinecap="round">
        <circle cx="50" cy="50" r="47" strokeWidth=".9" opacity=".55" />
        <circle cx="50" cy="50" r="38" strokeWidth=".8" opacity=".5" />
        <circle cx="50" cy="50" r="14" strokeWidth=".7" opacity=".4" />
        <path d="M3.7 58.2L96.3 41.8M43.5 3.5L56.5 96.5" strokeWidth="1.1" opacity=".6" />
        <path d="M74.4 58.9L27.0 37.8" stroke="#E07A5F" strokeWidth=".9" opacity=".75" />
        <path d="M61.8 73.2L41.1 25.6" stroke="#5B8DEF" strokeWidth=".9" opacity=".75" />
        <path d="M37.8 73.0L63.0 27.5" stroke="#81B29A" strokeWidth=".9" opacity=".75" />
      </g>
      <circle cx="79.1" cy="60.6" r="2.6" fill="#F2C94C" stroke="#fff" strokeWidth=".8" />
      <circle cx="64.1" cy="77.6" r="2.6" fill="#9AA3B5" stroke="#fff" strokeWidth=".8" />
      <circle cx="35.4" cy="77.4" r="2.6" fill="#E07A5F" stroke="#fff" strokeWidth=".8" />
    </svg>
  );
}

/** The shimmering NEBO Plus membership card from the canvas. */
export function NeboPlusCard({ name, label = 'Участник' }: { name: string; label?: string }) {
  return (
    <div className="nebo-plus-card">
      <span className="nebo-plus-card-sheen" aria-hidden="true" />
      <span className="nebo-plus-card-brand">
        <img src="/assets/brand/nebo-app-icon-192.png" alt="" width={28} height={28} />
        <strong>NEBO Plus</strong>
      </span>
      <span className="nebo-plus-card-owner">
        <span>{label}</span>
        <strong>{name}</strong>
      </span>
      <PlusWheel />
    </div>
  );
}
