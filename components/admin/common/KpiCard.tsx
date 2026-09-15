import React from 'react';

export function KpiCard({ label, title, value, sub, subtext, trend }: {
  label?: string;
  title?: string;
  value: React.ReactNode;
  sub?: string;
  subtext?: string;
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
}) {
  const displayLabel = label || title || '';
  const displaySub = sub || subtext;
  return (
    <div className="admin-kpi">
      <p className="admin-kpi-label" title={displayLabel}>{displayLabel}</p>
      <p className="admin-kpi-value">{value}</p>
      <div className="admin-kpi-meta"><span title={displaySub}>{displaySub || 'За всё время'}</span>{trend ? <strong data-direction={trend.value >= 0 ? 'up' : 'down'}>{trend.value >= 0 ? '+' : ''}{trend.value}%</strong> : null}</div>
    </div>
  );
}
