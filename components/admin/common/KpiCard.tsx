import React from 'react';

const ICON_CHIP: Record<string, string> = {
  blue: 'bg-[#8C57FF]/12 text-[#8C57FF]',
  violet: 'bg-[#8C57FF]/12 text-[#8C57FF]',
  emerald: 'bg-[#56CA00]/12 text-[#56CA00]',
  amber: 'bg-[#FFB400]/15 text-[#E6A200]',
  rose: 'bg-[#FF4C51]/12 text-[#FF4C51]',
  sky: 'bg-[#16B1FF]/12 text-[#16B1FF]',
};

export function KpiCard({
  label,
  value,
  sub,
  color = 'blue',
  trend,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
}) {
  return (
    <div className="admin2-card flex flex-col justify-between p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${ICON_CHIP[color] || ICON_CHIP.blue}`}>
          {icon || <span className="h-2 w-2 rounded-full bg-current" />}
        </span>
        {sub ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
            {sub}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold leading-tight text-[#312D4B]">{value}</p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {trend ? (
            <span className={`text-[11px] font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.value >= 0 ? `+${trend.value}%` : `${trend.value}%`}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
