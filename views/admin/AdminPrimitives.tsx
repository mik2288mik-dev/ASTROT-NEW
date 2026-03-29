import React from 'react';

export const AdminPanelShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-5">{children}</div>
);

export const AdminSurface: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <section className={`rounded-[28px] border border-white/10 bg-[#111827]/92 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur ${className}`}>
    {children}
  </section>
);

export const AdminSectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      {eyebrow ? (
        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      ) : null}
      <h3 className="mt-1 font-serif text-[22px] leading-tight text-white">{title}</h3>
      {subtitle ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

export const AdminStateBanner: React.FC<{
  tone: 'error' | 'success' | 'info';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : tone === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
  );
};

export const AdminChipButton: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ active = false, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
      active
        ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
    }`}
  >
    {children}
  </button>
);

export const AdminStatChip: React.FC<{
  label: string;
  value: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, active = false, onClick }) => (
  <button
    onClick={onClick}
    className={`min-w-[132px] rounded-[22px] border px-4 py-3 text-left transition-colors ${
      active
        ? 'border-sky-400/45 bg-sky-400/12'
        : 'border-white/10 bg-white/[0.04] hover:border-white/20'
    }`}
  >
    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </button>
);

export const AdminEmptyState: React.FC<{
  title: string;
  body: string;
}> = ({ title, body }) => (
  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
    <p className="font-serif text-xl text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
  </div>
);

export const AdminPagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, total, pageSize, label, onPageChange }) => {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-xs text-slate-400">
        <span>{total}</span>
        <span>{label} 1 / 1</span>
      </div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-xs text-slate-400">
      <span>{from}-{to} / {total}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-full border border-white/10 px-3 py-2 text-white disabled:opacity-40"
        >
          ←
        </button>
        <span>{label} {page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-full border border-white/10 px-3 py-2 text-white disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
};
