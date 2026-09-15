import React, { useEffect, useState } from 'react';
import { admin2, type AdminDashboard, type AdminPulse } from '../../../services/admin2Service';
import { AdminActivityDashboard } from '../../admin2/AdminActivity';
import { KpiCard } from '../common/KpiCard';
import { AlertTriangle, ArrowRight, CreditCard, RefreshCw } from 'lucide-react';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export interface DashboardSectionProps {
  onNavigate?: (section: string, params?: Record<string, string>) => void;
  onSelectUser?: (userId: string) => void;
}

export function DashboardSection({ onNavigate, onSelectUser }: DashboardSectionProps) {
  const [pulse, setPulse] = useState<AdminPulse | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [pulseBusy, setPulseBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPulse = () => {
    setPulseBusy(true);
    admin2.pulse()
      .then(setPulse)
      .catch((err) => console.warn('Pulse load failed:', err?.message))
      .finally(() => setPulseBusy(false));
  };

  const loadDashboard = () => {
    admin2.dashboard()
      .then(setDashboard)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadPulse();
    loadDashboard();
    const interval = setInterval(loadPulse, 15000); // 15s auto-refresh for real-time pulse
    return () => clearInterval(interval);
  }, []);

  const k = dashboard?.kpis;

  return (
    <div className="admin-dashboard space-y-6">
      {error ? <p className="admin2-error" role="alert">{error}</p> : null}
      {/* ── Блок «Что происходит прямо сейчас» (Pulse) ── */}
      <div className="admin-pulse rounded-[24px] bg-gradient-to-r from-[#312D4B] to-[#453F63] p-5 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-lg font-bold tracking-tight">Что происходит прямо сейчас</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">Пульс 15 минут</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/20"
            disabled={pulseBusy}
            onClick={loadPulse}
          >
            <RefreshCw size={13} className={pulseBusy ? 'animate-spin' : ''} />
            Обновить пульс
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-white/60">Онлайн (5 минут)</p>
            <p className="mt-1 text-2xl font-bold text-white">{pulse?.pulse.active5m ?? '—'}</p>
            <p className="text-[11px] text-emerald-400">активные пользователи</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-white/60">Активных (15 минут)</p>
            <p className="mt-1 text-2xl font-bold text-white">{pulse?.pulse.active15m ?? '—'}</p>
            <p className="text-[11px] text-white/60">уникальных сессий</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-white/60">Событий за 15 мин</p>
            <p className="mt-1 text-2xl font-bold text-white">{pulse?.pulse.events15m ?? '—'}</p>
            <p className="text-[11px] text-white/60">действий в интерфейсе</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm">
            <p className="text-xs text-white/60">Свежие дефекты AI</p>
            <p className="mt-1 text-2xl font-bold text-white">{pulse?.recentAiDefects.length ?? 0}</p>
            <p className="text-[11px] text-rose-300">требуют внимания</p>
          </div>
        </div>

        {/* Свежие события в реальном времени */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {/* Регистрации и ключевые действия */}
          <div className="rounded-2xl bg-white/5 p-3 text-xs">
            <p className="font-semibold text-white/80 mb-2">Последние регистрации и действия</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {pulse?.recentEvents.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-white/70 py-1 border-b border-white/5 last:border-0">
                  <span className="truncate">
                    {onSelectUser ? (
                      <button
                        type="button"
                        onClick={() => onSelectUser(e.userId)}
                        className="text-white hover:underline text-left font-bold cursor-pointer"
                      >
                        {e.userName || e.userId}:
                      </button>
                    ) : (
                      <b className="text-white">{e.userName || e.userId}:</b>
                    )}{' '}
                    {e.label}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/40">{fmtDate(e.occurredAt)}</span>
                </div>
              ))}
              {!pulse?.recentEvents.length ? <p className="text-white/40 text-center py-2">Событий пока нет</p> : null}
            </div>
          </div>

          {/* Платежи и ошибки */}
          <div className="rounded-2xl bg-white/5 p-3 text-xs">
            <p className="font-semibold text-white/80 mb-2">Последние платежи и сбои</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {pulse?.recentPayments.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-emerald-300 py-1 border-b border-white/5">
                  <span className="flex items-center gap-1 truncate">
                    <CreditCard size={12} />
                    <b>{p.amount === null ? 'Покупка RuStore' : `+${p.amount} ${p.currency}`}</b> от{' '}
                    {onSelectUser ? (
                      <button
                        type="button"
                        onClick={() => onSelectUser(p.userId)}
                        className="underline hover:text-white cursor-pointer"
                      >
                        {p.userId}
                      </button>
                    ) : (
                      p.userId
                    )}
                  </span>
                  <span className="text-[10px] text-white/40">{fmtDate(p.createdAt)}</span>
                </div>
              ))}
              {pulse?.recentErrors.slice(0, 3).map((err) => (
                <div key={err.id} className="flex items-center justify-between gap-2 text-rose-300 py-1 border-b border-white/5">
                  <span className="flex items-center gap-1 truncate">
                    <AlertTriangle size={12} />
                    <b>{err.errorCode}:</b> {err.message}
                  </span>
                  <span className="text-[10px] text-white/40">{fmtDate(err.lastSeenAt)}</span>
                </div>
              ))}
              {!pulse?.recentPayments.length && !pulse?.recentErrors.length ? (
                <p className="text-white/40 text-center py-2">Платежей и ошибок за последнее время не зафиксировано</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ключевые метрики продукта (KPIs) ── */}
      {k ? (
        <div className="admin-kpi-grid grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          <KpiCard
            color="blue"
            label="Всего пользователей"
            value={k.totalUsers.toLocaleString('ru-RU')}
            sub={`+${k.newUsers1d} за день`}
          />
          <KpiCard
            color="violet"
            label="Активный Premium"
            value={k.activePremiumUsers.toLocaleString('ru-RU')}
            sub={`${k.premiumRate}% проникновение`}
          />
          <KpiCard
            color="sky"
            label="DAU / WAU / MAU"
            value={`${k.dau} / ${k.wau} / ${k.mau}`}
            sub="активность"
          />
          <KpiCard
            color="rose"
            label="Выручка Stars"
            value={`${k.totalStars.toLocaleString('ru-RU')} ⭐`}
            sub={`${k.stars30d} за 30д`}
          />
          <KpiCard
            color="emerald"
            label="Натальных карт"
            value={k.totalCharts.toLocaleString('ru-RU')}
            sub="построено"
          />
          <KpiCard
            color="amber"
            label="Новые 7д / 30д"
            value={`${k.newUsers7d} / ${k.newUsers30d}`}
            sub="динамика"
          />
          <KpiCard
            color="blue"
            label="Всего платежей"
            value={k.totalPayments.toLocaleString('ru-RU')}
            sub="успешных транзакций"
          />
          <KpiCard
            color="rose"
            label="Без даты рождения"
            value={k.usersWithoutBirthData.toLocaleString('ru-RU')}
            sub="не завершили ввод"
          />
        </div>
      ) : null}

      {/* ── Детальный график активности и времени в приложении ── */}
      <AdminActivityDashboard />

      {/* ── Воронка и Retention ── */}
      {dashboard ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="admin2-card p-5">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-bold text-slate-800">Продуктовая воронка</h3>
              {onNavigate ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-[#8C57FF] hover:underline"
                  onClick={() => onNavigate('analytics')}
                >
                  Все воронки <ArrowRight size={12} />
                </button>
              ) : null}
            </div>
            <div className="space-y-3 pt-2">
              {dashboard.funnel.map((s) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{s.label}</span>
                    <span className="text-slate-400">
                      {s.users.toLocaleString('ru-RU')} чел · <b>{s.pctOfStart}%</b>
                      {s.key !== 'signup' ? ` (${s.pctOfPrev}% от пред.)` : ''}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8C57FF] to-[#6833D8] transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, s.pctOfStart))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="admin2-card p-5">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-base font-bold text-slate-800">Retention (когорты 90 дней)</h3>
                {onNavigate ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold text-[#8C57FF] hover:underline"
                    onClick={() => onNavigate('analytics')}
                  >
                    Когортная таблица <ArrowRight size={12} />
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                {[
                  ['D1', dashboard.retention.d1],
                  ['D7', dashboard.retention.d7],
                  ['D30', dashboard.retention.d30],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-2xl bg-slate-50 py-3.5">
                    <p className="text-xs font-medium text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-[#312D4B]">{val != null ? `${val}%` : '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin2-card p-5">
              <h3 className="text-base font-bold text-slate-800 mb-3">Популярные события (30 дней)</h3>
              <div className="space-y-2">
                {dashboard.events.slice(0, 5).map((e) => (
                  <div key={e.type} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 truncate">{e.label}</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{e.count.toLocaleString('ru-RU')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Откуда приходят к оплате (Commerce Attribution) ── */}
      {dashboard?.commerceAttribution?.length ? (
        <div className="admin2-card p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Откуда приходят к оплате</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Атрибуция коммерческих действий за последние 30 дней: раздел показа предложения и исходная точка.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { stage: 'paywall_view', label: '1. Paywall открыт' },
              { stage: 'checkout_start', label: '2. Оплата начата' },
              { stage: 'purchase_success', label: '3. Покупка завершена' },
            ].map((col) => {
              const rows = dashboard.commerceAttribution.filter((r) => r.stage === col.stage);
              return (
                <div key={col.stage} className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-xs font-bold text-slate-700 pb-2 border-b border-slate-200">{col.label}</p>
                  <div className="mt-2 space-y-2">
                    {rows.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate text-slate-600" title={`${r.placement || 'не указан'} / ${r.source || 'не указан'}`}>
                          {r.placement || 'раздел'} · {r.source || 'источник'}
                        </span>
                        <span className="font-semibold text-slate-800 tabular-nums shrink-0">{r.users} чел</span>
                      </div>
                    ))}
                    {!rows.length ? <p className="text-xs text-slate-400 py-2">Нет данных</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
