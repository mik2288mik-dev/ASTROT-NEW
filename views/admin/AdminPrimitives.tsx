import React from 'react';

export const AdminPanelShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-shell">{children}</div>
);

export const AdminSurface: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <section className={`admin-surface ${className}`.trim()}>{children}</section>
);

export const AdminSectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, action }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      {eyebrow ? <p className="admin-label">{eyebrow}</p> : null}
      <h2 className="admin-heading mt-2 text-[26px] leading-tight text-white sm:text-[30px]">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-[15px]">{subtitle}</p> : null}
    </div>
    {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
  </div>
);

export const AdminStateBanner: React.FC<{
  tone: 'error' | 'success' | 'info';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/25 bg-red-500/10 text-red-100'
      : tone === 'success'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
        : 'border-sky-400/25 bg-sky-400/10 text-sky-100';

  return (
    <div className={`rounded-[22px] border px-4 py-3 text-sm leading-6 shadow-[0_10px_32px_rgba(0,0,0,0.12)] ${toneClass}`}>
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
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[2.55rem] items-center justify-center rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
      active
        ? 'border-sky-400/40 bg-sky-400/14 text-sky-100 shadow-[0_8px_24px_rgba(14,165,233,0.14)]'
        : 'border-white/8 bg-white/[0.035] text-slate-300 hover:border-white/16 hover:bg-white/[0.06] hover:text-white'
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
    type="button"
    onClick={onClick}
    className={`admin-surface-muted w-full px-4 py-3 text-left transition-all hover:border-white/16 ${
      active ? 'border-sky-400/35 bg-sky-400/10 shadow-[0_10px_30px_rgba(14,165,233,0.12)]' : ''
    }`}
  >
    <p className="admin-label">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </button>
);

export const AdminEmptyState: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
}> = ({ title, body, action }) => (
  <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
    <h3 className="admin-heading text-[24px] text-white">{title}</h3>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">{body}</p>
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
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
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="admin-divider flex flex-col gap-3 px-5 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>{from}–{to} / {total}</span>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span>{label} {page} / {Math.max(totalPages, 1)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="admin-button admin-button-secondary min-w-[2.8rem] px-0"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="admin-button admin-button-secondary min-w-[2.8rem] px-0"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`admin-input ${className}`.trim()} {...props} />
  )
);
AdminInput.displayName = 'AdminInput';

export const AdminSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select ref={ref} className={`admin-select ${className}`.trim()} {...props}>
      {children}
    </select>
  )
);
AdminSelect.displayName = 'AdminSelect';

export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`admin-textarea ${className}`.trim()} {...props} />
  )
);
AdminTextarea.displayName = 'AdminTextarea';

export const AdminButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
}> = ({ tone = 'secondary', className = '', children, ...props }) => {
  const toneClass =
    tone === 'primary'
      ? 'admin-button-primary'
      : tone === 'ghost'
        ? 'admin-button-ghost'
        : tone === 'danger'
          ? 'admin-button-danger'
          : 'admin-button-secondary';

  return (
    <button type="button" className={`admin-button ${toneClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

export const AdminBadge: React.FC<{
  tone?: 'neutral' | 'premium' | 'admin' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}> = ({ tone = 'neutral', children }) => {
  const toneClass =
    tone === 'premium'
      ? 'bg-yellow-500/14 text-yellow-200'
      : tone === 'admin'
        ? 'bg-fuchsia-500/14 text-fuchsia-200'
        : tone === 'success'
          ? 'bg-emerald-500/14 text-emerald-200'
          : tone === 'warning'
            ? 'bg-amber-500/14 text-amber-200'
            : tone === 'danger'
              ? 'bg-red-500/14 text-red-200'
              : tone === 'info'
                ? 'bg-sky-500/14 text-sky-200'
                : 'bg-white/[0.06] text-slate-300';

  return <span className={`admin-badge ${toneClass}`}>{children}</span>;
};
